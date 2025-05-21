import { CashuMint, Proof } from "@cashu/cashu-ts";
import { useCallback, useRef } from "react";
import { useNip60Wallet } from "../lib/nip60";
import { useWalletStore } from "../stores/walletStore";

// Simple wrapper around CashuMint client instances
const mintClients: Record<string, CashuMint> = {};

async function getMintClientInternal(mintUrl: string): Promise<CashuMint> {
  if (!mintClients[mintUrl]) {
    const mint = new CashuMint(mintUrl);
    // Optional: Fetch keysets here to validate mint and cache keys
    try {
       await mint.getKeySets();
      mintClients[mintUrl] = mint;
    } catch (error) {
       console.error(`Failed to initialize mint client for ${mintUrl}:`, error);
       throw new Error(`Could not connect to mint: ${mintUrl}`);
    }
  }
  return mintClients[mintUrl];
}

export function useCashuMint() {
  const { tokens, markTokenSpent } = useWalletStore();
  const { publishTokenEvent, publishHistoryEvent, fetchWalletData } = useNip60Wallet();

  // Provides a CashuMint client instance for a given mint URL
  const getMintClient = useCallback(async (mintUrl: string): Promise<CashuMint> => {
    return getMintClientInternal(mintUrl);
  }, []);

  // Requests a mint quote (Lightning invoice) from a mint
  const requestMintQuote = useCallback(async (mint: CashuMint, amount: number) => {
    try {
      const quote = await mint.createMintQuote({ amount, unit: "sat" });
      // TODO: Store quote in state if needed for later use
      return quote; // Returns { quote: string, request: string, paid: boolean }
    } catch (error) {
      console.error("Request mint quote failed:", error);
      throw error;
    }
  }, []);

   // Checks the payment status of a mint quote
   const checkPaymentStatus = useCallback(async (mint: CashuMint, quoteId: string) => {
      try {
         const status = await mint.checkMintQuote(quoteId);
         return status; // Returns { paid: boolean }
      } catch (error) {
         console.error("Check payment status failed:", error);
         throw error;
      }
   }, []);

  // Mints new tokens after a Lightning invoice is paid
  const mintTokens = useCallback(async (mint: CashuMint, quoteId: string, amount: number) => {
    try {
      // Generate blindfolded messages for the amount
      const amounts = [amount]; // Simple for now, assuming array of numbers
      const mintResponse = await mint.mint({ quoteId, blindedMessages: amounts } as any);
      const proofs = (mintResponse as any).proofs; // Assuming proofs are directly on the response or a common property

      // Create and publish new token event
      const newTokenEventContent = { mint: mint.mintUrl, proofs };
       const publishedTokenEvent = await publishTokenEvent(newTokenEventContent);

       // Create and publish history event (In) - This might be redundant if payment is tracked elsewhere
       // but for NIP-60 we should probably record this as a receipt of tokens.
       // A more accurate history entry might be created when the invoice is generated and then updated.
      await publishHistoryEvent({
        direction: "in",
        amount,
        description: "Minted tokens",
        relatedEvents: [publishedTokenEvent.id], // Link to the token event
      });

      // Re-fetch wallet data to include the new tokens
      await fetchWalletData();

      return { proofs, tokenEvent: publishedTokenEvent };
    } catch (error) {
      console.error("Mint tokens failed:", error);
      throw error;
    }
  }, [publishTokenEvent, publishHistoryEvent, fetchWalletData]);

  // Melts tokens to pay a Lightning invoice
  const meltTokens = useCallback(async (mint: CashuMint, proofs: Proof[], invoice: string) => {
    try {
       // NIP-60 requires tracking which token events are spent. 
       // The melt operation itself might not directly provide this, but we know the input proofs come from existing token events.
       // We need to find the IDs of the token events corresponding to the proofs being melted.

      // Find the token events corresponding to the input proofs
      const inputTokenEvents = tokens.filter(tokenEvent => 
         tokenEvent.token.mint === mint.mintUrl && 
         tokenEvent.token.proofs.some(proof => proofs.some(inputProof => inputProof.secret === proof.secret))
      );

      const inputTokenEventIds = inputTokenEvents.map(event => event.id);

      const meltResult = await mint.melt({ proofs, invoice });

      const { preimage, amount } = meltResult as any; // Use 'any' temporarily if structure is unknown

      // Mark the input token events as spent by creating a new token event with a 'del' tag
      // As per NIP-60, spent tokens are indicated by referencing their event IDs in a new token event's 'e' tags (kind 7375).
      // We also mark them in our local store using markTokenSpent.
      const spentTokenEvent = await publishTokenEvent({ mint: mint.mintUrl, proofs: [] }, inputTokenEventIds);
      console.log("Published spent token event:", spentTokenEvent);

      // The markTokenSpent action needs to be called for each input token event ID
       inputTokenEventIds.forEach(tokenId => markTokenSpent(tokenId, spentTokenEvent.id));

       // Create and publish history event (Out)
       // The amount melted is returned by the mint
      await publishHistoryEvent({
        direction: "out",
        amount,
        description: `Paid invoice ${invoice.slice(0, 10)}...`,
        relatedEvents: [...inputTokenEventIds, spentTokenEvent.id], // Link to spent tokens and the new spent event
      });

       // Re-fetch wallet data to confirm spent status
       await fetchWalletData();

      return { preimage, amount, tokenEventIds: inputTokenEventIds };
    } catch (error) {
      console.error("Melt tokens failed:", error);
      throw error;
    }
  }, [publishTokenEvent, publishHistoryEvent, fetchWalletData, tokens, markTokenSpent]); // Added tokens and markTokenSpent to deps

   // Splits tokens into smaller amounts
   // Returns { send: Proof[], keep: Proof[] }
   const splitTokens = useCallback(async (mint: CashuMint, proofs: Proof[], amount: number) => {
      try {
        const result = await mint.split(proofs, [amount]); // Split into the requested amount and the rest
        return result;
      } catch (error) {
         console.error("Split tokens failed:", error);
         throw error;
      }
   }, []);

   // Verifies a token proof with the mint
   const verifyToken = useCallback(async (mint: CashuMint, proof: Proof) => {
      try {
         const result = await mint.verifyProof(proof);
         return result; // Returns boolean
      } catch (error) {
         console.error("Verify token failed:", error);
         // In a real app, you might handle different error types (e.g., proof already spent at mint)
         return false;
      }
   }, []);


  return {
    getMintClient,
    requestMintQuote,
    checkPaymentStatus,
    mintTokens,
    meltTokens,
    splitTokens,
    verifyToken,
  };
}
