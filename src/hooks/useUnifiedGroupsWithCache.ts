import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useNip29Groups } from './useNip29GroupsWithCache';
import { usePinnedGroups } from './usePinnedGroups';
import { useCurrentUser } from './useCurrentUser';
import { Group } from '@/types/groups';
import { parseGroup } from '@/lib/group-utils';
import { NostrEvent } from '@nostrify/nostrify';
import { groupCache } from '@/lib/cache/groupCache';
import { nip29Cache } from '@/lib/cache/nip29Cache';

/**
 * Hook that returns both NIP-72 and NIP-29 groups with caching
 */
export function useUnifiedGroupsWithCache() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { pinnedGroups } = usePinnedGroups();
  
  // Get NIP-29 groups (already has its own caching internally)
  const nip29Result = useNip29Groups();
  const nip29Groups = useMemo(() => nip29Result.data || [], [nip29Result.data]);
  const isLoadingNip29 = nip29Result.isLoading;
  const nip29Error = nip29Result.error;

  // Query for NIP-72 groups with caching
  const { 
    data: unifiedGroups, 
    isLoading: isLoadingUnified, 
    error: unifiedError,
    isFetching,
    dataUpdatedAt
  } = useQuery<Group[], Error>({
    queryKey: ["unified-groups-cached", user?.pubkey, pinnedGroups],
    queryFn: async (c) => {
      console.log('[useUnifiedGroupsWithCache] Starting query...');
      
      // Check cache first
      const cachedGroups = groupCache.getGroups();
      const cachedNip29 = nip29Cache.getAllGroups();
      
      if (cachedGroups || cachedNip29.length > 0) {
        console.log('[useUnifiedGroupsWithCache] Found cached data:', {
          nip72Count: cachedGroups?.length || 0,
          nip29Count: cachedNip29.length
        });
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);
      
      try {
        // Fetch NIP-72 communities
        console.log('[useUnifiedGroupsWithCache] Fetching NIP-72 communities...');
        const events = await nostr.query([{
          kinds: [34550], // NIP-72 communities
          limit: 100,
        }], { signal });

        console.log(`[useUnifiedGroupsWithCache] Found ${events.length} NIP-72 events`);

        // Parse all groups
        const parsedGroups = events
          .map((event: NostrEvent) => parseGroup(event))
          .filter((group): group is Group => group !== null);

        console.log(`[useUnifiedGroupsWithCache] Parsed ${parsedGroups.length} NIP-72 groups`);

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
    staleTime: 60 * 1000, // Consider data stale after 1 minute
    gcTime: groupCache.getSettings().groupMetadataTTL, // Keep in memory as long as cache TTL
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // Return cached data immediately while fetching
    placeholderData: () => {
      const cached = groupCache.getGroups();
      return cached || undefined;
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
    const finalNip29Groups = nip29Groups.length > 0 ? nip29Groups : cachedNip29;

    // Add NIP-72 groups
    if (Array.isArray(nip72Groups)) {
      nip72Groups.forEach(group => {
        if (!seenIds.has(group.id)) {
          seenIds.add(group.id);
          combinedGroups.push(group);
        }
      });
    }

    // Add NIP-29 groups
    finalNip29Groups.forEach(group => {
      if (!seenIds.has(group.id)) {
        seenIds.add(group.id);
        combinedGroups.push(group);
      }
    });

    console.log(`[useUnifiedGroupsWithCache] Combined groups:`, {
      total: combinedGroups.length,
      nip72: nip72Groups.length,
      nip29: finalNip29Groups.length,
      fromCache: !unifiedGroups && !nip29Groups.length
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
    refetch: () => {
      // Clear cache and refetch
      groupCache.clearAll();
      nip29Cache.clearAll();
      return Promise.resolve();
    }
  };
}