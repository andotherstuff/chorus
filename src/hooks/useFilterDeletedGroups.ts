import { useMemo } from "react";
import { useGroupDeletionRequests } from "./useGroupDeletionRequests";
import type { NostrEvent } from "@jsr/nostrify__nostrify";
import { KINDS } from "@/lib/nostr-kinds";

// Helper function to get a unique community ID
function getCommunityId(community: NostrEvent): string {
  const dTag = community.tags.find(tag => tag[0] === "d");
  return `${KINDS.GROUP}:${community.pubkey}:${dTag ? dTag[1] : ""}`;
}

/**
 * Hook to filter out deleted groups from a list of groups
 * @param groups Array of group events to filter
 * @returns Filtered array with deleted groups removed
 */
export function useFilterDeletedGroups(groups: NostrEvent[] | undefined) {
  // Get group IDs for deletion checking
  const groupIds = useMemo(() => {
    if (!groups) return [];
    return groups.map(getCommunityId);
  }, [groups]);

  // Check for deletion requests
  const { data: deletionRequests } = useGroupDeletionRequests(groupIds);

  // Filter out deleted groups
  const filteredGroups = useMemo(() => {
    if (!groups || !deletionRequests) {
      return groups;
    }

    return groups.filter(group => {
      const groupId = getCommunityId(group);
      const deletionRequest = deletionRequests.get(groupId);
      return !(deletionRequest?.isValid || false);
    });
  }, [groups, deletionRequests]);

  return filteredGroups;
}