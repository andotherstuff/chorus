import { useNostr } from "@jsr/nostrify__react";
import { useQuery } from "@tanstack/react-query";
import { parseNostrAddress } from "@/lib/nostr-utils";
import { KINDS } from "@/lib/nostr-kinds";
import { useGroup } from "./useGroup";

/**
 * Hook to fetch and check approved members for a community
 * @param communityId The community ID to check approved members for
 */
export function useApprovedMembers(communityId: string) {
  const { nostr } = useNostr();
  const { data: group } = useGroup(communityId);

  const groupModsKey = group?.tags
    .filter(tag => tag[0] === "p" && tag[3] === "moderator")
    .map(([, value]) => value).join(",") || "";

  // Query for approved members list
  const { data: approvedMembersEvents, isLoading } = useQuery({
    queryKey: ["approved-members-list", communityId, groupModsKey],
    queryFn: async (c) => {
      if (!group) {
        throw new Error("Group not found");
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const moderators = new Set<string>([group.pubkey]);

      for (const tag of group.tags) {
        if (tag[0] === "p" && tag[3] === "moderator") {
          moderators.add(tag[1]);
        }
      }
      
      const events = await nostr.query([{ 
        kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST],
        authors: [...moderators],
        "#d": [communityId],
      }], { signal });
      
      return events;
    },
    enabled: !!group && !!communityId,
  });

  // Query for community details to get moderators
  const { data: communityEvent } = useQuery({
    queryKey: ["community-details", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Parse the community ID to get the pubkey and identifier
      const parsedId = communityId.includes(':') 
        ? parseNostrAddress(communityId)
        : null;
      
      if (!parsedId) return null;
      
      const events = await nostr.query([{ 
        kinds: [KINDS.GROUP],
        authors: [parsedId.pubkey],
        "#d": [parsedId.identifier],
      }], { signal });
      
      return events[0] || null;
    },
    enabled: !!nostr && !!communityId,
  });

  // Extract approved members pubkeys
  const approvedMembers = approvedMembersEvents?.flatMap(event => 
    event.tags.filter(tag => tag[0] === "p").map(tag => tag[1])
  ) || [];

  // Extract moderator pubkeys
  const moderators = communityEvent?.tags
    .filter(tag => tag[0] === "p" && tag[3] === "moderator")
    .map(tag => tag[1]) || [];

  /**
   * Check if a user is an approved member or moderator
   * @param pubkey The pubkey to check
   * @returns boolean indicating if the user is approved
   */
  const isApprovedMember = (pubkey: string): boolean => {
    return approvedMembers.includes(pubkey) || moderators.includes(pubkey);
  };

  return {
    approvedMembers,
    moderators,
    isApprovedMember,
    isLoading
  };
}