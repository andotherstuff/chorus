import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CASHU_EVENT_KINDS } from '@/lib/cashu';
import { Proof } from '@cashu/cashu-ts';
import { useNutzapStore, NutzapInformationalEvent } from '@/stores/nutzapStore';

/**
 * Hook to fetch a recipient's nutzap information
 */
export function useFetchNutzapInfo() {
  const { nostr } = useNostr();
  const nutzapStore = useNutzapStore();

  // Mutation to fetch and store nutzap info
  const fetchNutzapInfoMutation = useMutation({
    mutationFn: async (recipientPubkey: string): Promise<NutzapInformationalEvent> => {
      // First check if we have it in the store
      const storedInfo = nutzapStore.getNutzapInfo(recipientPubkey);
      if (storedInfo) {
        return storedInfo;
      }

      // Otherwise fetch it from the network
      const events = await nostr.query([
        { kinds: [CASHU_EVENT_KINDS.ZAPINFO], authors: [recipientPubkey], limit: 1 }
      ], { signal: AbortSignal.timeout(5000) });

      if (events.length === 0) {
        throw new Error('Recipient has no nutzap informational event');
      }

      const event = events[0];

      // Parse the nutzap informational event
      const relays = event.tags
        .filter(tag => tag[0] === 'relay')
        .map(tag => tag[1]);

      const mints = event.tags
        .filter(tag => tag[0] === 'mint')
        .map(tag => {
          const url = tag[1];
          const units = tag.slice(2); // Get additional unit markers if any
          return { url, units: units.length > 0 ? units : undefined };
        });

      const p2pkPubkeyTag = event.tags.find(tag => tag[0] === 'pubkey');
      if (!p2pkPubkeyTag) {
        throw new Error('No pubkey tag found in the nutzap informational event');
      }

      const p2pkPubkey = p2pkPubkeyTag[1];

      const nutzapInfo: NutzapInformationalEvent = {
        event,
        relays,
        mints,
        p2pkPubkey
      };

      // Store the info for future use
      nutzapStore.setNutzapInfo(recipientPubkey, nutzapInfo);

      return nutzapInfo;
    }
  });

  return {
    fetchNutzapInfo: fetchNutzapInfoMutation.mutateAsync,
    isFetching: fetchNutzapInfoMutation.isPending,
    error: fetchNutzapInfoMutation.error
  };
}

/**
 * Hook to create and send nutzap events
 */
export function useSendNutzap() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Mutation to create and send a nutzap event
  const sendNutzapMutation = useMutation({
    mutationFn: async ({
      recipientInfo,
      comment = '',
      proofs,
      mintUrl,
      eventId,
      relayHint
    }: {
      recipientInfo: NutzapInformationalEvent;
      comment?: string;
      proofs: Proof[];
      mintUrl: string;
      eventId?: string; // Event being nutzapped (optional)
      relayHint?: string; // Hint for relay where the event can be found
    }) => {
      if (!user) throw new Error('User not logged in');

      // Verify the mint is in the recipient's trusted list
      const recipientMints = recipientInfo.mints.map(mint => mint.url);
      if (!recipientMints.includes(mintUrl)) {
        throw new Error(`Recipient does not accept tokens from mint: ${mintUrl}`);
      }

      // Create tags for the nutzap event
      const tags = [
        // Add proofs
        ...proofs.map(proof => ['proof', JSON.stringify(proof)]),

        // Add mint URL
        ['u', mintUrl],

        // Add recipient pubkey
        ['p', recipientInfo.event.pubkey],
      ];

      // Add event tag if specified
      if (eventId) {
        tags.push(['e', eventId, relayHint || '']);
      }

      // Create the nutzap event
      const event = await user.signer.signEvent({
        kind: CASHU_EVENT_KINDS.ZAP,
        content: comment,
        tags,
        created_at: Math.floor(Date.now() / 1000)
      });

      // Publish the event to the recipient's relays
      await nostr.event(event);

      if (eventId) {
        queryClient.invalidateQueries({ queryKey: ['nutzaps', eventId] });
      }

      // Return the event
      return {
        event,
        recipientInfo
      };
    }
  });

  return {
    sendNutzap: sendNutzapMutation.mutateAsync,
    isSending: sendNutzapMutation.isPending,
    error: sendNutzapMutation.error
  };
} 