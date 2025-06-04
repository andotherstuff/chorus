import { useEnhancedNostr } from "@/components/EnhancedNostrProvider";
import { useQuery } from "@tanstack/react-query";
import type { NostrEvent } from "@nostrify/nostrify";

/**
 * Hook to find the original creator of a NIP-29 group by querying for the GROUP_CREATE event
 * @param groupId The group ID to look up
 * @param relay The relay URL where the group was created
 * @returns The creator's pubkey and the GROUP_CREATE event, or null if not found
 */
export function useNip29GroupCreator(groupId: string | undefined, relay: string | undefined) {
  const { nostr } = useEnhancedNostr();

  return useQuery({
    queryKey: ["nip29-group-creator", groupId, relay],
    queryFn: async (c) => {
      if (!nostr || !groupId || !relay) {
        return null;
      }

      console.log(`[NIP-29] Looking for GROUP_CREATE event for group ${groupId} on ${relay}`);
      
      try {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

        // Query for GROUP_CREATE events (kind 9007)
        // These are user-generated events that create a group
        const events = await nostr.query([{
          kinds: [9007], // GROUP_CREATE
          limit: 100 // Get more events to find the right one
        }], { 
          signal,
          relays: [relay]
        });

        console.log(`[NIP-29] Found ${events.length} GROUP_CREATE events`);

        // Look through the events to find one that created this specific group
        // The GROUP_CREATE event may contain the group name in tags
        for (const event of events) {
          // Check if this event has tags that match our group
          const nameTag = event.tags.find(tag => tag[0] === 'name');
          const aboutTag = event.tags.find(tag => tag[0] === 'about');
          
          // Try to match by checking subsequent events
          // After a GROUP_CREATE, the relay should generate a kind 39000 event
          // We need to correlate these events
          
          // For now, we'll look for GROUP_CREATE events and try to match them
          // This is a heuristic approach since the GROUP_CREATE doesn't directly contain the group ID
          
          // Check if there are any admin events (kind 9000) from this pubkey for this group
          const adminCheckSignal = AbortSignal.any([c.signal, AbortSignal.timeout(2000)]);
          const adminEvents = await nostr.query([{
            kinds: [9000], // GROUP_ADD_USER (admin events)
            authors: [event.pubkey],
            "#h": [groupId],
            limit: 1
          }], {
            signal: adminCheckSignal,
            relays: [relay]
          });

          if (adminEvents.length > 0) {
            console.log(`[NIP-29] Found potential creator: ${event.pubkey}`);
            return {
              creatorPubkey: event.pubkey,
              createEvent: event,
              createdAt: event.created_at
            };
          }
        }

        // Alternative approach: Query for the first admin event for this group
        // The first person to be added as admin is likely the creator
        const firstAdminSignal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
        const adminEvents = await nostr.query([{
          kinds: [9000], // GROUP_ADD_USER
          "#h": [groupId],
          limit: 100
        }], {
          signal: firstAdminSignal,
          relays: [relay]
        });

        if (adminEvents.length > 0) {
          // Sort by timestamp to find the earliest
          const sortedEvents = adminEvents.sort((a, b) => a.created_at - b.created_at);
          const firstAdminEvent = sortedEvents[0];
          
          // The author of the first admin event is likely the creator
          console.log(`[NIP-29] Found first admin event by: ${firstAdminEvent.pubkey}`);
          return {
            creatorPubkey: firstAdminEvent.pubkey,
            createEvent: null, // We don't have the actual CREATE event
            createdAt: firstAdminEvent.created_at,
            isInferred: true // This is inferred, not from an actual CREATE event
          };
        }

        console.log(`[NIP-29] Could not find creator for group ${groupId}`);
        return null;
      } catch (error) {
        console.error(`[NIP-29] Error finding group creator:`, error);
        return null;
      }
    },
    enabled: !!nostr && !!groupId && !!relay,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });
}

/**
 * Hook to check if a user is the creator/owner of a NIP-29 group
 * @param groupId The group ID to check
 * @param relay The relay URL where the group exists
 * @param pubkey The pubkey to check ownership for
 */
export function useIsNip29GroupOwner(groupId: string | undefined, relay: string | undefined, pubkey: string | undefined) {
  const { data: creatorInfo } = useNip29GroupCreator(groupId, relay);

  if (!pubkey || !creatorInfo) {
    return false;
  }

  return creatorInfo.creatorPubkey === pubkey;
}