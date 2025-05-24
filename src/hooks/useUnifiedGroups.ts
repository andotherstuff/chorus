import { useNostr } from "./useNostr";
import { useEnhancedNostr } from "@/components/EnhancedNostrProvider";
import { useCurrentUser } from "./useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import type { NostrEvent, NostrFilter } from "@nostrify/nostrify";
import type { Group } from "@/types/groups";
import { parseGroup, getCommunityId } from "@/lib/group-utils";
import { usePinnedGroups } from "./usePinnedGroups";
import { useNip29Groups } from "./useNip29Groups";

export function useUnifiedGroups() {
  const { nostr } = useNostr();
  const { nostr: enhancedNostr } = useEnhancedNostr();
  const { user } = useCurrentUser();
  const { pinnedGroups, isLoading: isPinnedGroupsLoading } = usePinnedGroups();

  // Define NIP-29 relays to query for public groups
  const nip29Relays = [
    'wss://communities.nos.social/',
    // 'wss://relays.groups.nip29.com', // Temporarily disabled - causing crashes
    'wss://groups.fiatjaf.com'
  ];

  // Fetch NIP-29 groups from multiple relays
  const { data: nip29Groups = [], isLoading: isNip29Loading } = useNip29Groups(nip29Relays);

  return useQuery({
    queryKey: ["unified-groups", user?.pubkey, pinnedGroups, nip29Groups],
    queryFn: async (c) => {
      if (!nostr) return {
        pinned: [] as Group[],
        owned: [] as Group[],
        moderated: [] as Group[],
        member: [] as Group[],
        allGroups: [] as Group[],
        nip72Events: [] as NostrEvent[]
      };

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);

      console.log('[Groups] Fetching unified groups');

      // Fetch NIP-72 communities using the base nostr provider (uses NIP-72 relays)
      const nip72Communities = await nostr.query([
        { kinds: [34550], limit: 100 }
      ], { signal });

      console.log(`[NIP-72] Found ${nip72Communities.length} communities`);

      // Parse all events into unified Group format
      const allGroups: Group[] = [];
      
      // Parse NIP-72 communities
      for (const event of nip72Communities) {
        const group = parseGroup(event);
        if (group) {
          allGroups.push(group);
        }
      }

      // Add NIP-29 groups from the separate hook
      allGroups.push(...nip29Groups);

      console.log(`[Groups] Total groups: ${allGroups.length} (${nip72Communities.length} NIP-72 + ${nip29Groups.length} NIP-29)`);

      if (!user) {
        return {
          pinned: [] as Group[],
          owned: [] as Group[],
          moderated: [] as Group[],
          member: [] as Group[],
          allGroups,
          nip72Events: nip72Communities
        };
      }

      // Categorize groups by user relationship
      const ownedGroups = allGroups.filter(group => group.pubkey === user.pubkey);
      
      const moderatedGroups = allGroups.filter(group => {
        if (group.type === "nip72") {
          return group.pubkey !== user.pubkey && group.moderators.includes(user.pubkey);
        } else if (group.type === "nip29") {
          return group.pubkey !== user.pubkey && group.admins.includes(user.pubkey);
        }
        return false;
      });

      // For member groups, we need to check membership lists
      // TODO: Implement membership checking for both NIP-72 and NIP-29
      const memberGroups: Group[] = [];

      // Handle pinned groups
      const pinnedGroupsList: Group[] = [];
      const processedInPinned = new Set<string>();

      for (const pinnedGroup of pinnedGroups) {
        const group = allGroups.find(g => getCommunityId(g) === pinnedGroup.communityId);
        if (group) {
          pinnedGroupsList.push(group);
          processedInPinned.add(getCommunityId(group));
        }
      }

      // Filter out pinned groups from other lists
      const filteredOwned = ownedGroups.filter(group => 
        !processedInPinned.has(getCommunityId(group))
      );
      const filteredModerated = moderatedGroups.filter(group => 
        !processedInPinned.has(getCommunityId(group))
      );
      const filteredMember = memberGroups.filter(group => 
        !processedInPinned.has(getCommunityId(group))
      );

      return {
        pinned: pinnedGroupsList,
        owned: filteredOwned,
        moderated: filteredModerated,
        member: filteredMember,
        allGroups,
        nip72Events: nip72Communities
      };
    },
    enabled: !!nostr && !isNip29Loading,
  });
}
