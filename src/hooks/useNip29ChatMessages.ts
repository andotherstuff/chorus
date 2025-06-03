import { useQuery } from '@tanstack/react-query';
import { useEnhancedNostr } from '@/components/EnhancedNostrProvider';
import { NostrEvent } from '@nostrify/nostrify';

export interface Nip29ChatMessage extends NostrEvent {
  groupId: string;
  relayUrl: string;
}

interface UseNip29ChatMessagesOptions {
  groupId: string;
  relayUrl: string;
  enabled?: boolean;
  limit?: number;
}

export function useNip29ChatMessages({
  groupId,
  relayUrl,
  enabled = true,
  limit = 50
}: UseNip29ChatMessagesOptions) {
  const { nostr } = useEnhancedNostr();

  return useQuery({
    queryKey: ['nip29-chat-messages', groupId, relayUrl, limit],
    queryFn: async (c) => {
      if (!nostr) throw new Error('Enhanced Nostr provider not available');

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);

      // Query for kind 11 events (NIP-29 group posts/chat messages) with the h tag for this group
      const events = await nostr.query([{
        kinds: [11], // NIP-29 group posts/chat messages
        '#h': [groupId], // Events targeting this group
        limit
      }], {
        signal,
        relays: [relayUrl] // Query from the specific NIP-29 relay
      });

      // Sort by created_at desc (newest first)
      const sortedEvents = events.sort((a, b) => b.created_at - a.created_at);

      // Transform to include group metadata
      const chatMessages: Nip29ChatMessage[] = sortedEvents.map(event => ({
        ...event,
        groupId,
        relayUrl
      }));

      return chatMessages;
    },
    enabled: enabled && !!nostr && !!groupId && !!relayUrl,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 10 * 1000, // Poll every 10 seconds for new messages
    retry: 2,
  });
}