import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CASHU_EVENT_KINDS } from '@/lib/cashu';


/**
 * Hook to handle NIP-61 Nutzap redemption events
 */
export function useNutzapRedemption() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Create a redemption event for one or more nutzap events
  const createRedemptionMutation = useMutation({
    mutationFn: async ({
      nutzapEventIds,
      direction,
      amount,
      createdTokenEventId
    }: {
      nutzapEventIds: string[];
      direction: 'in' | 'out';
      amount: string;
      createdTokenEventId: string;
    }) => {
      if (!user) throw new Error('User not logged in');
      if (!user.signer.nip44) {
        throw new Error('NIP-44 encryption not supported by your signer');
      }

      // Prepare content data for the encrypted part
      const contentData = [
        ['direction', direction],
        ['amount', amount],
        ['e', createdTokenEventId, '', 'created'] // The token event created by the redemption
      ];

      // Encrypt the content data
      const encryptedContent = await user.signer.nip44.encrypt(
        user.pubkey,
        JSON.stringify(contentData)
      );

      // Create unencrypted tags for the event
      const tags = [
        // Add e-tags for each redeemed nutzap event
        ...nutzapEventIds.map(id => ['e', id, '', 'redeemed']),
      ];

      // Add sender pubkeys as p-tags if available
      const senderPubkeys = await Promise.all(
        nutzapEventIds.map(async (id) => {
          try {
            const events = await nostr.query([{ ids: [id], limit: 1 }], {
              signal: AbortSignal.timeout(2000)
            });
            return events[0]?.pubkey;
          } catch (error) {
            console.error(`Failed to fetch nutzap event ${id}:`, error);
            return null;
          }
        })
      );

      // Add p-tags for senders
      senderPubkeys
        .filter(Boolean)
        .forEach(pubkey => {
          tags.push(['p', pubkey as string]);
        });

      // Create redemption event
      const event = await user.signer.signEvent({
        kind: CASHU_EVENT_KINDS.HISTORY, // 7376
        content: encryptedContent,
        tags,
        created_at: Math.floor(Date.now() / 1000)
      });

      // Publish event to relays
      await nostr.event(event);

      return event;
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['cashu', 'history', user?.pubkey] });
    }
  });

  return {
    createRedemption: createRedemptionMutation.mutate,
    isCreatingRedemption: createRedemptionMutation.isPending
  };
} 