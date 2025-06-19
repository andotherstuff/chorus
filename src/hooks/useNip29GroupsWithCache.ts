import React from "react";
import { useEnhancedNostr } from "@/components/EnhancedNostrProvider";
import { useCurrentUser } from "./useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import type { NostrEvent } from "@nostrify/nostrify";
import type { Nip29Group } from "@/types/groups";
import { parseNip29Group } from "@/lib/group-utils";
import { nip29Cache } from "@/lib/cache/nip29Cache";
import { groupCache } from "@/lib/cache/groupCache";
import { log, warn, DEBUG_GROUP_CACHE } from "@/lib/debug";

/**
 * Hook to fetch NIP-29 groups from known relays with caching support
 */
export function useNip29GroupsWithCache(groupRelays: string[] = []) {
  const { nostr } = useEnhancedNostr();
  const { user } = useCurrentUser();

  // Clear invalidated cache entries on first load
  React.useEffect(() => {
    nip29Cache.clearInvalidatedCache();
  }, []);

  return useQuery<Nip29Group[], Error>({
    queryKey: ["nip29-groups-cached", user?.pubkey], // Remove groupRelays from queryKey to prevent cache invalidation
    queryFn: async (c) => {
      if (!nostr || groupRelays.length === 0) {
        return [];
      }

      
      // Check cache first
      const cachedGroups = nip29Cache.getAllGroups();

      const allGroups: Nip29Group[] = [];
      const groupsByRelay = new Map<string, Nip29Group[]>();

      // Process relays in parallel with individual timeouts
      const relayPromises = groupRelays.map(async (relayUrl) => {
        try {
          // Check relay-specific cache first
          const cachedRelayGroups = nip29Cache.getRelayGroups(relayUrl);
          if (cachedRelayGroups && cachedRelayGroups.length > 0) {
            groupsByRelay.set(relayUrl, cachedRelayGroups);
            allGroups.push(...cachedRelayGroups);
          }

          
          // If user is logged in, give time for authentication to complete
          if (user) {
            
            // Check cached auth status
            const authStatus = nip29Cache.getAuthStatus(relayUrl);
            if (!authStatus?.authenticated) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          // Use a shorter timeout for each relay to fail faster
          const signal = AbortSignal.any([
            c.signal, 
            AbortSignal.timeout(8000) // 8 seconds per relay
          ]);
          
          // Query for group metadata
          const filters = user ? [
            {
              kinds: [39000], // NIP-29 relay-generated group metadata
              limit: 200 // Increase limit when authenticated
            }
          ] : [
            {
              kinds: [39000], // NIP-29 relay-generated group metadata  
              limit: 100
            }
          ];
          
          const events = await nostr.query(filters, { 
            signal,
            relays: [relayUrl]
          });
          
          
          // Parse groups with strict NIP-29 validation
          const relayGroups: Nip29Group[] = [];
          let rejectedCount = 0;
          
          for (const event of events) {
            const group = parseNip29Group(event, relayUrl);
            if (group) {
              relayGroups.push(group);
            } else {
              rejectedCount++;
            }
          }
          
          // Log validation results for this relay
          if (rejectedCount > 0 && DEBUG_GROUP_CACHE) {
            warn(`[NIP-29] Rejected ${rejectedCount} invalid groups from ${relayUrl}`);
          }
          if (relayGroups.length > 0 && DEBUG_GROUP_CACHE) {
            log(`[NIP-29] Accepted ${relayGroups.length} valid groups from ${relayUrl}`);
          }
          
          
          // Debug: Log group names from this relay
          if (relayGroups.length > 0) {
            const groupNames = relayGroups.map(g => g.name).join(', ');
          }
          
          // Update cache for this relay
          if (relayGroups.length > 0) {
            nip29Cache.setRelayGroups(relayUrl, relayGroups);
            groupsByRelay.set(relayUrl, relayGroups);
          }
          
          // Update auth status cache
          nip29Cache.updateAuthStatus(relayUrl, true);
          
          return relayGroups;
        } catch (error) {
          if (DEBUG_GROUP_CACHE) {
            warn(`[NIP-29-Cached] Error querying ${relayUrl}:`, error);
          }
          
          // Update auth status cache with error
          nip29Cache.updateAuthStatus(relayUrl, false, error.message);
          
          // Return cached data for this relay if available
          const cached = nip29Cache.getRelayGroups(relayUrl);
          if (cached && cached.length > 0) {
            groupsByRelay.set(relayUrl, cached);
            return cached;
          }
          
          return [];
        }
      });

      // Wait for all relays with Promise.allSettled
      const results = await Promise.allSettled(relayPromises);
      
      // Collect all successful results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          const relayUrl = groupRelays[index];
          const groups = result.value;
          
          // Only add if not already added from cache
          if (!groupsByRelay.has(relayUrl)) {
            groupsByRelay.set(relayUrl, groups);
            allGroups.push(...groups);
          }
        }
      });

      // Update overall cache
      nip29Cache.setAllGroups(groupsByRelay);

      // Deduplicate groups (same group might exist on multiple relays)
      // Use different deduplication keys for different group types
      const uniqueGroups = Array.from(
        new Map(allGroups.map(group => {
          if (group.type === 'nip29') {
            // For NIP-29, deduplicate by groupId (same group can exist on multiple relays)
            return [group.groupId, group];
          } else {
            // For NIP-72, use the full id (they should be unique already)
            return [group.id, group];
          }
        })).values()
      );

      
      // Debug: Check if we had duplicates
      if (allGroups.length !== uniqueGroups.length) {
        
        // Find which groups were duplicated
        const groupCounts = new Map<string, number>();
        allGroups.forEach(group => {
          const key = group.type === 'nip29' ? group.groupId : group.id;
          groupCounts.set(key, (groupCounts.get(key) || 0) + 1);
        });
        
        groupCounts.forEach((count, key) => {
          if (count > 1) {
          }
        });
      }
      
      // If user is logged in, update their group relationships
      if (user?.pubkey) {
        const userGroups = groupCache.getUserGroups(user.pubkey) || {
          userPubkey: user.pubkey,
          ownedGroups: [],
          moderatedGroups: [],
          memberGroups: [],
          pinnedGroups: [],
          lastFetch: Date.now(),
        };

        // Update NIP-29 specific relationships
        const nip29Owned = uniqueGroups
          .filter(g => g.admins.includes(user.pubkey))
          .map(g => g.id);
        
        const nip29Member = uniqueGroups
          .filter(g => g.members && g.members.includes(user.pubkey))
          .map(g => g.id);

        userGroups.ownedGroups = [...new Set([...userGroups.ownedGroups, ...nip29Owned])];
        userGroups.memberGroups = [...new Set([...userGroups.memberGroups, ...nip29Member])];
        userGroups.lastFetch = Date.now();

        groupCache.setUserGroups(user.pubkey, userGroups);
      }

      return uniqueGroups;
    },
    enabled: !!nostr && groupRelays.length > 0,
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in memory for 30 minutes
    refetchInterval: false, // Don't auto-refetch, let user pull to refresh
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
    refetchOnReconnect: true, // Refetch when connection restored
    refetchOnMount: false, // Don't refetch on every mount, use cache first
    // Return cached data immediately while fetching
    placeholderData: () => {
      const cached = nip29Cache.getAllGroups();
      return cached.length > 0 ? cached : undefined;
    },
  });
}

/**
 * Default NIP-29 group relays to check
 */
export const DEFAULT_NIP29_RELAYS = [
  'wss://communities.nos.social', // Primary NIP-29 relay
  'wss://groups.fiatjaf.com',
  // Additional NIP-29 relays that are currently active
  'wss://pyramid.fiatjaf.com',
  'wss://nostrelites.org',
  'wss://relay.protest.net', // Protest.net NIP-29 relay
  // Note: The following relays are currently offline or have issues:
  // 'wss://relay.0xchat.com' - certificate expired
  // 'wss://communities.nip29.com' - DNS not found
  // 'wss://groups.nostr.com' - DNS not found
  // 'wss://relay29.com' - DNS not found
  // 'wss://relay.groups.nip29.com' - temporarily disabled - causing crashes
];

/**
 * Hook to fetch NIP-29 groups with default relays and caching
 */
export function useNip29Groups() {
  return useNip29GroupsWithCache(DEFAULT_NIP29_RELAYS);
}