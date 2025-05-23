import { useNostr } from "./useNostr";
import { useCurrentUser } from "./useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { KINDS } from "@/lib/nostr-kinds";

/**
 * Hook to get all communities where the current user has pending join requests
 * @returns Array of community IDs where user has pending requests
 */
export function useUserPendingJoinRequests() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ["user-pending-join-requests", user?.pubkey],
    queryFn: async (c) => {
      if (!user || !nostr) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Get all join requests from the current user
      const joinRequestEvents = await nostr.query([{
        kinds: [KINDS.GROUP_JOIN_REQUEST],
        authors: [user.pubkey]
      }], { signal });

      // Extract community IDs from the join requests
      const communityIds = new Set<string>();
      
      for (const event of joinRequestEvents) {
        const aTag = event.tags.find(tag => tag[0] === "a");
        if (aTag && aTag[1]) {
          communityIds.add(aTag[1]);
        }
      }

      // For each community, check if the user is already approved or declined
      const pendingCommunityIds: string[] = [];
      
      for (const communityId of communityIds) {
        // Check if user is in approved members list
        const approvedEvents = await nostr.query([{
          kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST],
          "#a": [communityId]
        }], { signal });

        const isApproved = approvedEvents.some(event =>
          event.tags.some(tag => tag[0] === "p" && tag[1] === user.pubkey)
        );

        // Check if user is in declined members list
        const declinedEvents = await nostr.query([{
          kinds: [KINDS.GROUP_DECLINED_MEMBERS_LIST],
          "#a": [communityId],
          "#p": [user.pubkey]
        }], { signal });

        const isDeclined = declinedEvents.length > 0;

        // If not approved and not declined, it's still pending
        if (!isApproved && !isDeclined) {
          pendingCommunityIds.push(communityId);
        }
      }

      return pendingCommunityIds;
    },
    enabled: !!nostr && !!user,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });
}