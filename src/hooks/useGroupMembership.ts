import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import { KINDS } from "@/lib/nostr-kinds";

/**
 * Hook to check if the current user is a member of a group
 * @param communityId The community ID to check membership for
 */
export function useGroupMembership(communityId?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ["group-membership", communityId, user?.pubkey],
    queryFn: async (c) => {
      if (!user || !communityId) return false;
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Check for approved members lists that include the user
      const events = await nostr.query([{ 
        kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST],
        "#a": [communityId],
        "#p": [user.pubkey],
        limit: 1,
      }], { signal });
      
      return events.length > 0;
    },
    enabled: !!nostr && !!communityId && !!user,
  });
}