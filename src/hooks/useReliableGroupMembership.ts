import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import { parseNostrAddress } from "@/lib/nostr-utils";
import { KINDS } from "@/lib/nostr-kinds";

/**
 * Hook to reliably check if the current user is a member of a group
 * @param communityId The community ID to check membership for
 */
export function useReliableGroupMembership(communityId?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ["reliable-group-membership", communityId, user?.pubkey],
    queryFn: async (c) => {
      if (!user || !communityId || !nostr) return {
        isOwner: false,
        isModerator: false,
        isMember: false,
        isLoading: false
      };
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Parse the community ID to get the pubkey and identifier
      const parsedId = communityId.includes(':') 
        ? parseNostrAddress(communityId)
        : null;
      
      if (!parsedId) return {
        isOwner: false,
        isModerator: false,
        isMember: false,
        isLoading: false
      };
      
      // Fetch the community event
      const communityEvents = await nostr.query([{ 
        kinds: [KINDS.GROUP],
        authors: [parsedId.pubkey],
        "#d": [parsedId.identifier],
      }], { signal });
      
      if (communityEvents.length === 0) return {
        isOwner: false,
        isModerator: false,
        isMember: false,
        isLoading: false
      };
      
      const community = communityEvents[0];
      
      // Check if user is the owner
      const isOwner = community.pubkey === user.pubkey;
      
      // Check if user is a moderator
      const isModerator = community.tags.some(
        tag => tag[0] === "p" && tag[1] === user.pubkey && tag[3] === "moderator"
      );
      
      // If user is owner or moderator, they're automatically a member
      if (isOwner || isModerator) {
        return {
          isOwner,
          isModerator,
          isMember: true,
          isLoading: false
        };
      }
      
      // Check for approved members lists that include the user
      const memberEvents = await nostr.query([{ 
        kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST],
        "#d": [communityId],
        limit: 10,
      }], { signal });
      
      // Check if any of the approval lists include the user's pubkey
      const isMember = memberEvents.some(event =>
        event.tags.some(tag => tag[0] === "p" && tag[1] === user.pubkey)
      );
      
      return {
        isOwner,
        isModerator,
        isMember,
        isLoading: false
      };
    },
    enabled: !!nostr && !!communityId && !!user,
  });
}