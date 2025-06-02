/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  NPool,
  NRelay1,
  NostrEvent,
  NostrSigner,
  NostrFilter,
  NSet
} from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';

interface PublishOptions {
  relays?: string[];
  signal?: AbortSignal;
  groupType?: 'nip29' | 'nip72';
  groupId?: string;
}

interface EnhancedNostr {
  pool: NPool;
  query: (filters: NostrFilter[], opts?: { signal?: AbortSignal; relays?: string[] }) => Promise<NostrEvent[]>;
  event: (event: NostrEvent, opts?: PublishOptions) => Promise<void>;
  addGroupRelay: (groupId: string, relay: string) => void;
  getGroupRelay: (groupId: string) => string | undefined;
  getNip29DefaultRelay: () => string;
}

interface EnhancedNostrContextType {
  nostr: EnhancedNostr | null;
}

const EnhancedNostrContext = createContext<EnhancedNostrContextType>({
  nostr: null
});

export const useEnhancedNostr = () => {
  const context = useContext(EnhancedNostrContext);
  if (!context.nostr) {
    throw new Error('useEnhancedNostr must be used within EnhancedNostrProvider');
  }
  return context;
};

interface EnhancedNostrProviderProps {
  children: React.ReactNode;
  relays?: string[];
  nip29DefaultRelay?: string;
  signer?: NostrSigner;
}

