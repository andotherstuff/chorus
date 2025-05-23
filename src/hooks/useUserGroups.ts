import { useNostr } from "./useNostr";
import { useCurrentUser } from "./useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import type { NostrEvent, NostrFilter } from "@nostrify/nostrify";
import { usePinnedGroups } from "./usePinnedGroups";
import { KINDS } from "@/lib/nostr-kinds";

// Helper function to get a unique community ID
function getCommunityId(community: NostrEvent): string {
  const dTag = community.tags.find(tag => tag[0] === "d");
  return `${KINDS.GROUP}:${community.pubkey}:${dTag ? dTag[1] : ""}`;
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

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(7000)]); // Increased timeout

      // Step 1: Directly fetch communities where the user is listed as a member
      // This query fetches approved members lists where the user is explicitly listed
      const membershipLists = await nostr.query(
        [{ kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST], "#p": [user.pubkey], limit: 100 }],
        { signal }
      );

      // Extract community IDs from the membership lists
      const communityIds = new Set<string>();
      for (const list of membershipLists) {
        const communityRef = list.tags.find(tag => tag[0] === "a");
        if (communityRef) {
          communityIds.add(communityRef[1]);
        }
      }

      // Step 2: Fetch all communities the user owns or is moderating
      const ownedModeratedCommunities = await nostr.query(
        [
          { kinds: [KINDS.GROUP], authors: [user.pubkey] }, // Owned
          { kinds: [KINDS.GROUP], "#p": [user.pubkey] },    // Possibly moderated
        ],
        { signal },
      );

      // Add these communities to our ID set as well
      for (const community of ownedModeratedCommunities) {
        const communityId = getCommunityId(community);
        communityIds.add(communityId);
      }

      // Step 3: Fetch all the community details for communities the user is part of
      // This includes communities where the user is a member, moderator, or owner
      const allCommunityIds = [...communityIds];
      
      // Break the query into batches if there are many communities
      const batchSize = 20;
      const communityBatches: string[][] = [];
      
      for (let i = 0; i < allCommunityIds.length; i += batchSize) {
        const batch = allCommunityIds.slice(i, i + batchSize);
        communityBatches.push(batch);
      }

      // Query all communities the user is part of
      let allCommunities: NostrEvent[] = [];
      
      // If there are communities to fetch, proceed
      if (communityBatches.length > 0) {
        // Make batch queries for community information
        const communityPromises = communityBatches.map(batch => {
          // For each community ID, we need to extract kind, pubkey, and identifier
          const filters: NostrFilter[] = batch.map(id => {
            const parts = id.split(":");
            if (parts.length === 3) {
              return {
                kinds: [parseInt(parts[0])], 
                authors: [parts[1]],
                "#d": [parts[2]]
              };
            }
            return { kinds: [0] }; // Fallback filter that won't match anything
          }).filter(f => f.kinds[0] !== 0); // Filter out any fallback filters
          
          return nostr.query(filters, { signal });
        });

        // Wait for all batches to complete
        const communityBatchResults = await Promise.all(communityPromises);
        allCommunities = communityBatchResults.flat();
      }

      // Also fetch communities the user has pinned
      if (pinnedGroups.length > 0) {
        const pinnedFilters = pinnedGroups.map(pinned => {
          const [kindStr, pubkey, identifier] = pinned.communityId.split(":");
          const kind = parseInt(kindStr, 10);
          return {
            kinds: [isNaN(kind) ? KINDS.GROUP : kind],
            authors: [pubkey],
            "#d": [identifier],
            limit: 1
          };
        });

        const pinnedCommunityEvents = await nostr.query(pinnedFilters, { signal });
        
        // Add to our all communities collection
        for (const event of pinnedCommunityEvents) {
          if (!allCommunities.some(c => c.id === event.id)) {
            allCommunities.push(event);
          }
        }
      }

      // Create a map of community IDs to community events for faster lookups
      const communityMap = new Map<string, NostrEvent>();
      for (const community of allCommunities) {
        const communityId = getCommunityId(community);
        communityMap.set(communityId, community);
      }

      // Categorize communities
      const ownedCommunities = allCommunities.filter(
        (community) => community.pubkey === user.pubkey
      );

      const moderatedCommunities = allCommunities.filter(
        (community) =>
          community.pubkey !== user.pubkey && // Not already counted as owned
          community.tags.some(tag =>
            tag[0] === "p" &&
            tag[1] === user.pubkey &&
            tag[3] === "moderator"
          )
      );

      // Step 4: Fetch all approved members lists for the communities we've found
      const approvedMembersLists = await nostr.query([
        {
          kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST],
          '#a': [...communityMap.keys()], // Use the community IDs
          '#p': [user.pubkey], // Only get lists that include the user
          limit: 200
        }
      ], { signal });

      // Create a set of community IDs where user is a member
      const memberCommunityIds = new Set<string>();
      
      for (const list of approvedMembersLists) {
        const communityRef = list.tags.find(tag => tag[0] === "a");
        if (communityRef) {
          const communityId = communityRef[1];
          const isUserIncluded = list.tags.some(tag => 
            tag[0] === "p" && tag[1] === user.pubkey
          );
          
          if (isUserIncluded) {
            memberCommunityIds.add(communityId);
          }
        }
      }

      // Find communities where user is just a member (not owner or moderator)
      const memberCommunities = allCommunities.filter(community => {
        const communityId = getCommunityId(community);
        return memberCommunityIds.has(communityId) && 
          !ownedCommunities.includes(community) &&
          !moderatedCommunities.includes(community);
      });

      // Process pinned groups
      const pinnedCommunities: NostrEvent[] = [];
      const processedInPinned = new Set<string>();

      for (const pinnedGroup of pinnedGroups) {
        const communityId = pinnedGroup.communityId;
        
        // Find the community in our fetched communities using the map
        for (const [id, community] of communityMap.entries()) {
          if (id === communityId) {
            pinnedCommunities.push(community);
            processedInPinned.add(id);
            break;
          }
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
      const allGroups = [...pinnedCommunities, ...filteredOwned, ...filteredModerated, ...filteredMember];

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
