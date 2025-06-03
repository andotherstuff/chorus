import { useEnhancedNostr } from "@/components/EnhancedNostrProvider";
import { useCurrentUser } from "./useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import type { NostrEvent } from "@nostrify/nostrify";
import type { Nip29Group } from "@/types/groups";
import { parseNip29Group } from "@/lib/group-utils";
import { nip29Cache } from "@/lib/cache/nip29Cache";
import { groupCache } from "@/lib/cache/groupCache";

/**
 * Hook to fetch NIP-29 groups from known relays with caching support
 */
export function useNip29GroupsWithCache(groupRelays: string[] = []) {
  const { nostr } = useEnhancedNostr();
  const { user } = useCurrentUser();

  return useQuery<Nip29Group[], Error>({
    queryKey: ["nip29-groups-cached", groupRelays, user?.pubkey],
    queryFn: async (c) => {
      if (!nostr || groupRelays.length === 0) {
        return [];
      }

      console.log('[NIP-29-Cached] Querying groups from relays:', groupRelays);
      
      // Check cache first
      const cachedGroups = nip29Cache.getAllGroups();
      if (cachedGroups.length > 0 && groupCache.isEnabled()) {
        console.log(`[NIP-29-Cached] Found ${cachedGroups.length} groups in cache`);
      }

      const allGroups: Nip29Group[] = [];
      const groupsByRelay = new Map<string, Nip29Group[]>();

      // Process relays in parallel with individual timeouts
      const relayPromises = groupRelays.map(async (relayUrl) => {
        try {
          // Check relay-specific cache first
          const cachedRelayGroups = nip29Cache.getRelayGroups(relayUrl);
          if (cachedRelayGroups && cachedRelayGroups.length > 0) {
            console.log(`[NIP-29-Cached] Found ${cachedRelayGroups.length} cached groups for ${relayUrl}`);
            groupsByRelay.set(relayUrl, cachedRelayGroups);
            allGroups.push(...cachedRelayGroups);
          }

          console.log(`[NIP-29-Cached] Querying fresh data from ${relayUrl}`);
          
          // If user is logged in, give time for authentication to complete
          if (user) {
            console.log(`[NIP-29-Cached] User logged in, checking auth status...`);
            
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
          
          console.log(`[NIP-29-Cached] Got ${events.length} events from ${relayUrl}`);
          
          // Parse groups
          const relayGroups: Nip29Group[] = [];
          for (const event of events) {
            const group = parseNip29Group(event, relayUrl);
            if (group) {
              relayGroups.push(group);
            }
          }
          
          console.log(`[NIP-29-Cached] Parsed ${relayGroups.length} groups from ${relayUrl}`);
          
          // Update cache for this relay
          if (relayGroups.length > 0) {
            nip29Cache.setRelayGroups(relayUrl, relayGroups);
            groupsByRelay.set(relayUrl, relayGroups);
          }
          
          // Update auth status cache
          nip29Cache.updateAuthStatus(relayUrl, true);
          
          return relayGroups;
        } catch (error) {
          console.error(`[NIP-29-Cached] Error querying ${relayUrl}:`, error);
          
          // Update auth status cache with error
          nip29Cache.updateAuthStatus(relayUrl, false, error.message);
          
          // Return cached data for this relay if available
          const cached = nip29Cache.getRelayGroups(relayUrl);
          if (cached && cached.length > 0) {
            console.log(`[NIP-29-Cached] Using ${cached.length} cached groups for failed relay ${relayUrl}`);
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
      const uniqueGroups = Array.from(
        new Map(allGroups.map(group => [group.groupId, group])).values()
      );

      console.log(`[NIP-29-Cached] Total unique groups: ${uniqueGroups.length}`);
      
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
    staleTime: 60 * 1000, // Consider data stale after 1 minute
    gcTime: groupCache.getSettings().groupMetadataTTL, // Keep in memory as long as cache TTL
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
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
  'wss://communities.nos.social',
  'wss://groups.fiatjaf.com',
  // Additional NIP-29 relays that are currently active
  'wss://pyramid.fiatjaf.com',
  'wss://nostrelites.org',
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