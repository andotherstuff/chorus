import { useNostr } from "@nostrify/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useWalletStore, NIP60_KINDS, type WalletInfo, type CashuTokenEvent, type HistoryEntry } from "../stores/walletStore";
import { useCallback } from "react";

export function useNip60Wallet() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { info, tokens, history, setWalletInfo, addTokenEvent, addHistoryEntry, markTokenSpent, setInitialized, setSyncing, setError } = useWalletStore();

  const fetchWalletData = useCallback(async () => {
    if (!nostr || !user?.pubkey) {
      setError("Nostr not available or user not logged in.");
      setInitialized(false);
      return;
    }

    setSyncing(true);
    setError(undefined);

    try {
      const filters = [
        { // Wallet Info (kind 17375)
          kinds: [NIP60_KINDS.WALLET_INFO],
          authors: [user.pubkey],
          limit: 1, // We only expect one replaceable event
        },
        { // All Tokens (kind 7375)
          kinds: [NIP60_KINDS.TOKEN],
          authors: [user.pubkey],
        },
        { // All History (kind 7376)
          kinds: [NIP60_KINDS.HISTORY],
          authors: [user.pubkey],
        },
      ];

      console.log("Fetching NIP-60 events for user:", user.pubkey, "with filters:", filters);

      const events = await nostr.query(filters);
      console.log("Fetched events:", events);

      // Process fetched events
      let latestWalletInfo: WalletInfo | undefined;
      const fetchedTokenEvents: CashuTokenEvent[] = [];
      const fetchedHistoryEntries: HistoryEntry[] = [];

      for (const event of events) {
        try {
          if (event.kind === NIP60_KINDS.WALLET_INFO) {
            const parsedInfo = JSON.parse(event.content) as WalletInfo;
            if (!latestWalletInfo || event.created_at > (latestWalletInfo as any).created_at) {
                 latestWalletInfo = { ...parsedInfo };
            }
          } else if (event.kind === NIP60_KINDS.TOKEN) {
            const parsedToken = JSON.parse(event.content);
            if (parsedToken.mint && Array.isArray(parsedToken.proofs)) {
               fetchedTokenEvents.push({
                id: event.id,
                token: parsedToken,
                createdAt: event.created_at,
                spent: false, // Assume unspent for now
              });
            }
          } else if (event.kind === NIP60_KINDS.HISTORY) {
            const parsedHistory = JSON.parse(event.content);
             if (parsedHistory.direction && parsedHistory.amount !== undefined) {
                fetchedHistoryEntries.push({
                id: event.id,
                ...parsedHistory,
                 relatedEvents: event.tags.filter((tag: string[]) => tag[0] === 'e').map((tag: string[]) => tag[1]),
                createdAt: event.created_at,
              });
            }
          }
        } catch (e) {
          console.error("Error processing event:", event, e);
          setError("Error processing fetched wallet data.");
        }
      }

      // Update store with fetched data
      if (latestWalletInfo) {
        setWalletInfo(latestWalletInfo);
      }
      // Add new token and history events to the store, avoiding duplicates
      fetchedTokenEvents.forEach(addTokenEvent);
      fetchedHistoryEntries.forEach(addHistoryEntry);

      // Mark tokens as spent based on history entries after adding all events
      fetchedHistoryEntries.forEach(entry => {
         entry.relatedEvents.forEach(relatedId => {
           // Check if relatedId corresponds to a token event ID that we fetched or already have in the store
            const tokenToMark = fetchedTokenEvents.find(t => t.id === relatedId) || tokens.find(t => t.id === relatedId);
            if(tokenToMark && !tokenToMark.spent) { // Only mark if it's not already marked spent
              console.log(`Marking token event ${tokenToMark.id} as spent by history event ${entry.id}`);
              markTokenSpent(tokenToMark.id, entry.id);
            }
         });
      });

      setInitialized(true);
      setSyncing(false);

    } catch (error) {
      console.error("Error fetching NIP-60 wallet data:", error);
      setError(`Failed to fetch wallet data: ${error.message || error}`);
      setSyncing(false);
      setInitialized(false);
    }
  }, [nostr, user, setWalletInfo, addTokenEvent, addHistoryEntry, markTokenSpent, tokens, setInitialized, setSyncing, setError]);

  // Publishes a Nostr event according to NIP-60 spec
  const publishWalletEvent = useCallback(async (kind: typeof NIP60_KINDS[keyof typeof NIP60_KINDS], content: any, tags: string[][] = []) => {
     if (!nostr || !user?.pubkey) {
      setError("Nostr not available or user not logged in.");
      throw new Error("Cannot publish event: User not logged in or Nostr not available.");
    }

     setSyncing(true);
     setError(undefined);

    try {
      const event = {
        kind,
        content: JSON.stringify(content),
        created_at: Math.floor(Date.now() / 1000),
        tags: [ ...tags, ['t', 'cashu']], // Add the 'cashu' tag as per NIP-60
        pubkey: user.pubkey, // Ensure pubkey is set
      };

       console.log("Publishing event:", event);

      // Assuming nostr.event handles signing and publishing
      const signedEvent = await nostr.event(event as any);
      console.log("Published event:", signedEvent);

      setSyncing(false);
      return signedEvent;
    } catch (error) {
      console.error("Error publishing event:", error);
       setError(`Failed to publish event: ${error.message || error}`);
       setSyncing(false);
      throw error;
    }
    }, [nostr, user, setSyncing, setError]);

  // Specific publish functions for each NIP-60 kind
  const publishWalletInfoEvent = useCallback(async (walletInfo: WalletInfo) => {
    return publishWalletEvent(NIP60_KINDS.WALLET_INFO, walletInfo);
  }, [publishWalletEvent]);

  const publishTokenEvent = useCallback(async (tokenEntry: CashuTokenEvent, spentTokenEventIds: string[] = []) => {
     const tags: string[][] = spentTokenEventIds.map(id => ['e', id]);
     return publishWalletEvent(NIP60_KINDS.TOKEN, tokenEntry, tags);
  }, [publishWalletEvent]);

  const publishHistoryEvent = useCallback(async (historyEntry: Omit<HistoryEntry, 'id' | 'createdAt'>) => {
     const tags: string[][] = historyEntry.relatedEvents.map(id => ['e', id]);
     return publishWalletEvent(NIP60_KINDS.HISTORY, { 
       direction: historyEntry.direction,
       amount: historyEntry.amount,
       description: historyEntry.description
     }, tags);
  }, [publishWalletEvent]);


  return {
    fetchWalletData,
    publishWalletInfoEvent,
    publishTokenEvent,
    publishHistoryEvent,
  };
}