export function EnhancedNostrProvider({ 
  children, 
  relays = [], 
  nip29DefaultRelay = 'wss://communities.nos.social/',
  signer 
}: EnhancedNostrProviderProps) {
  // Get the base nostr instance from the regular provider
  const baseNostr = useNostr();
  
  // Preconnect to known NIP-29 relays
  const nip29Relays = useMemo(() => [
    nip29DefaultRelay,
    // 'wss://relays.groups.nip29.com', // Temporarily disabled - causing crashes
    'wss://groups.fiatjaf.com'
  ], [nip29DefaultRelay]);
  
  // Track authenticated relays
  const authenticatedRelays = useRef<Set<string>>(new Set());
  // Track pending auth challenges
  const pendingAuth = useRef<Map<string, string>>(new Map());
  // Track relay connections
  const relayConnections = useRef<Map<string, NRelay1>>(new Map());

  const defaultRelays = useMemo(() => [...new Set(relays)], [relays]);
  const defaultNip29Relay = useMemo(() => nip29DefaultRelay, [nip29DefaultRelay]);

  // Create relay opener with NIP-42 authentication support
  const open = useCallback((url: string): NRelay1 => {
    console.log(`[EnhancedNostrProvider] Opening connection to ${url}`);
    
    // Check if we already have a connection
    if (relayConnections.current.has(url)) {
      console.log(`[EnhancedNostrProvider] Reusing existing connection to ${url}`);
      return relayConnections.current.get(url)!;
    }

    const relay = new NRelay1(url);
    relayConnections.current.set(url, relay);
    
    // Log connection status by monitoring the internal WebSocket
    // We need to wait a bit for the socket to be created
    setTimeout(() => {
      const ws = (relay as unknown as { socket?: WebSocket }).socket;
      if (ws) {
        console.log(`[EnhancedNostrProvider] WebSocket state for ${url}: ${ws.readyState} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)`);
        
        // Add connection event listeners
        ws.addEventListener('open', () => {
          console.log(`[EnhancedNostrProvider] WebSocket connected to ${url}`);
        });
        
        ws.addEventListener('close', () => {
          console.log(`[EnhancedNostrProvider] WebSocket disconnected from ${url}`);
          relayConnections.current.delete(url);
          authenticatedRelays.current.delete(url);
        });
        
        ws.addEventListener('error', (error) => {
          console.error(`[EnhancedNostrProvider] WebSocket error for ${url}:`, error);
        });

        // Set up message listener for NIP-42 auth
        const originalOnMessage = ws.onmessage;
        ws.onmessage = async (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            console.log(`[EnhancedNostrProvider] Received from ${url}:`, message);
            
            // Check for AUTH challenge
            if (Array.isArray(message) && message[0] === 'AUTH' && message[1]) {
              console.log(`[NIP-42] Received AUTH challenge from ${url}:`, message[1]);
              pendingAuth.current.set(url, message[1]);
              
              // Automatically respond to AUTH challenge if we have a signer
              if (signer && !authenticatedRelays.current.has(url)) {
                await handleAuthChallenge(url, message[1]);
              }
            }
          } catch (error) {
            // Not JSON or parsing error, ignore
          }
          
          // Call original handler
          if (originalOnMessage) {
            originalOnMessage.call(ws, event);
          }
        };
      } else {
        console.warn(`[EnhancedNostrProvider] No WebSocket found for ${url}`);
      }
    }, 100);

    return relay;
  }, [signer]);

  // Handle NIP-42 authentication
  const handleAuthChallenge = useCallback(async (relayUrl: string, challenge: string) => {
    if (!signer) {
      console.warn(`[NIP-42] Cannot authenticate with ${relayUrl}: No signer available`);
      return;
    }

    try {
      console.log(`[NIP-42] Authenticating with ${relayUrl}`);
      
      // Create NIP-42 auth event
      const authEvent = await signer.signEvent({
        kind: 22242,
        tags: [
          ['relay', relayUrl],
          ['challenge', challenge]
        ],
        content: '',
        created_at: Math.floor(Date.now() / 1000)
      });

      // Send AUTH response
      const relay = relayConnections.current.get(relayUrl);
      if (relay) {
        const ws = (relay as unknown as { socket?: WebSocket }).socket;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(['AUTH', authEvent]));
          authenticatedRelays.current.add(relayUrl);
          console.log(`[NIP-42] Successfully authenticated with ${relayUrl}`);
        }
      }
    } catch (error) {
      console.error(`[NIP-42] Failed to authenticate with ${relayUrl}:`, error);
    }
  }, [signer]);

  // Ensure relay is connected and authenticated
  const ensureRelayAuth = useCallback(async (relayUrl: string) => {
    // First ensure connection
    if (!relayConnections.current.has(relayUrl)) {
      console.log(`[NIP-42] Connecting to ${relayUrl}...`);
      const relay = open(relayUrl);
      relayConnections.current.set(relayUrl, relay);
    }
    
    // Check if we have a pending auth challenge
    if (pendingAuth.current.has(relayUrl) && !authenticatedRelays.current.has(relayUrl)) {
      const challenge = pendingAuth.current.get(relayUrl)!;
      await handleAuthChallenge(relayUrl, challenge);
      // Wait for auth to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return authenticatedRelays.current.has(relayUrl);
  }, [open, handleAuthChallenge]);

  // Group relay management with hard-coded default
  const groupRelays = useRef<Map<string, string>>(new Map());

  const addGroupRelay = useCallback((groupId: string, relay: string) => {
    groupRelays.current.set(groupId, relay);
    console.log(`[Groups] Registered relay ${relay} for group ${groupId}`);
  }, []);

  const getGroupRelay = useCallback((groupId: string): string | undefined => {
    return groupRelays.current.get(groupId);
  }, []);

  const getNip29DefaultRelay = useCallback((): string => {
    return defaultNip29Relay;
  }, [defaultNip29Relay]);

  // Create the enhanced pool with group-aware routing
  const pool = useMemo(() => {
    return new NPool({
      open,
      reqRouter: async (filters: NostrFilter[]) => {
        const relayMap = new Map<string, NostrFilter[]>();
        
        console.log('[EnhancedNostrProvider] Routing query filters:', filters);
        
        for (const filter of filters) {
          // Check if this is a NIP-29 query (relay-generated kinds 39000-39003)
          if (filter.kinds?.some(k => k >= 39000 && k <= 39003)) {
            console.log('[NIP-29] Detected NIP-29 query, routing to NIP-29 relays');
            
            // Check if we have a group ID in the filter
            // For kind 39002 (member lists), the group ID is in #d tag
            // For other kinds, it might be in #h tag
            const groupId = filter['#d']?.[0] || filter['#h']?.[0];
            const groupRelay = groupId ? getGroupRelay(groupId) : undefined;
            
            console.log('[NIP-29] Filter analysis:', {
              kinds: filter.kinds,
              dTag: filter['#d'],
              hTag: filter['#h'],
              groupId,
              groupRelay
            });
            
            // If we have a specific relay for this group, use it
            if (groupRelay) {
              if (!relayMap.has(groupRelay)) {
                relayMap.set(groupRelay, []);
              }
              relayMap.get(groupRelay)!.push(filter);
              console.log(`[NIP-29] Routing query to group-specific relay ${groupRelay}`);
            } else {
              // Use the default NIP-29 relay
              if (!relayMap.has(defaultNip29Relay)) {
                relayMap.set(defaultNip29Relay, []);
              }
              relayMap.get(defaultNip29Relay)!.push(filter);
              console.log(`[NIP-29] Routing query to default NIP-29 relay ${defaultNip29Relay}`);
            }
          } else {
            // Regular query - use NIP-72 relays
            console.log('[NIP-72] Routing query to default NIP-72 relays');
            for (const relay of defaultRelays) {
              if (!relayMap.has(relay)) {
                relayMap.set(relay, []);
              }
              relayMap.get(relay)!.push(filter);
            }
          }
        }
        
        console.log('[EnhancedNostrProvider] Final relay routing:', Array.from(relayMap.keys()));
        return relayMap;
      },
      eventRouter: async (event: NostrEvent) => {
        const relayUrls: string[] = [];
        
        console.log(`[EnhancedNostrProvider] Routing event kind ${event.kind}`);
        
        // Check if this is a NIP-29 event (user-generated for groups: 9000-9030, or relay-generated: 39000+)
        const hTag = event.tags.find(tag => tag[0] === 'h');
        if (hTag || (((event.kind >= 9000 && event.kind <= 9030) || event.kind === 11)) || (event.kind >= 39000)) {
          console.log('[NIP-29] Detected NIP-29 event, routing to NIP-29 relays');
          
          // This is a NIP-29 event, find the appropriate relay
          const groupId = hTag?.[1];
          const groupRelay = groupId ? getGroupRelay(groupId) : undefined;
          
          if (groupRelay) {
            relayUrls.push(groupRelay);
            console.log(`[NIP-29] Routing event to group-specific relay ${groupRelay}`);
          } else {
            // Use default NIP-29 relay
            relayUrls.push(defaultNip29Relay);
            console.log(`[NIP-29] Routing event to default NIP-29 relay ${defaultNip29Relay}`);
          }
        } else {
          // Regular event - use NIP-72 relays
          console.log('[NIP-72] Routing event to default NIP-72 relays');
          relayUrls.push(...defaultRelays);
        }
        
        console.log('[EnhancedNostrProvider] Final event routing:', relayUrls);
        return relayUrls;
      }
    });
  }, [defaultRelays, defaultNip29Relay, open, getGroupRelay]);

  /**
   * Enhanced query with authentication support
   */
  const query = useCallback(async (
    filters: NostrFilter[],
    opts?: { signal?: AbortSignal; relays?: string[] }
  ): Promise<NostrEvent[]> => {
    console.log('[Query] Starting query with filters:', JSON.stringify(filters, null, 2));
    console.log('[Query] Query options:', { relays: opts?.relays, hasSignal: !!opts?.signal });
    
    // If specific relays are provided, ensure they're authenticated
    if (opts?.relays) {
      console.log('[Query] Ensuring authentication for relays:', opts.relays);
      for (const relay of opts.relays) {
        await ensureRelayAuth(relay);
      }
    }

    // If specific relays are provided, create a temporary pool for this query
    if (opts?.relays && opts.relays.length > 0) {
      console.log(`[Query] Creating temporary pool for relays:`, opts.relays);
      const tempPool = new NPool({
        open,
        reqRouter: async (filters: NostrFilter[]) => {
          const relayMap = new Map<string, NostrFilter[]>();
          for (const relay of opts.relays!) {
            relayMap.set(relay, filters);
          }
          return relayMap;
        },
        eventRouter: async (event: NostrEvent) => {
          // Route events to all specified relays
          return opts.relays || [];
        }
      });
      console.log('[Query] Executing query on temporary pool...');
      const events = await tempPool.query(filters, opts);
      const eventsArray = Array.from(events);
      console.log(`[Query] Temporary pool returned ${eventsArray.length} events`);
      eventsArray.forEach((event, index) => {
        console.log(`[Query] Event ${index + 1}:`, {
          id: event.id,
          kind: event.kind,
          pubkey: event.pubkey,
          created_at: event.created_at,
          tags: event.tags,
          content: event.content.substring(0, 100) + (event.content.length > 100 ? '...' : '')
        });
      });
      return eventsArray;
    }
    
    // Use the enhanced pool for NIP-29 queries
    const isNip29Query = filters.some(f => f.kinds?.some(k => k >= 39000 && k <= 39003));
    if (isNip29Query) {
      console.log(`[Query] Using enhanced pool for NIP-29 query`);
      const events = await pool.query(filters, opts);
      const eventsArray = Array.from(events);
      console.log(`[Query] Enhanced pool returned ${eventsArray.length} events`);
      return eventsArray;
    } else {
      // Use the base nostr for NIP-72 queries
      console.log('[Query] Using base nostr for NIP-72 query');
      const events = await baseNostr.nostr.query(filters, opts ? { signal: opts.signal } : undefined);
      console.log(`[Query] Base nostr returned ${events.length} events`);
      return events;
    }
  }, [pool, ensureRelayAuth, baseNostr, open]);

  /**
   * Enhanced event publishing with group-aware routing
   */
  const event = useCallback(async (
    event: NostrEvent,
    opts?: PublishOptions
  ): Promise<void> => {
    let targetRelays = opts?.relays || defaultRelays;

    // For NIP-29 groups, use the group-specific relay
    if (opts?.groupType === "nip29" && opts?.groupId) {
      const groupRelay = getGroupRelay(opts.groupId);
      if (groupRelay) {
        targetRelays = [groupRelay];
        console.log(`[Publish] Publishing NIP-29 event to group relay: ${groupRelay}`);
      } else if (opts.relays && opts.relays.length > 0) {
        // Use the specified relay and register it for future use
        targetRelays = opts.relays;
        addGroupRelay(opts.groupId, opts.relays[0]);
        console.log(`[Publish] Publishing NIP-29 event to new relay: ${opts.relays[0]}`);
      } else {
        // Use default NIP-29 relay
        targetRelays = [defaultNip29Relay];
        addGroupRelay(opts.groupId, defaultNip29Relay);
        console.log(`[Publish] Publishing NIP-29 event to default relay: ${defaultNip29Relay}`);
      }
    } else if (opts?.groupType === "nip72") {
      // For NIP-72, explicitly use the NIP-72 relays
      targetRelays = defaultRelays;
      console.log(`[Publish] Publishing NIP-72 event to NIP-72 relays: ${defaultRelays.join(', ')}`);
    }

    // Ensure target relays are authenticated for NIP-29 events
    if (((event.kind >= 9000 && event.kind <= 9030) || event.kind === 11)) {
      for (const relay of targetRelays) {
        if (pendingAuth.current.has(relay) && !authenticatedRelays.current.has(relay)) {
          const challenge = pendingAuth.current.get(relay)!;
          await handleAuthChallenge(relay, challenge);
          // Wait a bit for auth to complete
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // Use the enhanced pool for NIP-29 events or when targeting specific relays
    const isNip29Event = ((event.kind >= 9000 && event.kind <= 9030) || event.kind === 11) || event.kind >= 39000;
    if (isNip29Event || opts?.groupType === "nip29") {
      console.log(`[Publish] Publishing NIP-29 event via enhanced pool to: ${targetRelays.join(', ')}`);
      await pool.event(event, { ...opts, relays: targetRelays, signal: AbortSignal.timeout(10000) });
    } else {
      // Use the base nostr for NIP-72 events
      console.log(`[Publish] Publishing NIP-72 event via base nostr`);
      await baseNostr.nostr.event(event, opts ? { signal: opts.signal } : undefined);
    }
  }, [pool, defaultRelays, defaultNip29Relay, getGroupRelay, addGroupRelay, handleAuthChallenge, baseNostr]);

  const enhancedNostr: EnhancedNostr = useMemo(() => ({
    pool,
    query,
    event,
    addGroupRelay,
    getGroupRelay,
    getNip29DefaultRelay
  }), [pool, query, event, addGroupRelay, getGroupRelay, getNip29DefaultRelay]);
  
  // Preconnect to NIP-29 relays on mount
  useEffect(() => {
    console.log('[EnhancedNostrProvider] Preconnecting to NIP-29 relays...');
    for (const relay of nip29Relays) {
      try {
        open(relay);
        console.log(`[EnhancedNostrProvider] Initiated connection to ${relay}`);
      } catch (error) {
        console.error(`[EnhancedNostrProvider] Failed to connect to ${relay}:`, error);
      }
    }
  }, [nip29Relays, open]);

  return (
    <EnhancedNostrContext.Provider value={{ nostr: enhancedNostr }}>
      {children}
    </EnhancedNostrContext.Provider>
  );
}
