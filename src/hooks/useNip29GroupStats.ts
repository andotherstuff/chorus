import { useQuery } from "@tanstack/react-query";
import { useEnhancedNostr } from "@/components/EnhancedNostrProvider";
import { KINDS } from "@/lib/nostr-kinds";
import type { Nip29Group } from "@/types/groups";

export interface Nip29GroupStats {
  posts: number;
  participants: Set<string>;
}

/**
 * Hook to fetch and calculate statistics for NIP-29 groups
 * @param nip29Groups Array of NIP-29 groups to fetch stats for
 * @param enabled Whether the query should run
 * @returns Object with stats for each group indexed by group ID
 */
export function useNip29GroupStats(nip29Groups: Nip29Group[] | undefined, enabled = true) {
  const { nostr } = useEnhancedNostr();

  return useQuery({
    queryKey: ["nip29-group-stats", nip29Groups?.map(g => `${g.relay}:${g.groupId}`).join(",")],
    queryFn: async (c) => {
      if (!nip29Groups || nip29Groups.length === 0 || !nostr) {
        return {};
      }

      console.log(`[useNip29GroupStats] Fetching stats for ${nip29Groups.length} NIP-29 groups`);

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);
      const stats: Record<string, Nip29GroupStats> = {};

      // Initialize stats objects for all groups
      for (const group of nip29Groups) {
        const groupId = group.groupId;
        stats[groupId] = { posts: 0, participants: new Set<string>() };
      }

      // Process each group individually since they're on different relays
      await Promise.allSettled(
        nip29Groups.map(async (group) => {
          try {
            const groupId = group.groupId;
            const relayUrl = group.relay;
            
            console.log(`[useNip29GroupStats] Fetching stats for group ${groupId} from ${relayUrl}`);

            // 1. Get chat messages and posts (Kind 9 for chat, Kind 11 for posts, Kind 1 for posts)
            const postEvents = await nostr.query([{
              kinds: [
                KINDS.NIP29_CHAT_MESSAGE, // Kind 9 - chat messages
                KINDS.NIP29_GROUP_POST,   // Kind 11 - group posts
                KINDS.TEXT_NOTE           // Kind 1 - regular posts in group
              ],
              '#h': [groupId], // NIP-29 uses 'h' tag for group targeting
              limit: 200
            }], { 
              signal,
              relays: [relayUrl]
            });

            console.log(`[useNip29GroupStats] Found ${postEvents.length} posts/messages for group ${groupId}`);

            // Count posts and track participants
            for (const event of postEvents) {
              // Count as posts (both chat messages and posts count as activity)
              stats[groupId].posts++;
              // Add author to participants
              stats[groupId].participants.add(event.pubkey);
            }

            // 2. Get reactions and other activity events that might target this group
            const activityEvents = await nostr.query([{
              kinds: [
                KINDS.REACTION,   // Kind 7 - reactions
                KINDS.ZAP,        // Kind 9735 - zaps
                // Add other NIP-29 specific kinds that might exist
                9001, 9002, 9003, 9004, 9005, 9006, 9007 // Common NIP-29 administrative kinds
              ],
              '#h': [groupId],
              limit: 100
            }], { 
              signal,
              relays: [relayUrl]
            });

            console.log(`[useNip29GroupStats] Found ${activityEvents.length} activity events for group ${groupId}`);

            // Process activity events to track participants
            for (const event of activityEvents) {
              stats[groupId].participants.add(event.pubkey);
            }

            // 3. Add group admins and members to participant count
            if (group.admins) {
              for (const admin of group.admins) {
                stats[groupId].participants.add(admin);
              }
            }
            if (group.members) {
              for (const member of group.members) {
                stats[groupId].participants.add(member);
              }
            }

            console.log(`[useNip29GroupStats] Group ${groupId} final stats: ${stats[groupId].posts} posts, ${stats[groupId].participants.size} participants`);
          } catch (error) {
            console.error(`[useNip29GroupStats] Error fetching stats for group ${group.groupId} from ${group.relay}:`, error);
            // Keep the initialized empty stats for this group
          }
        })
      );

      console.log(`[useNip29GroupStats] Completed stats fetch for ${nip29Groups.length} groups`);
      return stats;
    },
    enabled: !!nostr && !!nip29Groups && nip29Groups.length > 0 && enabled,
    staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes (NIP-29 is more dynamic)
    gcTime: 5 * 60 * 1000, // Keep in memory for 5 minutes
    retry: 1, // Fewer retries since NIP-29 relays might be less reliable
  });
}