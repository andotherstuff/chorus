import { useCashuStore } from '@/stores/cashuStore';
import { CashuMint, CashuWallet, MeltQuoteResponse, MeltQuoteState, MintQuoteResponse, MintQuoteState, Proof } from '@cashu/cashu-ts';

export interface MintQuote {
  mintUrl: string;
  amount: number;
  paymentRequest: string;
  quoteId: string;
  state: MintQuoteState;
}

export interface MeltQuote {
  mintUrl: string;
  amount: number;
  paymentRequest: string;
  quoteId: string;
  state: MeltQuoteState;
}

/**
 * Create a Lightning invoice to receive funds
 * @param mintUrl The URL of the mint to use
 * @param amount Amount in satoshis
 * @returns Object containing the invoice and information needed to process it
 */
export async function createLightningInvoice(mintUrl: string, amount: number): Promise<MintQuote> {
  try {
    const mint = new CashuMint(mintUrl);
    const wallet = new CashuWallet(mint);

    // Load mint keysets
    await wallet.loadMint();

    // Create a mint quote
    const mintQuote = await wallet.createMintQuote(amount);
    useCashuStore.getState().addMintQuote(mintUrl, mintQuote);

    // Return the invoice and quote information
    return {
      mintUrl,
      amount,
      paymentRequest: mintQuote.request,
      quoteId: mintQuote.quote,
      state: MintQuoteState.UNPAID,
    };
  } catch (error) {
    console.error('Error creating Lightning invoice:', error);
    throw error;
  }
}

/**
 * Mint tokens after a Lightning invoice has been paid
 * @param mintUrl The URL of the mint to use
 * @param quoteId The quote ID from the invoice
 * @param amount Amount in satoshis
 * @returns The minted proofs
 */
