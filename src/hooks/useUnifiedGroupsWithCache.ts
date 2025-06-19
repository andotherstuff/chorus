import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useNip29Groups, useNip29GroupsWithCache } from './useNip29GroupsWithCache';
import { usePinnedGroups } from './usePinnedGroups';
import { useCurrentUser } from './useCurrentUser';
import { Group } from '@/types/groups';
import { parseGroup } from '@/lib/group-utils';
import { NostrEvent } from '@nostrify/nostrify';
import { groupCache } from '@/lib/cache/groupCache';
import { nip29Cache } from '@/lib/cache/nip29Cache';
import { useNip29RelayDiscovery } from './useNip29RelayDiscovery';

/**
 * Hook that returns both NIP-72 and NIP-29 groups with caching
 */
export function useUnifiedGroupsWithCache() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { pinnedGroups } = usePinnedGroups();
  
  // Discover additional NIP-29 relays
  const { data: discoveredRelays } = useNip29RelayDiscovery();
  
  // Get NIP-29 groups from discovered relays
  const nip29Result = useNip29GroupsWithCache(discoveredRelays || []);
  const nip29Groups = useMemo(() => nip29Result.data || [], [nip29Result.data]);
  const isLoadingNip29 = nip29Result.isLoading;
  const nip29Error = nip29Result.error;
  const refetchNip29 = nip29Result.refetch;

  // Query for NIP-72 groups with caching
  const { 
    data: unifiedGroups, 
    isLoading: isLoadingUnified, 
    error: unifiedError,
    isFetching,
    dataUpdatedAt,
    refetch: refetchNip72
  } = useQuery<Group[], Error>({
    queryKey: ["unified-groups-cached", user?.pubkey, pinnedGroups],
    queryFn: async (c) => {
      // Check cache first
      const cachedGroups = groupCache.getGroups();
      const cachedNip29 = nip29Cache.getAllGroups();

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);
      
      try {
        // Fetch NIP-72 communities
        const events = await nostr.query([{
          kinds: [34550], // NIP-72 communities
          limit: 100,
        }], { signal });

        // Parse all groups
        const parsedGroups = events
          .map((event: NostrEvent) => parseGroup(event))
          .filter((group): group is Group => group !== null);

        // Update cache with fresh data
        if (parsedGroups.length > 0) {
          groupCache.setGroups(parsedGroups);
        }

        // If user is logged in, update their group relationships
        if (user?.pubkey) {
          const userGroups = {
            userPubkey: user.pubkey,
            ownedGroups: parsedGroups.filter(g => g.pubkey === user.pubkey).map(g => g.id),
            moderatedGroups: parsedGroups.filter(g => 
              g.type === 'nip72' && g.moderators.includes(user.pubkey)
            ).map(g => g.id),
            memberGroups: [], // Would need member list data
            pinnedGroups: pinnedGroups?.map(p => p.communityId) || [],
            lastFetch: Date.now(),
          };
          groupCache.setUserGroups(user.pubkey, userGroups);
        }

        return parsedGroups;
      } catch (error) {
        console.error('[useUnifiedGroupsWithCache] Error fetching groups:', error);
        
        // If query fails, return cached data if available
        if (cachedGroups) {
          console.log('[useUnifiedGroupsWithCache] Returning cached data due to error');
          return cachedGroups;
        }
        
        throw error;
      }
    },
    enabled: !!nostr,
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in memory for 30 minutes
    refetchInterval: false, // Don't auto-refetch, let user pull to refresh
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
    refetchOnReconnect: true, // Refetch when connection restored
    // Return cached data immediately while fetching
    placeholderData: () => {
      const cachedNip72 = groupCache.getGroups();
      const cachedNip29 = nip29Cache.getAllGroups();
      
      const allCachedGroups: Group[] = [
        ...(cachedNip72 || []),
        ...cachedNip29
      ];
      
      return allCachedGroups.length > 0 ? allCachedGroups : undefined;
    },
  });

  // Combine and deduplicate groups
  const allGroups = useMemo(() => {
    const combinedGroups: Group[] = [];
    const seenIds = new Set<string>();

    // Get cached data first for immediate display
    const cachedNip72 = groupCache.getGroups() || [];
    const cachedNip29 = nip29Cache.getAllGroups();

    // Use fresh data if available, otherwise use cached
    const nip72Groups = unifiedGroups || cachedNip72;
    
    // Merge fresh NIP-29 data with cached data (additive, not replacement)
    const finalNip29Groups = (() => {
      if (nip29Groups.length > 0) {
        // Merge fresh data with cached data to avoid losing groups from other relays
        const mergedGroups = [...cachedNip29];
        // FIXED: Use group.id for all deduplication (it includes relay info for NIP-29)
        const cachedIds = new Set(cachedNip29.map(g => g.id));
        
        // Add fresh groups that aren't already cached
        nip29Groups.forEach(group => {
          // FIXED: Use group.id consistently for global uniqueness
          const dedupeKey = group.id;
          if (!cachedIds.has(dedupeKey)) {
            mergedGroups.push(group);
          } else {
            // Update existing group with fresh data (find by proper dedupe key)
            const index = mergedGroups.findIndex(g => g.id === dedupeKey);
            if (index !== -1) {
              mergedGroups[index] = group;
            }
          }
        });
        
        return mergedGroups;
      }
      return cachedNip29;
    })();

    // Add NIP-72 groups (use full ID for deduplication)
    if (Array.isArray(nip72Groups)) {
      nip72Groups.forEach(group => {
        if (!seenIds.has(group.id)) {
          seenIds.add(group.id);
          combinedGroups.push(group);
        }
      });
    }

    // Add NIP-29 groups (use group.id for deduplication - includes relay info)
    finalNip29Groups.forEach(group => {
      // FIXED: Use group.id for global uniqueness across relays
      if (!seenIds.has(group.id)) {
        seenIds.add(group.id);
        combinedGroups.push(group);
      }
    });


    return combinedGroups;
  }, [unifiedGroups, nip29Groups]);

  // Sort groups by type and name
  const sortedGroups = useMemo(() => {
    return [...allGroups].sort((a, b) => {
      // Pinned groups first
      const aIsPinned = pinnedGroups?.some(p => p.communityId === a.id) || false;
      const bIsPinned = pinnedGroups?.some(p => p.communityId === b.id) || false;
      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;

      // Then by type (NIP-72 first)
      if (a.type !== b.type) {
        return a.type === 'nip72' ? -1 : 1;
      }

      // Then alphabetically
      return a.name.localeCompare(b.name);
    });
  }, [allGroups, pinnedGroups]);

  // Calculate cache status
  const cacheStatus = useMemo(() => {
    const settings = groupCache.getSettings();
    const stats = groupCache.getStats();
    const nip29Stats = nip29Cache.getStats();

    return {
      enabled: settings.enabled,
      showIndicators: settings.showIndicators,
      nip72Cached: !unifiedGroups && sortedGroups.some(g => g.type === 'nip72'),
      nip29Cached: !nip29Groups.length && sortedGroups.some(g => g.type === 'nip29'),
      totalCached: stats.itemCount + nip29Stats.groupCount,
      cacheSize: stats.size + nip29Stats.totalSize,
      lastUpdated: dataUpdatedAt,
    };
  }, [unifiedGroups, nip29Groups, sortedGroups, dataUpdatedAt]);

  return {
    groups: sortedGroups,
    isLoading: isLoadingUnified || (isLoadingNip29 && nip29Groups.length === 0),
    isFetching,
    error: unifiedError || nip29Error,
    cacheStatus,
    refetch: async () => {
      // Clear cache and refetch both hooks
      groupCache.clearAll();
      nip29Cache.clearAll();
      await Promise.all([
        refetchNip72(),
        refetchNip29()
      ]);
    }
  };
}