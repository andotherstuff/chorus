import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { parseNostrAddress } from "@/lib/nostr-utils";

/**
 * Hook to fetch the count of pending posts in a community
 * @param communityId The community ID to fetch pending posts for
 */
export function usePendingPostsCount(communityId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ["pending-posts-count", communityId],
    queryFn: async (c) => {
      if (!communityId) return 0;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Parse the community ID to get the pubkey and identifier
      const parsedId = communityId.includes(':')
        ? parseNostrAddress(communityId)
        : null;

      if (!parsedId) return 0;

      // Get posts that tag the community
      const posts = await nostr.query([{
        kinds: [11],
        "#a": [communityId],
        limit: 100,
      }], { signal });

      // Get approval events
      const approvals = await nostr.query([{
        kinds: [4550],
        "#a": [communityId],
        limit: 100,
      }], { signal });

      // Get removal events
      const removals = await nostr.query([{
        kinds: [4551],
        "#a": [communityId],
        limit: 100,
      }], { signal });

      // Get approved members list
      const approvedMembersEvents = await nostr.query([{
        kinds: [14550],
        "#a": [communityId],
        limit: 10,
      }], { signal });

      // Get community details to get moderators
      const communityEvent = await nostr.query([{
        kinds: [34550],
        authors: [parsedId.pubkey],
        "#d": [parsedId.identifier],
      }], { signal });

      // Extract approved members pubkeys
      const approvedMembers = approvedMembersEvents.flatMap(event =>
        event.tags.filter(tag => tag[0] === "p").map(tag => tag[1])
      );

      // Extract moderator pubkeys
      const moderators = communityEvent[0]?.tags
        .filter(tag => tag[0] === "p" && tag[3] === "moderator")
        .map(tag => tag[1]) || [];

      // Get the community owner (creator) pubkey
      const communityOwnerPubkey = communityEvent[0]?.pubkey || "";

      // Extract the approved post IDs
      const approvedPostIds = approvals.map(approval => {
        const eventTag = approval.tags.find(tag => tag[0] === "e");
        return eventTag ? eventTag[1] : null;
      }).filter((id): id is string => id !== null);

      // Extract the removed post IDs
      const removedPostIds = removals.map(removal => {
        const eventTag = removal.tags.find(tag => tag[0] === "e");
        return eventTag ? eventTag[1] : null;
      }).filter((id): id is string => id !== null);

      // Filter out posts that are:
      // 1. Already approved
      // 2. Removed
      // 3. Posted by the community owner (auto-approved)
      // 4. Posted by approved members (auto-approved)
      // 5. Posted by moderators (auto-approved)
      // 6. Replies (kind 1111)
      const pendingPosts = posts.filter(post => {
        // Skip if post is a reply
        if (post.kind === 1111) {
          return false;
        }

        // Skip if post is already approved
        if (approvedPostIds.includes(post.id)) {
          return false;
        }

        // Skip if post is removed
        if (removedPostIds.includes(post.id)) {
          return false;
        }

        // Skip if author is the community owner
        if (post.pubkey === communityOwnerPubkey) {
          return false;
        }

        // Skip if author is an approved member or moderator
        if (approvedMembers.includes(post.pubkey) || moderators.includes(post.pubkey)) {
          return false;
        }

        return true;
      });

      // Debug logging
      // console.log("Pending posts count calculation:", {
      //   totalPosts: posts.length,
      //   approvedPostIds,
      //   removedPostIds,
      //   communityOwner: communityOwnerPubkey,
      //   approvedMembers,
      //   moderators,
      //   pendingPostsLength: pendingPosts.length,
      //   pendingPosts: pendingPosts.map(p => ({ id: p.id, pubkey: p.pubkey, kind: p.kind }))
      // });

      return pendingPosts.length;
    },
    enabled: !!nostr && !!communityId,
    staleTime: 30000, // Cache for 30 seconds to reduce duplicate queries
  });
}