export async function mintTokensFromPaidInvoice(mintUrl: string, quoteId: string, amount: number, maxAttempts: number = 40): Promise<Proof[]> {
  try {
    const mint = new CashuMint(mintUrl);
    const wallet = new CashuWallet(mint);

    // Load mint keysets
    await wallet.loadMint();

    let attempts = 0;
    let mintQuoteChecked;

    while (attempts < maxAttempts) {
      try {
        // Check the status of the quote
        mintQuoteChecked = await wallet.checkMintQuote(quoteId);

        if (mintQuoteChecked.state === MintQuoteState.PAID) {
          break; // Exit the loop if the invoice is paid
        } else {
          throw new Error('Lightning invoice has not been paid yet');
        }
      } catch (error) {
        console.error('Error checking mint quote:', error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for 3 seconds before retrying
      }
    }

    if (attempts === maxAttempts) {
      throw new Error('Failed to confirm payment after multiple attempts');
    }

    // Mint proofs using the paid quote
    const proofs = await wallet.mintProofs(amount, quoteId);

    const mintQuoteUpdated = await wallet.checkMintQuote(quoteId);
    useCashuStore.getState().updateMintQuote(mintUrl, quoteId, mintQuoteUpdated as MintQuoteResponse);

    return proofs;
  } catch (error) {
    console.error('Error minting tokens from paid invoice:', error);
    throw error;
  }
}


/**
 * Create a melt quote for a Lightning invoice
 * @param mintUrl The URL of the mint to use
 * @param paymentRequest The Lightning invoice to pay
 * @returns The melt quote
 */
export async function createMeltQuote(mintUrl: string, paymentRequest: string): Promise<MeltQuoteResponse> {
  try {
    const mint = new CashuMint(mintUrl);
    const wallet = new CashuWallet(mint);

    // Load mint keysets
    await wallet.loadMint();

    // Create a melt quote
    const meltQuote = await wallet.createMeltQuote(paymentRequest);
    useCashuStore.getState().addMeltQuote(mintUrl, meltQuote);

    return meltQuote;
  } catch (error) {
    console.error('Error creating melt quote:', error);
    throw error;
  }
}

/**
 * Pay a Lightning invoice by melting tokens
 * @param mintUrl The URL of the mint to use
 * @param quoteId The quote ID from the invoice
 * @param proofs The proofs to spend
 * @returns The fee and change proofs
 */
export async function payMeltQuote(mintUrl: string, quoteId: string, proofs: Proof[]) {
  try {
    const mint = new CashuMint(mintUrl);
    // const mintInStore = useCashuStore.getState().getMint(mintUrl);
    // const keysArray = mintInStore.keys?.flatMap(obj => Object.values(obj)) || [];
    // const wallet = new CashuWallet(mint, {
    //   keys: keysArray,
    //   keysets: mintInStore.keysets,
    //   mintInfo: mintInStore.mintInfo
    // });
    const wallet = new CashuWallet(mint)

    // Load mint keysets
    await wallet.loadMint();

    // Get melt quote from store
    const meltQuote = useCashuStore.getState().getMeltQuote(mintUrl, quoteId);

    // Calculate total amount needed, including fee
    const amountToSend = meltQuote.amount + meltQuote.fee_reserve;

    const proofsAmount = proofs.reduce((sum, p) => sum + p.amount, 0);
    if (proofsAmount < amountToSend) {
      throw new Error(`Not enough funds on mint ${mintUrl}`);
    }

    // Perform coin selection
    const { keep, send } = await wallet.send(amountToSend, proofs, {
      includeFees: true, privkey: useCashuStore.getState().privkey
    });

    // Melt the selected proofs to pay the Lightning invoice
    let meltResponse;
    try {
      meltResponse = await wallet.meltProofs(meltQuote, send);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Check if error is "Token already spent"
      if (message.includes("Token already spent")) {
        console.log("Detected spent tokens, cleaning up and retrying...");
        error.message = "Token already spent. Please go to your wallet and press Cleanup Wallet for this mint.";
        throw error;
      }
      throw error;
    }

    const meltQuoteUpdated = await wallet.checkMeltQuote(meltQuote.quote);
    useCashuStore.getState().updateMeltQuote(mintUrl, meltQuote.quote, meltQuoteUpdated as MeltQuoteResponse);

    return {
      fee: meltQuote.fee_reserve || 0,
      change: meltResponse.change || [],
      keep,
      success: true
    };
  } catch (error) {
    console.error('Error paying Lightning invoice:', error);
    throw error;
  }
}

/**
 * Calculate total amount in a list of proofs
 * @param proofs List of proofs
 * @returns Total amount
 */
export function getProofsAmount(proofs: Proof[]): number {
  return proofs.reduce((total, proof) => total + proof.amount, 0);
}

/**
 * Parse a Lightning invoice to extract the amount
 * @param paymentRequest The Lightning invoice to parse
 * @returns The amount in satoshis or null if not found
 */
export function parseInvoiceAmount(paymentRequest: string): number | null {
  try {
    // Simple regex to extract amount from BOLT11 invoice
    // This is a basic implementation - a proper decoder would be better
    const match = paymentRequest.match(/lnbc(\d+)([munp])/i);

    if (!match) return null;

    let amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    // Convert to satoshis based on unit
    switch (unit) {
      case 'p': // pico
        amount = Math.floor(amount / 10); // 1 pico-btc = 0.1 satoshi
        break;
      case 'n': // nano
        amount = Math.floor(amount); // 1 nano-btc = 1 satoshi
        break;
      case 'u': // micro
        amount = amount * 100; // 1 micro-btc = 100 satoshis
        break;
      case 'm': // milli
        amount = amount * 100; // 1 milli-btc = 100,000 satoshis
        break;
      default: // btc
        amount = amount * 100000000; // 1 btc = 100,000,000 satoshis
    }

    return amount;
  } catch (error) {
    console.error('Error parsing invoice amount:', error);
    return null;
  }
} 