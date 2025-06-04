import { useNostr } from '@/hooks/useNostr';
import { useEnhancedNostr } from '@/components/EnhancedNostrProvider';
import { useQuery } from '@tanstack/react-query';
import { CASHU_EVENT_KINDS } from '@/lib/cashu';
import { NostrEvent } from 'nostr-tools';
import { parseGroupRouteId } from '@/lib/group-utils';

/**
 * Hook to fetch nutzaps for a specific group
 * Supports both NIP-72 (public) and NIP-29 (private) groups
 */
export function useGroupNutzaps(groupId?: string) {
  const { nostr } = useNostr();
  const { nostr: enhancedNostr } = useEnhancedNostr();
  
  // Parse the group ID to determine type
  const parsedGroup = groupId ? parseGroupRouteId(groupId) : null;
  const isNip29 = parsedGroup?.type === 'nip29';

  return useQuery({
    queryKey: ['nutzaps', 'group', groupId],
    queryFn: async ({ signal }) => {
      if (!groupId) throw new Error('Group ID is required');

      // For NIP-29 groups, query from the specific relay with h tag
      // For NIP-72 groups, query from general relays with a tag
      if (isNip29 && parsedGroup && enhancedNostr) {
        const events = await enhancedNostr.query([
          { 
            kinds: [CASHU_EVENT_KINDS.ZAP], 
            '#h': [parsedGroup.groupId!], // NIP-29 uses h tag
            limit: 50 
          }
        ], { 
          signal,
          relays: [parsedGroup.relay!] // Query from the group's specific relay
        });
        return events.sort((a, b) => b.created_at - a.created_at);
      } else {
        // NIP-72 groups use a tag
        const events = await nostr.query([
          { 
            kinds: [CASHU_EVENT_KINDS.ZAP], 
            '#a': [groupId],
            limit: 50 
          }
        ], { signal });
        return events.sort((a, b) => b.created_at - a.created_at);
      }

    },
    enabled: (isNip29 ? !!enhancedNostr : !!nostr) && !!groupId
  });
}

/**
 * Hook to get the total amount of nutzaps for a group
 */
export function useGroupNutzapTotal(groupId?: string) {
  const { data: nutzaps, isLoading, error } = useGroupNutzaps(groupId);

  // Calculate total amount from all nutzaps
  const total = nutzaps?.reduce((acc, event) => {
    // Extract amount from proofs
    let eventTotal = 0;
    for (const tag of event.tags) {
      if (tag[0] === 'proof') {
        try {
          const proof = JSON.parse(tag[1]);
          eventTotal += proof.amount || 0;
        } catch (e) {
          console.error('Error parsing proof:', e);
        }
      }
    }
    return acc + eventTotal;
  }, 0) || 0;

  return {
    total,
    nutzaps,
    isLoading,
    error
  };
}