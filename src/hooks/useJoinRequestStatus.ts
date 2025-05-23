import { useNostr } from "./useNostr";
import { useCurrentUser } from "./useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { KINDS } from "@/lib/nostr-kinds";

/**
 * Hook to check the status of a user's join request for a community
 * @param communityId The community ID to check
 * @returns Object containing status information
 */
export function useJoinRequestStatus(communityId?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  // Check if user has a pending join request
  const { data: hasPendingRequest, isLoading: isCheckingRequest } = useQuery({
    queryKey: ["join-request", communityId, user?.pubkey],
    queryFn: async (c) => {
      if (!user || !communityId || !nostr) return false;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{
        kinds: [KINDS.GROUP_JOIN_REQUEST],
        authors: [user.pubkey],
        "#a": [communityId]
      }], { signal });

      return events.length > 0;
    },
    enabled: !!nostr && !!user && !!communityId,
  });

  // Check if user is an approved member
  const { data: isApprovedMember, isLoading: isCheckingApproval } = useQuery({
    queryKey: ["approved-member", communityId, user?.pubkey],
    queryFn: async (c) => {
      if (!user || !communityId || !nostr) return false;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{
        kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST],
        "#d": [communityId]
      }], { signal });

      // Check if any of the approval lists include the user's pubkey
      return events.some(event =>
        event.tags.some(tag => tag[0] === "p" && tag[1] === user.pubkey)
      );
    },
    enabled: !!nostr && !!user && !!communityId,
  });
  
  // Check if user is in the declined list
  const { data: isDeclinedUser, isLoading: isCheckingDeclined } = useQuery({
    queryKey: ["declined-user", communityId, user?.pubkey],
    queryFn: async (c) => {
      if (!user || !communityId || !nostr) return false;
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{ 
        kinds: [KINDS.GROUP_DECLINED_MEMBERS_LIST], 
        "#d": [communityId],
        "#p": [user.pubkey]
      }], { signal });
      
      return events.length > 0;
    },
    enabled: !!nostr && !!user && !!communityId,
  });

  return {
    hasPendingRequest: hasPendingRequest || false,
    isApprovedMember: isApprovedMember || false,
    isDeclinedUser: isDeclinedUser || false,
    isLoading: isCheckingRequest || isCheckingApproval || isCheckingDeclined
  };
}