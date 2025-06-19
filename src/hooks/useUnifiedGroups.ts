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
  const { nostr: baseNostr } = useNostr(); // Base nostr for NIP-72 queries to chorus relay
  const { nostr: enhancedNostr } = useEnhancedNostr();
  const { user } = useCurrentUser();
  const { pinnedGroups, isLoading: isPinnedGroupsLoading } = usePinnedGroups();
  
  // Define actual NIP-29 relays to query for public groups
  const nip29Relays = [
    'wss://communities.nos.social', // Primary NIP-29 relay
    'wss://groups.fiatjaf.com'  // fiatjaf's NIP-29 relay
  ];
  
  // Get NIP-29 groups
  const nip29Result = useNip29Groups(nip29Relays);
  const nip29Groups = nip29Result.data || [];
  const isNip29Loading = nip29Result.isLoading;
  
  console.log('[useUnifiedGroups] Hook initialized', { 
    hasBaseNostr: !!baseNostr,
    hasEnhancedNostr: !!enhancedNostr,
    userPubkey: user?.pubkey?.slice(0, 8),
    nip29GroupsCount: nip29Groups.length,
    isNip29Loading
  });


  return useQuery({
    queryKey: ["unified-groups", user?.pubkey, pinnedGroups, nip29Groups],
    queryFn: async (c) => {
      console.log('[useUnifiedGroups] queryFn called', { hasBaseNostr: !!baseNostr });
      
      if (!baseNostr) {
        console.log('[useUnifiedGroups] No baseNostr, returning empty results');
        return {
          pinned: [] as Group[],
          owned: [] as Group[],
          moderated: [] as Group[],
          member: [] as Group[],
          allGroups: [] as Group[],
          nip72Events: [] as NostrEvent[]
        };
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);

      console.log('[Groups] Fetching unified groups from base provider');

      // Fetch NIP-72 communities using the base nostr provider (should use chorus relay)
      let nip72Communities: NostrEvent[] = [];
      
      try {
        console.log('[NIP-72] Starting query for communities...');
        nip72Communities = await baseNostr.query([
          { kinds: [34550], limit: 100 }
        ], { signal });

        console.log(`[NIP-72] Base provider query complete`);
        console.log(`[NIP-72] Found ${nip72Communities.length} communities`);
        
        if (nip72Communities.length > 0) {
          const firstCommunity = nip72Communities[0];
          const nameTag = firstCommunity.tags.find(t => t[0] === 'name');
          console.log(`[NIP-72] First community: ${nameTag?.[1] || 'Unnamed'}`);
          
          // Check specifically for protest.net
          const protestNetCommunity = nip72Communities.find(c => {
            const dTag = c.tags.find(t => t[0] === 'd');
            return dTag && dTag[1] === 'protest.net';
          });
          
          if (protestNetCommunity) {
            console.log('[NIP-72] Found protest.net community:', {
              id: protestNetCommunity.id,
              pubkey: protestNetCommunity.pubkey,
              tags: protestNetCommunity.tags,
              content: JSON.parse(protestNetCommunity.content || '{}')
            });
          } else {
            console.log('[NIP-72] protest.net community NOT found in results');
            
            // Log all community identifiers
            const allIdentifiers = nip72Communities.map(c => {
              const dTag = c.tags.find(t => t[0] === 'd');
              const nameTag = c.tags.find(t => t[0] === 'name');
              return { identifier: dTag?.[1], name: nameTag?.[1] };
            });
            console.log('[NIP-72] All community identifiers:', allIdentifiers);
          }
        }
      } catch (error) {
        console.error('[NIP-72] Query error:', error);
      }

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

      // For member groups, check membership lists
      const memberGroups = allGroups.filter(group => {
        if (group.type === "nip29") {
          // For NIP-29, check if user is in the members list but not an owner/admin
          return group.pubkey !== user.pubkey && 
                 !group.admins.includes(user.pubkey) && 
                 group.members?.includes(user.pubkey);
        } else if (group.type === "nip72") {
          // TODO: Implement NIP-72 membership checking
          return false;
        }
        return false;
      });

      console.log(`[Groups] User ${user.pubkey.slice(0, 8)} membership categorization:`);
      console.log(`  Owned: ${ownedGroups.length}`);
      console.log(`  Moderated: ${moderatedGroups.length}`);
      console.log(`  Member: ${memberGroups.length}`);
      
      if (memberGroups.length > 0) {
        console.log(`  Member groups: ${memberGroups.map(g => g.name).join(', ')}`);
      }

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
    enabled: !!baseNostr,
  });
}
