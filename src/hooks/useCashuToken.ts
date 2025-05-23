import { useState } from 'react';
import { useCashuStore } from '@/stores/cashuStore';
import { useCashuWallet } from '@/hooks/useCashuWallet';
import { useCashuHistory } from '@/hooks/useCashuHistory';
import { CashuMint, CashuWallet, Proof, getEncodedTokenV4, getDecodedToken, CheckStateEnum } from '@cashu/cashu-ts';
import { CashuProof, CashuToken } from '@/lib/cashu';
import { hashToCurve } from "@cashu/crypto/modules/common";
import { useNutzapStore } from '@/stores/nutzapStore';

export function useCashuToken() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cashuStore = useCashuStore();
  const { wallet, createWallet, updateProofs } = useCashuWallet();

  const { createHistory } = useCashuHistory();
  const nutzapStore = useNutzapStore();

  /**
   * Generate a send token
   * @param mintUrl The URL of the mint to use
   * @param amount Amount to send in satoshis
   * @param p2pkPubkey The P2PK pubkey to lock the proofs to
   * @returns The encoded token string for regular tokens, or Proof[] for nutzap tokens
   */
  const sendToken = async (mintUrl: string, amount: number, p2pkPubkey?: string): Promise<Proof[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const mint = new CashuMint(mintUrl);
      const wallet = new CashuWallet(mint);

      // Load mint keysets
      await wallet.loadMint();

      // Get all proofs from store
      let proofs = await cashuStore.getMintProofs(mintUrl);

      const proofsAmount = proofs.reduce((sum, p) => sum + p.amount, 0);
      if (proofsAmount < amount) {
        throw new Error(`Not enough funds on mint ${mintUrl}`);
      }

      try {
        // For regular token, create a token string
        // Perform coin selection
        const { keep: proofsToKeep, send: proofsToSend } = await wallet.send(amount, proofs, { pubkey: p2pkPubkey, privkey: cashuStore.privkey });

        // Create new token for the proofs we're keeping
        if (proofsToKeep.length > 0) {
          const keepTokenData: CashuToken = {
            mint: mintUrl,
            proofs: proofsToKeep.map(p => ({
              id: p.id || '',
              amount: p.amount,
              secret: p.secret || '',
              C: p.C || ''
            }))
          };

          // update proofs
          await updateProofs({ mintUrl, proofsToAdd: keepTokenData.proofs, proofsToRemove: [...proofsToSend, ...proofs] });

          // Create history event
          await createHistory({
            direction: 'out',
            amount: amount.toString(),
          });
        }
        return proofsToSend;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        
        // Check if error is "Token already spent"
        if (message.includes("Token already spent")) {
          console.log("Detected spent tokens, cleaning up and retrying...");
          
          // Clean spent proofs
          await cleanSpentProofs(mintUrl);
          
          // Get fresh proofs after cleanup
          proofs = await cashuStore.getMintProofs(mintUrl);
          
          // Check if we still have enough funds after cleanup
          const newProofsAmount = proofs.reduce((sum, p) => sum + p.amount, 0);
          if (newProofsAmount < amount) {
            throw new Error(`Not enough funds on mint ${mintUrl} after cleaning spent proofs`);
          }
          
          // Retry the send operation with fresh proofs
          const { keep: proofsToKeep, send: proofsToSend } = await wallet.send(amount, proofs, { pubkey: p2pkPubkey, privkey: cashuStore.privkey });

          // Create new token for the proofs we're keeping
          if (proofsToKeep.length > 0) {
            const keepTokenData: CashuToken = {
              mint: mintUrl,
              proofs: proofsToKeep.map(p => ({
                id: p.id || '',
                amount: p.amount,
                secret: p.secret || '',
                C: p.C || ''
              }))
            };

            // update proofs
            await updateProofs({ mintUrl, proofsToAdd: keepTokenData.proofs, proofsToRemove: [...proofsToSend, ...proofs] });

            // Create history event
            await createHistory({
              direction: 'out',
              amount: amount.toString(),
            });
          }
          return proofsToSend;
        }
        
        // Re-throw the error if it's not a "Token already spent" error
        throw error;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(`Failed to generate token: ${message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }

  };

  const addMintIfNotExists = async (mintUrl: string) => {
    // Validate URL
    new URL(mintUrl);
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    // Add mint to wallet
    createWallet({
      ...wallet,
      mints: [...wallet.mints, mintUrl],
    });
  }

  /**
   * Receive a token
   * @param token The encoded token string
   * @returns The received proofs
   */
  const receiveToken = async (token: string): Promise<Proof[]> => {
    setIsLoading(true);
    setError(null);

    try {
      // Decode token
      const decodedToken = getDecodedToken(token);
      if (!decodedToken) {
        throw new Error('Invalid token format');
      }

      const { mint: mintUrl, proofs: tokenProofs } = decodedToken;

      // if we don't have the mintUrl yet, add it
      await addMintIfNotExists(mintUrl);

      // Setup wallet for receiving
      const mint = new CashuMint(mintUrl);
      const wallet = new CashuWallet(mint);

      // Load mint keysets
      await wallet.loadMint();

      // Receive proofs from token
      const receivedProofs = await wallet.receive(token);
      // Create token event in Nostr
      const receivedTokenData: CashuToken = {
        mint: mintUrl,
        proofs: receivedProofs.map(p => ({
          id: p.id || '',
          amount: p.amount,
          secret: p.secret || '',
          C: p.C || ''
        }))
      };

      try {
        // Attempt to create token in Nostr, but don't rely on the return value
        await updateProofs({ mintUrl, proofsToAdd: receivedTokenData.proofs, proofsToRemove: [] });
      } catch (err) {
        console.error('Error storing token in Nostr:', err);
      }

      // Create history event
      const totalAmount = receivedProofs.reduce((sum, p) => sum + p.amount, 0);
      await createHistory({
        direction: 'in',
        amount: totalAmount.toString(),
      });

      return receivedProofs;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(`Failed to receive token: ${message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const cleanSpentProofs = async (mintUrl: string) => {
    setIsLoading(true);
    setError(null);

    const mint = new CashuMint(mintUrl);
    const wallet = new CashuWallet(mint);

    await wallet.loadMint();

    const proofs = await cashuStore.getMintProofs(mintUrl);

    const proofStates = await wallet.checkProofsStates(proofs);
    const spentProofsStates = proofStates.filter(
      (p) => p.state == CheckStateEnum.SPENT
    );
    const enc = new TextEncoder();
    const spentProofs = proofs.filter((p) =>
      spentProofsStates.find(
        (s) => s.Y == hashToCurve(enc.encode(p.secret)).toHex(true)
      )
    );

    await updateProofs({ mintUrl, proofsToAdd: [], proofsToRemove: spentProofs });

    return spentProofs;
  }

  return {
    sendToken,
    receiveToken,
    cleanSpentProofs,
    isLoading,
    error
  };
} 