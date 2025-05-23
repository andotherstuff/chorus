import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { NostrEvent } from "@nostrify/nostrify";
import { KINDS } from "@/lib/nostr-kinds";

export interface GroupStats {
  posts: number;
  participants: Set<string>;
}

/**
 * Hook to fetch and calculate statistics for Nostr groups
 * @param communities Array of community events to fetch stats for
 * @param enabled Whether the query should run
 * @returns Object with stats for each community indexed by communityId
 */
export function useGroupStats(communities: NostrEvent[] | undefined, enabled = true) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ["group-stats", communities?.map(c => c.id).join(",")],
    queryFn: async (c) => {
      if (!communities || communities.length === 0 || !nostr) {
        return {};
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);
      const stats: Record<string, GroupStats> = {};

      // Create a filter for all communities to get posts in a single query
      const communityRefs = communities.map(community => {
        const dTag = community.tags.find(tag => tag[0] === "d");
        return `${KINDS.GROUP}:${community.pubkey}:${dTag ? dTag[1] : ""}`;
      });

      // Initialize stats objects for all communities
      for (const communityId of communityRefs) {
        stats[communityId] = { posts: 0, participants: new Set<string>() };
      }

      // 1. Get all posts (Kind 1, 11, 1111) that reference any community
      const posts = await nostr.query([{
        kinds: [KINDS.TEXT_NOTE, KINDS.GROUP_POST, KINDS.GROUP_POST_REPLY],
        "#a": communityRefs,
        limit: 500
      }], { signal });

      // Process posts to count them and track participants
      for (const post of posts) {
        const communityTag = post.tags.find(tag => tag[0] === "a");
        if (!communityTag) continue;

        const communityId = communityTag[1];
        if (!stats[communityId]) continue;

        // Count posts (Kind 1, 11, 1111)
        stats[communityId].posts++;
        // Add author to participants
        stats[communityId].participants.add(post.pubkey);
      }

      // 2. Get reactions (Kind 7) that reference posts in communities
      const reactions = await nostr.query([{
        kinds: [KINDS.REACTION],
        "#a": communityRefs,
        limit: 500
      }], { signal });

      // Process reactions to track participants
      for (const reaction of reactions) {
        const communityTag = reaction.tags.find(tag => tag[0] === "a");
        if (!communityTag) continue;

        const communityId = communityTag[1];
        if (!stats[communityId]) continue;

        // Add reactor to participants
        stats[communityId].participants.add(reaction.pubkey);
      }

      // 3. Get zaps (Kind 9735) that reference posts in communities
      const zaps = await nostr.query([{
        kinds: [KINDS.ZAP],
        "#a": communityRefs,
        limit: 500
      }], { signal });

      // Process zaps to track participants
      for (const zap of zaps) {
        const communityTag = zap.tags.find(tag => tag[0] === "a");
        if (!communityTag) continue;

        const communityId = communityTag[1];
        if (!stats[communityId]) continue;

        // Add zapper to participants
        stats[communityId].participants.add(zap.pubkey);
      }

      // 4. Get join requests for communities
      const joinRequests = await nostr.query([{
        kinds: [KINDS.GROUP_JOIN_REQUEST],
        "#a": communityRefs,
        limit: 500
      }], { signal });

      // Process join requests to track participants
      for (const request of joinRequests) {
        const communityTag = request.tags.find(tag => tag[0] === "a");
        if (!communityTag) continue;

        const communityId = communityTag[1];
        if (!stats[communityId]) continue;

        // Add requester to participants
        stats[communityId].participants.add(request.pubkey);
      }

      // 5. Get reports (Kind 1984) for communities
      const reports = await nostr.query([{
        kinds: [KINDS.REPORT],
        "#a": communityRefs,
        limit: 500
      }], { signal });

      // Process reports to track participants
      for (const report of reports) {
        const communityTag = report.tags.find(tag => tag[0] === "a");
        if (!communityTag) continue;

        const communityId = communityTag[1];
        if (!stats[communityId]) continue;

        // Add reporter to participants
        stats[communityId].participants.add(report.pubkey);
      }

      // 6. Get pinned groups (Kind 14553)
      const pinnedGroups = await nostr.query([{
        kinds: [KINDS.PINNED_GROUPS_LIST],
        "#d": communityRefs,
        limit: 500
      }], { signal });

      // Process pinned groups to track participants
      for (const pinned of pinnedGroups) {
        const communityTag = pinned.tags.find(tag => tag[0] === "a");
        if (!communityTag) continue;

        const communityId = communityTag[1];
        if (!stats[communityId]) continue;

        // Add user who pinned to participants
        stats[communityId].participants.add(pinned.pubkey);
      }

      // 7. Add moderators from community definitions (Kind 34550)
      for (const community of communities) {
        const dTag = community.tags.find(tag => tag[0] === "d");
        const communityId = `${KINDS.GROUP}:${community.pubkey}:${dTag ? dTag[1] : ""}`;
        
        if (!stats[communityId]) continue;
        
        // Add community creator to participants
        stats[communityId].participants.add(community.pubkey);
        
        // Add all moderators to participants
        for (const tag of community.tags) {
          if (tag[0] === "p" && tag[3] === "moderator") {
            stats[communityId].participants.add(tag[1]);
          }
        }
      }

      return stats;
    },
    enabled: !!nostr && !!communities && communities.length > 0 && enabled,
  });
}