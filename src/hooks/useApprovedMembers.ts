import { useNostr } from "@nostrify/react";
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

  console.log("[useApprovedMembers] Starting with:", {
    communityId,
    groupFound: !!group,
    groupPubkey: group?.pubkey,
    groupTags: group?.tags
  });

  const groupModsKey = group?.tags
    .filter(tag => tag[0] === "p" && tag[3] === "moderator")
    .map(([, value]) => value).join(",") || "";

  // Query for approved members list
  const { data: approvedMembersEvents, isLoading } = useQuery({
    queryKey: ["approved-members-list", communityId, groupModsKey],
    queryFn: async (c) => {
      if (!group) {
        console.log("[useApprovedMembers] No group found, aborting query");
        throw new Error("Group not found");
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const moderators = new Set<string>([group.pubkey]);

      for (const tag of group.tags) {
        if (tag[0] === "p" && tag[3] === "moderator") {
          moderators.add(tag[1]);
        }
      }
      
      // Extract the identifier from the communityId for NIP-72 groups
      let dTagValue = communityId;
      
      // Parse different community ID formats
      if (communityId.includes(":")) {
        const parts = communityId.split(":");
        console.log("[useApprovedMembers] Parsing community ID:", {
          original: communityId,
          parts,
          partsCount: parts.length
        });
        
        // Handle different formats:
        // nip72:34550:pubkey:identifier
        // 34550:pubkey:identifier  
        if (parts.length >= 3) {
          // Get the last part as the identifier
          dTagValue = parts[parts.length - 1];
        } else if (parts.length === 2) {
          // Might be pubkey:identifier format
          dTagValue = parts[1];
        }
      }
      
      console.log("[useApprovedMembers] Querying approved members with filter:", {
        kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST],
        authors: [...moderators],
        "#d": [dTagValue],
        moderatorCount: moderators.size,
        originalCommunityId: communityId,
        extractedDTag: dTagValue
      });
      
      const events = await nostr.query([{ 
        kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST],
        authors: [...moderators],
        "#d": [dTagValue],
      }], { signal });
      
      console.log("[useApprovedMembers] Approved members events received:", {
        count: events.length,
        events: events.map(e => ({
          id: e.id,
          author: e.pubkey,
          dTag: e.tags.find(t => t[0] === "d")?.[1],
          memberTags: e.tags.filter(t => t[0] === "p").length,
          allTags: e.tags
        }))
      });
      
      // If no events found, let's check with alternate d-tag formats
      if (events.length === 0) {
        console.log("[useApprovedMembers] No events found with simple d-tag, trying full format...");
        
        // Try with the full a-tag format as d-tag
        const fullDTag = `${KINDS.GROUP}:${group.pubkey}:${dTagValue}`;
        const eventsWithFullTag = await nostr.query([{ 
          kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST],
          authors: [...moderators],
          "#d": [fullDTag],
        }], { signal });
        
        console.log("[useApprovedMembers] Results with full d-tag format:", {
          fullDTag,
          count: eventsWithFullTag.length
        });
        
        if (eventsWithFullTag.length > 0) {
          return eventsWithFullTag;
        }
        
        // Also check if there are ANY kind 34551 events from these moderators
        console.log("[useApprovedMembers] Checking for ANY kind 34551 from moderators...");
        const anyEvents = await nostr.query([{ 
          kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST],
          authors: [...moderators],
          limit: 5
        }], { signal });
        
        console.log("[useApprovedMembers] ANY kind 34551 events from moderators:", {
          count: anyEvents.length,
          samples: anyEvents.map(e => ({
            id: e.id,
            dTag: e.tags.find(t => t[0] === "d")?.[1],
            memberCount: e.tags.filter(t => t[0] === "p").length
          }))
        });
      }
      
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

  console.log("[useApprovedMembers] Final results:", {
    communityId,
    approvedMembersCount: approvedMembers.length,
    moderatorsCount: moderators.length,
    approvedMembers: approvedMembers.slice(0, 5), // Show first 5 for brevity
    moderators
  });

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