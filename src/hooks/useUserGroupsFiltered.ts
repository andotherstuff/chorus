import { useMemo } from "react";
import { useUserGroups } from "./useUserGroups";
import { useGroupDeletionRequests } from "./useGroupDeletionRequests";
import type { NostrEvent } from "@jsr/nostrify__nostrify";
import { KINDS } from "@/lib/nostr-kinds";

// Helper function to get a unique community ID
function getCommunityId(community: NostrEvent): string {
  const dTag = community.tags.find(tag => tag[0] === "d");
  return `${KINDS.GROUP}:${community.pubkey}:${dTag ? dTag[1] : ""}`;
}

/**
 * Hook that returns user's groups filtered to exclude deleted groups
 */
export function useUserGroupsFiltered() {
  const userGroupsQuery = useUserGroups();
  
  // Get group IDs for deletion checking
  const groupIds = useMemo(() => {
    if (!userGroupsQuery.data?.allGroups) return [];
    return userGroupsQuery.data.allGroups.map(getCommunityId);
  }, [userGroupsQuery.data?.allGroups]);

  // Check for deletion requests
  const { data: deletionRequests } = useGroupDeletionRequests(groupIds);

  // Filter out deleted groups
  const filteredData = useMemo(() => {
    if (!userGroupsQuery.data || !deletionRequests) {
      return userGroupsQuery.data;
    }

    const isGroupDeleted = (community: NostrEvent) => {
      const groupId = getCommunityId(community);
      const deletionRequest = deletionRequests.get(groupId);
      return deletionRequest?.isValid || false;
    };

    const filterGroups = (groups: NostrEvent[]) => 
      groups.filter(group => !isGroupDeleted(group));

    return {
      pinned: filterGroups(userGroupsQuery.data.pinned),
      owned: filterGroups(userGroupsQuery.data.owned),
      moderated: filterGroups(userGroupsQuery.data.moderated),
      member: filterGroups(userGroupsQuery.data.member),
      allGroups: filterGroups(userGroupsQuery.data.allGroups)
    };
  }, [userGroupsQuery.data, deletionRequests]);

  return {
    ...userGroupsQuery,
    data: filteredData
  };
}