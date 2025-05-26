import { useNostr } from '@nostrify/react';
import { useCallback } from 'react';
import { NostrEvent, NRelay1 } from '@nostrify/nostrify';

const PRIMARY_RELAY = 'wss://relay.chorus.community/';
const FALLBACK_RELAYS = [
  'wss://purplepag.es',
  'wss://relay.nos.social',
  'wss://cache2.primal.net/v1'
];

export function useProfileSync() {
  const { nostr } = useNostr();

  const syncProfile = useCallback(async (pubkey: string) => {
    try {
      console.log('[ProfileSync] Starting profile sync for pubkey:', pubkey);

      // First, check if the kind 0 event exists on the primary relay
      const primaryRelayEvents = await nostr.query(
        [{ kinds: [0], authors: [pubkey], limit: 1 }],
        { signal: AbortSignal.timeout(3000) }
      );

      if (primaryRelayEvents.length > 0) {
        console.log('[ProfileSync] Profile already exists on primary relay');
        return;
      }

      console.log('[ProfileSync] Profile not found on primary relay, checking fallback relays...');

      // Try each fallback relay
      for (const relayUrl of FALLBACK_RELAYS) {
        try {
          console.log(`[ProfileSync] Trying fallback relay: ${relayUrl}`);
          
          // Create a temporary connection to the fallback relay
          const relay = new NRelay1(relayUrl);
          
          // Query for the kind 0 event
          const events = await relay.query(
            [{ kinds: [0], authors: [pubkey], limit: 1 }],
            { signal: AbortSignal.timeout(5000) }
          );

          if (events.length > 0) {
            const profileEvent = events[0];
            console.log(`[ProfileSync] Found profile on ${relayUrl}:`, profileEvent);

            // Republish the event exactly as-is to the primary relay
            await nostr.event(profileEvent, { 
              relays: [PRIMARY_RELAY] 
            });

            console.log('[ProfileSync] Successfully republished profile to primary relay');
            
            // Close the temporary relay connection
            relay.close();
            return;
          }

          // Close the relay if no event found
          relay.close();
        } catch (error) {
          console.error(`[ProfileSync] Error querying fallback relay ${relayUrl}:`, error);
        }
      }

      console.log('[ProfileSync] Profile not found on any fallback relays');
    } catch (error) {
      console.error('[ProfileSync] Error during profile sync:', error);
    }
  }, [nostr]);

  return { syncProfile };
}