// ABOUTME: Hook for discovering groups from partial identifiers like "protest.net"
// ABOUTME: Searches for groups across both NIP-72 and NIP-29 protocols using various heuristics

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useEnhancedNostr } from '@/components/EnhancedNostrProvider';
import { parseGroup, parseNip29Group } from '@/lib/group-utils';
import { KINDS } from '@/lib/nostr-kinds';
import type { Group } from '@/types/groups';

/**
 * Discovers groups from partial identifiers
 */
export function useGroupDiscovery(partialId: string | undefined) {
  const { nostr } = useNostr();
  const { nostr: enhancedNostr } = useEnhancedNostr();

  return useQuery<Group | null>({
    queryKey: ['group-discovery', partialId],
    queryFn: async (c) => {
      if (!partialId || !nostr) return null;

      console.log(`[Group Discovery] Searching for group with partial ID: ${partialId}`);
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);

      // Strategy 1: Check if it's a domain-like identifier that might be a NIP-29 relay
      if (partialId.includes('.') && !partialId.includes(':')) {
        console.log(`[Group Discovery] Trying as NIP-29 relay: wss://${partialId}`);
        
        if (enhancedNostr) {
          try {
            // Try to connect to it as a relay
            const relayUrl = `wss://${partialId}`;
            const events = await enhancedNostr.query([{
              kinds: [39000], // NIP-29 group metadata
              limit: 100
            }], { 
              signal,
              relays: [relayUrl]
            });

            console.log(`[Group Discovery] Found ${events.length} groups on ${relayUrl}`);
            
            // Return the first group found on this relay
            if (events.length > 0) {
              const group = parseNip29Group(events[0], relayUrl);
              if (group) {
                console.log(`[Group Discovery] Found NIP-29 group:`, group);
                return group;
              }
            }
          } catch (error) {
            console.log(`[Group Discovery] Failed to query as NIP-29 relay:`, error);
          }
        }
      }

      // Strategy 2: Search for NIP-72 groups with this identifier
      try {
        console.log(`[Group Discovery] Searching for NIP-72 groups with identifier: ${partialId}`);
        
        const events = await nostr.query([{
          kinds: [KINDS.GROUP],
          "#d": [partialId],
          limit: 10
        }], { signal });

        console.log(`[Group Discovery] Found ${events.length} NIP-72 groups`);
        
        if (events.length > 0) {
          const group = parseGroup(events[0]);
          if (group) {
            console.log(`[Group Discovery] Found NIP-72 group:`, group);
            return group;
          }
        }
      } catch (error) {
        console.log(`[Group Discovery] Error searching NIP-72 groups:`, error);
      }

      // Strategy 3: Search in recent posts for group references
      try {
        console.log(`[Group Discovery] Searching in recent posts for group references`);
        
        const posts = await nostr.query([{
          kinds: [1, 11, 1111],
          limit: 200,
          since: Math.floor(Date.now() / 1000) - 86400 * 7 // Last 7 days
        }], { signal });

        for (const post of posts) {
          // Check 'a' tags for NIP-72 groups
          const aTags = post.tags.filter(t => t[0] === 'a');
          for (const aTag of aTags) {
            const value = aTag[1];
            if (value && value.includes(partialId)) {
              console.log(`[Group Discovery] Found group reference in post:`, value);
              
              // Parse the group reference
              const match = value.match(/^34550:([^:]+):(.+)$/);
              if (match) {
                const [, pubkey, identifier] = match;
                
                // Fetch the actual group metadata
                const groupEvents = await nostr.query([{
                  kinds: [KINDS.GROUP],
                  authors: [pubkey],
                  "#d": [identifier],
                  limit: 1
                }], { signal: AbortSignal.timeout(3000) });

                if (groupEvents.length > 0) {
                  const group = parseGroup(groupEvents[0]);
                  if (group) {
                    console.log(`[Group Discovery] Found NIP-72 group from post reference:`, group);
                    return group;
                  }
                }
              }
            }
          }

          // Check 'h' tags for NIP-29 groups
          const hTags = post.tags.filter(t => t[0] === 'h');
          for (const hTag of hTags) {
            const groupId = hTag[1];
            if (groupId && groupId.includes(partialId)) {
              console.log(`[Group Discovery] Found NIP-29 group reference in post:`, groupId);
              
              // Check for relay hint in 'r' or 'relay' tags
              const relayTag = post.tags.find(t => (t[0] === 'r' || t[0] === 'relay') && t[1]?.startsWith('wss://'));
              if (relayTag && enhancedNostr) {
                const relayUrl = relayTag[1];
                console.log(`[Group Discovery] Found relay hint:`, relayUrl);
                
                // Fetch group metadata from the relay
                const groupEvents = await enhancedNostr.query([{
                  kinds: [39000],
                  "#d": [groupId],
                  limit: 1
                }], { 
                  signal: AbortSignal.timeout(3000),
                  relays: [relayUrl]
                });

                if (groupEvents.length > 0) {
                  const group = parseNip29Group(groupEvents[0], relayUrl);
                  if (group) {
                    console.log(`[Group Discovery] Found NIP-29 group from post reference:`, group);
                    return group;
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.log(`[Group Discovery] Error searching in posts:`, error);
      }

      console.log(`[Group Discovery] No group found for partial ID: ${partialId}`);
      return null;
    },
    enabled: !!partialId && !!nostr,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in memory for 10 minutes
  });
}