// ABOUTME: Hook for discovering NIP-29 relays from posts in the network
// ABOUTME: Scans posts with group tags to find new NIP-29 relays automatically

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { NostrEvent } from '@nostrify/nostrify';
import { DEFAULT_NIP29_RELAYS } from './useNip29GroupsWithCache';

/**
 * Discovers NIP-29 relays by looking at posts with group tags
 */
export function useNip29RelayDiscovery() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nip29-relay-discovery'],
    queryFn: async (c) => {
      if (!nostr) return [];

      console.log('[NIP-29 Relay Discovery] Starting relay discovery...');
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);
      const discoveredRelays = new Set<string>(DEFAULT_NIP29_RELAYS);

      try {
        // Query for recent posts with group tags
        const events = await nostr.query([{
          kinds: [1, 11, 9, 1111], // Text notes, group posts, chat messages, replies
          limit: 500,
          since: Math.floor(Date.now() / 1000) - 86400 * 7 // Last 7 days
        }], { signal });

        console.log(`[NIP-29 Relay Discovery] Found ${events.length} events to scan`);

        // Scan events for relay hints
        events.forEach((event: NostrEvent) => {
          // Check for 'h' tags (NIP-29 group tags)
          const hTags = event.tags.filter(tag => tag[0] === 'h');
          
          // Check for relay hints in 'r' tags
          const rTags = event.tags.filter(tag => tag[0] === 'r');
          
          // Check for relay hints in 'relay' tags
          const relayTags = event.tags.filter(tag => tag[0] === 'relay');

          // Process relay tags
          [...rTags, ...relayTags].forEach(tag => {
            if (tag[1] && tag[1].startsWith('wss://')) {
              const relay = tag[1];
              // Only add if it looks like it might be a NIP-29 relay
              if (!discoveredRelays.has(relay)) {
                console.log(`[NIP-29 Relay Discovery] Found potential relay: ${relay}`);
                discoveredRelays.add(relay);
              }
            }
          });

          // Check content for relay references
          const relayMatches = event.content.match(/wss:\/\/[^\s,]+/g);
          if (relayMatches) {
            relayMatches.forEach(relay => {
              // Filter out common non-NIP29 relays
              if (!relay.includes('damus.io') && 
                  !relay.includes('nos.lol') && 
                  !relay.includes('relay.nostr.band') &&
                  !relay.includes('nostr.wine') &&
                  !discoveredRelays.has(relay)) {
                console.log(`[NIP-29 Relay Discovery] Found relay in content: ${relay}`);
                discoveredRelays.add(relay);
              }
            });
          }

          // Special handling for posts with group tags
          if (hTags.length > 0) {
            // Log the group reference and look for associated relays
            hTags.forEach(tag => {
              const groupId = tag[1];
              if (groupId) {
                console.log(`[NIP-29 Relay Discovery] Found group reference: ${groupId}`, {
                  eventId: event.id,
                  author: event.pubkey,
                  content: event.content.slice(0, 100),
                  tags: event.tags
                });

                // Check if the group ID contains a relay hint (e.g., "protest" might hint at protest.net)
                if (groupId.includes('.') && !groupId.includes(':')) {
                  const potentialRelay = `wss://${groupId}`;
                  if (!discoveredRelays.has(potentialRelay)) {
                    console.log(`[NIP-29 Relay Discovery] Inferring relay from group ID: ${potentialRelay}`);
                    discoveredRelays.add(potentialRelay);
                  }
                }
              }
            });
          }
        });

        const relayList = Array.from(discoveredRelays);
        console.log(`[NIP-29 Relay Discovery] Total discovered relays: ${relayList.length}`, relayList);
        
        return relayList;
      } catch (error) {
        console.error('[NIP-29 Relay Discovery] Error during discovery:', error);
        return Array.from(discoveredRelays);
      }
    },
    enabled: !!nostr,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in memory for 10 minutes
  });
}