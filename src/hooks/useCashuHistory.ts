import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CASHU_EVENT_KINDS, SpendingHistoryEntry } from '@/lib/cashu';
import { getLastEventTimestamp } from '@/lib/nostrTimestamps';
import { useTransactionHistoryStore } from '@/stores/transactionHistoryStore';

/**
 * Hook to fetch and manage the user's Cashu spending history
 */
export function useCashuHistory() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const transactionHistoryStore = useTransactionHistoryStore();

  // Create spending history event
  const createHistoryMutation = useMutation({
    mutationFn: async ({
      direction,
      amount,
      createdTokens = [],
      destroyedTokens = [],
      redeemedTokens = []
    }: {
      direction: 'in' | 'out';
      amount: string;
      createdTokens?: string[];
      destroyedTokens?: string[];
      redeemedTokens?: string[];
    }) => {
      if (!user) throw new Error('User not logged in');
      if (!user.signer.nip44) {
        throw new Error('NIP-44 encryption not supported by your signer');
      }

      // Prepare content data
      const contentData = [
        ['direction', direction],
        ['amount', amount],
        ...createdTokens.map(id => ['e', id, '', 'created']),
        ...destroyedTokens.map(id => ['e', id, '', 'destroyed'])
      ];

      // Encrypt content
      const content = await user.signer.nip44.encrypt(
        user.pubkey,
        JSON.stringify(contentData)
      );

      // Create history event with unencrypted redeemed tags
      const event = await user.signer.signEvent({
        kind: CASHU_EVENT_KINDS.HISTORY,
        content,
        tags: redeemedTokens.map(id => ['e', id, '', 'redeemed']),
        created_at: Math.floor(Date.now() / 1000)
      });

      // Publish event
      await nostr.event(event);

      // Add to transaction history store
      const historyEntry: SpendingHistoryEntry & { id: string } = {
        id: event.id,
        direction,
        amount,
        timestamp: event.created_at,
        createdTokens,
        destroyedTokens,
        redeemedTokens
      };
      transactionHistoryStore.addHistoryEntry(historyEntry);

      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashu', 'history', user?.pubkey] });
    }
  });

  const historyQuery = useQuery({
    queryKey: ['cashu', 'history', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user) throw new Error('User not logged in');
      if (!user.signer.nip44) {
        throw new Error('NIP-44 encryption not supported by your signer');
      }

      // Get the last stored timestamp for the HISTORY event kind
      const lastTimestamp = getLastEventTimestamp(user.pubkey, CASHU_EVENT_KINDS.HISTORY);

      // Create the filter with 'since' if a timestamp exists
      const filter = {
        kinds: [CASHU_EVENT_KINDS.HISTORY],
        authors: [user.pubkey],
        limit: 100
      };

      // Add the 'since' property if we have a previous timestamp
      if (lastTimestamp) {
        Object.assign(filter, { since: lastTimestamp });
      }

      const events = await nostr.query([filter], { signal });

      if (events.length === 0) {
        return [];
      }

      const history: (SpendingHistoryEntry & { id: string })[] = [];

      for (const event of events) {
        try {
          // Decrypt content
          const decrypted = await user.signer.nip44.decrypt(user.pubkey, event.content);
          const contentData = JSON.parse(decrypted) as Array<string[]>;

          // Extract data from content
          const entry: SpendingHistoryEntry & { id: string } = {
            id: event.id,
            direction: 'in',
            amount: '0',
            timestamp: event.created_at,
            createdTokens: [],
            destroyedTokens: [],
            redeemedTokens: []
          };

          // Process content data
          for (const item of contentData) {
            const [key, value] = item;
            const marker = item.length >= 4 ? item[3] : undefined;

            if (key === 'direction') {
              entry.direction = value as 'in' | 'out';
            } else if (key === 'amount') {
              entry.amount = value;
            } else if (key === 'e' && marker === 'created') {
              entry.createdTokens?.push(value);
            } else if (key === 'e' && marker === 'destroyed') {
              entry.destroyedTokens?.push(value);
            }
          }

          // Process unencrypted tags
          for (const tag of event.tags) {
            if (tag[0] === 'e' && tag[3] === 'redeemed') {
              entry.redeemedTokens?.push(tag[1]);
            }
          }

          history.push(entry);

          // Add to transaction history store
          transactionHistoryStore.addHistoryEntry(entry);
        } catch (error) {
          console.error('Failed to decrypt history data:', error);
        }
      }

      // Sort by timestamp (newest first)
      return history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    },
    enabled: !!user && !!user.signer.nip44
  });

  return {
    history: historyQuery.data || [],
    isLoading: historyQuery.isLoading,
    createHistory: createHistoryMutation.mutate
  };
}