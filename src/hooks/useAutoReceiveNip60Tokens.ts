import { useEffect, useRef, useCallback } from 'react';
import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCashuWallet } from '@/hooks/useCashuWallet';
import { useCashuStore, Nip60TokenEvent } from '@/stores/cashuStore';
import { CASHU_EVENT_KINDS, CashuToken, calculateBalance } from '@/lib/cashu';
import { getLastEventTimestamp, updateLastEventTimestamp } from '@/lib/nostrTimestamps';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Proof } from '@cashu/cashu-ts';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { useCashuToken } from '@/hooks/useCashuToken';
import { formatBalance } from '@/lib/cashu';
import { useBitcoinPrice, satsToUSD, formatUSD } from '@/hooks/useBitcoinPrice';
import { useCurrencyDisplayStore } from '@/stores/currencyDisplayStore';

/**
 * Hook that automatically receives NIP-60 token events (kind 7375) when the wallet is loaded
 * and sets up real-time subscriptions for incoming token events
 */
export function useAutoReceiveNip60Tokens() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { wallet } = useCashuWallet();
  const cashuStore = useCashuStore();
  const queryClient = useQueryClient();
  const { cleanSpentProofs } = useCashuToken();
  const { showSats } = useCurrencyDisplayStore();
  const { data: btcPrice } = useBitcoinPrice();

  // Keep track of processed event IDs to avoid duplicates
  const processedEventIds = useRef<Set<string>>(new Set());
  const subscriptionController = useRef<AbortController | null>(null);

  // Format amount based on user preference
  const formatAmount = useCallback((sats: number) => {
    if (showSats) {
      return formatBalance(sats);
    } else if (btcPrice) {
      return formatUSD(satsToUSD(sats, btcPrice.USD));
    }
    return formatBalance(sats);
  }, [showSats, btcPrice]);

  // Process a new token event
  const processTokenEvent = useCallback(async (event: NostrEvent) => {
    if (!user || processedEventIds.current.has(event.id)) {
      return;
    }

    processedEventIds.current.add(event.id);

    try {
      // Decrypt the token content
      if (!user.signer.nip44) {
        throw new Error('NIP-44 encryption not supported by your signer');
      }

      const decrypted = await user.signer.nip44.decrypt(user.pubkey, event.content);
      const tokenData = JSON.parse(decrypted) as CashuToken;

      console.log('Processing NIP-60 token event:', event.id, tokenData);

      // Calculate balance before changes
      const balancesBefore = calculateBalance(cashuStore.proofs);
      const totalBefore = Object.values(balancesBefore).reduce((sum, balance) => sum + balance, 0);

      // Handle deletions first if present
      if (tokenData.del && Array.isArray(tokenData.del)) {
        console.log('Processing deletions for event IDs:', tokenData.del);

        for (const eventIdToDelete of tokenData.del) {
          // Get all proofs associated with this event ID
          const proofsToCheck = cashuStore.getProofsByEventId(eventIdToDelete);

          // Filter out proofs that are NOT in the new token's proofs
          const proofsToRemove = proofsToCheck.filter(oldProof =>
            !tokenData.proofs.some(newProof =>
              newProof.secret === oldProof.secret &&
              newProof.C === oldProof.C
            )
          );

          if (proofsToRemove.length > 0) {
            console.log(`Removing ${proofsToRemove.length} proofs from deleted event ${eventIdToDelete}`);
            cashuStore.removeProofs(proofsToRemove);
          }
        }
      }

      // Add the new proofs to the store
      cashuStore.addProofs(tokenData.proofs, event.id);

      // Clean spent proofs for the mint
      if (tokenData.mint) {
        try {
          await cleanSpentProofs(tokenData.mint);
        } catch (error) {
          console.error('Error cleaning spent proofs:', error);
        }
      }

      // Calculate balance after changes
      const balancesAfter = calculateBalance(cashuStore.proofs);
      const totalAfter = Object.values(balancesAfter).reduce((sum, balance) => sum + balance, 0);
      const balanceChange = totalAfter - totalBefore;

      // Update the last processed timestamp
      updateLastEventTimestamp(user.pubkey, CASHU_EVENT_KINDS.TOKEN, event.created_at);

      // // Show notification with balance change
      // if (balanceChange !== 0) {
      //   const changeText = balanceChange > 0 
      //     ? `You have received ${formatAmount(balanceChange)}`
      //     : `You have sent ${formatAmount(Math.abs(balanceChange))}`;

      //   toast.info('Wallet synchronized', {
      //     description: changeText,
      //     duration: 3000,
      //   });
      // } else {
      //   // Only show sync message if proofs were updated but balance didn't change
      //   if (tokenData.proofs.length > 0 || (tokenData.del && tokenData.del.length > 0)) {
      //     toast.info('Wallet synchronized', {
      //       description: `${tokenData.proofs.length} proofs updated`,
      //       duration: 3000,
      //     });
      //   }
      // }

      // Invalidate the tokens query to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['cashu', 'tokens', user.pubkey] });

    } catch (error) {
      console.error('Failed to process NIP-60 token event:', error);
    }
  }, [user, cashuStore, queryClient, cleanSpentProofs, formatAmount]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user || !wallet) return;

    // Cancel any existing subscription
    if (subscriptionController.current) {
      subscriptionController.current.abort();
    }

    // Create new abort controller
    subscriptionController.current = new AbortController();
    const signal = subscriptionController.current.signal;

    // Get the last timestamp of token events
    const lastTimestamp = getLastEventTimestamp(user.pubkey, CASHU_EVENT_KINDS.TOKEN);

    // Create subscription filter
    const filter: NostrFilter = {
      kinds: [CASHU_EVENT_KINDS.TOKEN],
      authors: [user.pubkey],
    };

    // Add since filter if we have a last timestamp
    if (lastTimestamp) {
      filter.since = lastTimestamp + 1;
    }

    // Start real-time subscription
    const subscribeToTokenEvents = async () => {
      try {
        // Query for token events
        const events = await nostr.query([filter], { signal });

        // Sort events by created_at to process them in order
        const sortedEvents = events.sort((a, b) => a.created_at - b.created_at);

        for (const event of sortedEvents) {
          await processTokenEvent(event);
        }

        // Update the filter for next poll to only get newer events
        if (sortedEvents.length > 0) {
          const lastEvent = sortedEvents[sortedEvents.length - 1];
          filter.since = lastEvent.created_at + 1;
        }

        // Set up polling interval for continuous updates
        if (!signal.aborted) {
          setTimeout(subscribeToTokenEvents, 10000); // Poll every 10 seconds
        }
      } catch (error) {
        if (!signal.aborted) {
          console.error("Error in NIP-60 token subscription:", error);
          // Retry after delay
          setTimeout(subscribeToTokenEvents, 15000);
        }
      }
    };

    // Start subscription
    subscribeToTokenEvents();

    // Cleanup on unmount
    return () => {
      if (subscriptionController.current) {
        subscriptionController.current.abort();
        subscriptionController.current = null;
      }
    };
  }, [user, wallet, nostr, processTokenEvent]);

  return {
    // No need to expose anything for now
  };
}