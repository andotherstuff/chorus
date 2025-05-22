import { useNostr } from "./useNostr";
import { useCurrentUser } from "./useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import type { NostrEvent } from "@nostrify/nostrify";
import { usePinnedGroups, PinnedGroup } from "./usePinnedGroups";

// Helper function to get a unique community ID
function getCommunityId(community: NostrEvent): string {
  const dTag = community.tags.find(tag => tag[0] === "d");
  return `34550:${community.pubkey}:${dTag ? dTag[1] : ""}`;
}

export function useUserGroups() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { pinnedGroups, isLoading: isPinnedGroupsLoading } = usePinnedGroups();

  return useQuery({
    queryKey: ["user-groups", user?.pubkey, pinnedGroups],
    queryFn: async (c) => {
      if (!user || !nostr) return {
        pinned: [] as NostrEvent[],
        owned: [] as NostrEvent[],
        moderated: [] as NostrEvent[],
        member: [] as NostrEvent[],
        allGroups: [] as NostrEvent[] // Added to track all groups the user is part of
      };

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Fetch all communities
      const allCommunities = await nostr.query(
        [
          { kinds: [34550], '#p': [user.pubkey] },
          { kinds: [34550], authors: [user.pubkey] },
        ],
        { signal },
      );

      // Create a map of community IDs to community events for faster lookups
      const communityMap = new Map<string, NostrEvent>();
      for (const community of allCommunities) {
        const communityId = getCommunityId(community);
        communityMap.set(communityId, community);
      }

      // Owned communities (where user is the creator)
      const ownedCommunities = allCommunities.filter(
        (community) => community.pubkey === user.pubkey
      );

      // Moderated communities (where user is listed as a moderator)
      const moderatedCommunities = allCommunities.filter(
        (community) =>
          community.pubkey !== user.pubkey && // Not already counted as owned
          community.tags.some(tag =>
            tag[0] === "p" &&
            tag[1] === user.pubkey &&
            tag[3] === "moderator"
          )
      );

      // Fetch all approved members lists
      const approvedMembersLists = await nostr.query([
        {
          kinds: [14550],
          '#a': [...communityMap.keys()], // Use the keys from the community map
          limit: 200
        }
      ], { signal });

      // Create a map of community IDs to their approved members lists
      const communityMembersMap = new Map<string, string[]>();

      for (const list of approvedMembersLists) {
        const communityRef = list.tags.find(tag => tag[0] === "a");
        if (communityRef) {
          const communityId = communityRef[1];
          const memberPubkeys = list.tags
            .filter(tag => tag[0] === "p")
            .map(tag => tag[1]);

          communityMembersMap.set(communityId, memberPubkeys);
        }
      }

      // Communities where user is an approved member
      const memberCommunities: NostrEvent[] = [];

      // Check each community to see if the user is a member
      for (const community of allCommunities) {
        // Skip if already in owned or moderated
        if (ownedCommunities.includes(community) || moderatedCommunities.includes(community)) {
          continue;
        }

        const communityId = getCommunityId(community);
        const membersList = communityMembersMap.get(communityId);

        if (membersList?.includes(user.pubkey)) {
          memberCommunities.push(community);
        }
      }

      // Process pinned groups
      const pinnedCommunities: NostrEvent[] = [];

      // Track which communities have been processed for each category
      const processedInPinned = new Set<string>();

      // Process pinned groups first
      for (const pinnedGroup of pinnedGroups) {
        const [_, pubkey, identifier] = pinnedGroup.communityId.split(":");

        // Find the community in our fetched communities
        const community = allCommunities.find(c => {
          const dTag = c.tags.find(tag => tag[0] === "d");
          return c.pubkey === pubkey && dTag && dTag[1] === identifier;
        });

        if (community) {
          pinnedCommunities.push(community);

          // Mark this community as processed in pinned
          const communityId = getCommunityId(community);
          processedInPinned.add(communityId);
        }
      }

      // Filter out pinned communities from other lists to avoid duplicates
      const filteredOwned = ownedCommunities.filter(community => {
        const communityId = getCommunityId(community);
        return !processedInPinned.has(communityId);
      });

      const filteredModerated = moderatedCommunities.filter(community => {
        const communityId = getCommunityId(community);
        return !processedInPinned.has(communityId);
      });

      const filteredMember = memberCommunities.filter(community => {
        const communityId = getCommunityId(community);
        return !processedInPinned.has(communityId);
      });

      // Create a list of all unique groups the user is part of
      const allGroups = [...pinnedCommunities];

      // Add other categories ensuring no duplicates
      for (const community of [...filteredOwned, ...filteredModerated, ...filteredMember]) {
        const communityId = getCommunityId(community);
        if (!processedInPinned.has(communityId)) {
          allGroups.push(community);
        }
      }

      return {
        pinned: pinnedCommunities,
        owned: filteredOwned,
        moderated: filteredModerated,
        member: filteredMember,
        allGroups // Include all unique groups
      };
    },
    enabled: !!nostr && !!user,
  });
}
