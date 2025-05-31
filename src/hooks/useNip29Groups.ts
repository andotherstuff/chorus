import { useEnhancedNostr } from "@/components/EnhancedNostrProvider";
import { useCurrentUser } from "./useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import type { NostrEvent } from "@nostrify/nostrify";
import type { Nip29Group } from "@/types/groups";
import { parseNip29Group } from "@/lib/group-utils";

/**
 * Hook to fetch NIP-29 groups from known relays
 */
export function useNip29Groups(groupRelays: string[] = []) {
  const { nostr } = useEnhancedNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ["nip29-groups", groupRelays, user?.pubkey],
    queryFn: async (c) => {
      if (!nostr || groupRelays.length === 0) {
        return [];
      }

      console.log('[NIP-29] Querying groups from relays:', groupRelays);
      console.log('[NIP-29] Current user:', user?.pubkey ? `${user.pubkey.slice(0, 8)}...` : 'Not logged in');
      const allGroups: Nip29Group[] = [];

      // Process relays in parallel with individual timeouts
      const relayPromises = groupRelays.map(async (relayUrl) => {
        try {
          console.log(`[NIP-29] Querying groups from ${relayUrl}`);
          
          // If user is logged in, give time for authentication to complete
          if (user) {
            console.log(`[NIP-29] User ${user.pubkey.slice(0, 8)}... is logged in, waiting for auth...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Use a shorter timeout for each relay to fail faster
          const signal = AbortSignal.any([
            c.signal, 
            AbortSignal.timeout(8000) // 8 seconds per relay to allow for member queries
          ]);
          
          // Query for both group metadata and member lists
          // If user is logged in, we should get all groups including private ones they're members of
          const filters = user ? [
            {
              kinds: [39000], // NIP-29 relay-generated group metadata
              limit: 200 // Increase limit when authenticated to get more groups
            }
          ] : [
            {
              kinds: [39000], // NIP-29 relay-generated group metadata
              limit: 100
            }
          ];
          
          console.log(`[NIP-29] Querying relay ${relayUrl} for groups...`);
          console.log(`[NIP-29] User authenticated: ${!!user}`);
          console.log(`[NIP-29] Group metadata filter:`, JSON.stringify(filters[0]));
          
          const [groupEvents, memberEvents] = await Promise.all([
            // Group metadata events
            nostr.query(filters, { 
              signal,
              relays: [relayUrl] // Specify the relay explicitly
            }),
            // Member list events
            nostr.query([{
              kinds: [39002], // NIP-29 relay-generated member lists
              limit: 100
            }], { 
              signal,
              relays: [relayUrl] // Specify the relay explicitly
            })
          ]);

          console.log(`[NIP-29] Query complete for ${relayUrl}`);
          console.log(`[NIP-29] Found ${groupEvents.length} group metadata events and ${memberEvents.length} member events from ${relayUrl}`);
          if (groupEvents.length > 0) {
            console.log('[NIP-29] Sample group event:', groupEvents[0]);
          }

          // Create a map of group ID to member lists
          const memberMap = new Map<string, { members: string[], admins: string[] }>();
          for (const memberEvent of memberEvents) {
            const dTag = memberEvent.tags.find(tag => tag[0] === 'd');
            if (dTag && dTag[1]) {
              const groupId = dTag[1];
              const members: string[] = [];
              const admins: string[] = [];
              
              for (const tag of memberEvent.tags) {
                if (tag[0] === 'p' && tag[1]) {
                  members.push(tag[1]);
                  // Check if admin (tag[2] might contain role)
                  if (tag[2] === 'admin' || tag[3] === 'admin') {
                    admins.push(tag[1]);
                  }
                }
              }
              
              memberMap.set(groupId, { members, admins });
            }
          }

          // Parse each event into a Nip29Group
          const groups: Nip29Group[] = [];
          for (const event of groupEvents) {
            const group = parseNip29Group(event, relayUrl);
            if (group) {
              // Populate member lists if available
              const memberInfo = memberMap.get(group.groupId);
              if (memberInfo) {
                group.members = memberInfo.members;
                group.admins = memberInfo.admins;
                console.log(`[NIP-29] Group ${group.name} has ${memberInfo.members.length} members and ${memberInfo.admins.length} admins`);
              }
              
              groups.push(group);
              
              // Register this group's relay for future operations
              if ('addGroupRelay' in nostr && typeof nostr.addGroupRelay === 'function') {
                nostr.addGroupRelay(group.groupId, relayUrl);
              }
            }
          }

          console.log(`[NIP-29] Parsed ${groups.length} valid groups from ${relayUrl}`);
          return groups;
        } catch (error) {
          console.error(`[NIP-29] Error querying ${relayUrl}:`, error);
          return [];
        }
      });

      // Wait for all relay queries to complete
      const results = await Promise.all(relayPromises);
      
      // Flatten and deduplicate results
      for (const groups of results) {
        allGroups.push(...groups);
      }

      // Deduplicate by group ID
      const uniqueGroups = new Map<string, Nip29Group>();
      for (const group of allGroups) {
        uniqueGroups.set(group.id, group);
      }

      const finalGroups = Array.from(uniqueGroups.values());
      console.log(`[NIP-29] Total unique groups found: ${finalGroups.length}`);
      
      return finalGroups;
    },
    enabled: !!nostr && groupRelays.length > 0,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

/**
 * Hook to fetch a specific NIP-29 group
 */
export function useNip29Group(groupId: string | undefined, relay: string | undefined) {
  const { nostr } = useEnhancedNostr();

  return useQuery({
    queryKey: ["nip29-group", groupId, relay],
    queryFn: async (c) => {
      if (!nostr || !groupId || !relay) {
        throw new Error("Missing required parameters");
      }

      console.log(`[NIP-29] Fetching group ${groupId} from ${relay}`);
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      const events = await nostr.query([{
        kinds: [39000], // NIP-29 relay-generated group metadata
        "#d": [groupId], // Group identifier (addressable event)
        limit: 1
      }], { 
        signal,
        relays: [relay] // Specify the relay explicitly
      });

      if (events.length === 0) {
        throw new Error("Group not found");
      }

      const group = parseNip29Group(events[0], relay);
      if (!group) {
        throw new Error("Failed to parse group data");
      }

      console.log(`[NIP-29] Successfully loaded group: ${group.name}`);
      return group;
    },
    enabled: !!nostr && !!groupId && !!relay,
    staleTime: 30000,
    retry: 2,
  });
}

/**
 * Hook to fetch NIP-29 group members
 */
export function useNip29GroupMembers(groupId: string | undefined, relay: string | undefined) {
  const { nostr } = useEnhancedNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ["nip29-members", groupId, relay, user?.pubkey],
    queryFn: async (c) => {
      if (!nostr || !groupId || !relay) {
        return { members: [], admins: [], userRole: null };
      }

      console.log(`[NIP-29] Fetching members for group ${groupId} from ${relay}`);
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Query for relay-generated member list events (kind 39002)
      const events = await nostr.query([{
        kinds: [39002], // NIP-29 relay-generated member list
        "#d": [groupId], // Group identifier (using d tag for addressable events)
        limit: 1
      }], { 
        signal,
        relays: [relay] // Specify the relay explicitly
      });

      if (events.length === 0) {
        return { members: [], admins: [], userRole: null };
      }

      // Parse member list from tags
      const memberEvent = events[0];
      const members: string[] = [];
      const admins: string[] = [];
      let userRole: 'admin' | 'member' | null = null;

      for (const tag of memberEvent.tags) {
        if (tag[0] === 'p' && tag[1]) {
          members.push(tag[1]);
          
          // Check if admin (tag[2] might contain role)
          if (tag[2] === 'admin' || tag[3] === 'admin') {
            admins.push(tag[1]);
          }
          
          // Check current user's role
          if (user && tag[1] === user.pubkey) {
            userRole = (tag[2] === 'admin' || tag[3] === 'admin') ? 'admin' : 'member';
          }
        }
      }

      console.log(`[NIP-29] Found ${members.length} members (${admins.length} admins)`);
      return { members, admins, userRole };
    },
    enabled: !!nostr && !!groupId && !!relay,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

/**
 * Hook to fetch posts from a NIP-29 group
 */
export function useNip29GroupPosts(groupId: string | undefined, relay: string | undefined) {
  const { nostr } = useEnhancedNostr();

  return useQuery({
    queryKey: ["nip29-posts", groupId, relay],
    queryFn: async (c) => {
      if (!nostr || !groupId || !relay) {
        return [];
      }

      console.log(`[NIP-29] Fetching posts for group ${groupId} from ${relay}`);
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Query for group posts (kinds 9, 11)
      const events = await nostr.query([{
        kinds: [9, 11], // NIP-29 chat message and forum post
        "#h": [groupId], // Group identifier
        limit: 50
      }], { 
        signal,
        relays: [relay] // Specify the relay explicitly
      });

      console.log(`[NIP-29] Found ${events.length} posts in group ${groupId}`);
      
      // Sort by created_at descending
      return events.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!nostr && !!groupId && !!relay,
    staleTime: 10000,
    refetchInterval: 30000,
  });
}
