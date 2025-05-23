import React, { createContext, useContext, useMemo, useCallback, useRef } from 'react';
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
      return relayConnections.current.get(url)!;
    }

    const relay = new NRelay1(url);
    relayConnections.current.set(url, relay);

    // Set up WebSocket event listeners for NIP-42 auth
    const ws = (relay as any).socket;
    if (ws) {
      const originalOnMessage = ws.onmessage;
      ws.onmessage = async (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          
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
    }

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
        const ws = (relay as any).socket;
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
            const groupId = filter['#h']?.[0];
            const groupRelay = groupId ? getGroupRelay(groupId) : undefined;
            
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
    // If specific relays are provided, ensure they're authenticated
    if (opts?.relays) {
      for (const relay of opts.relays) {
        // Check if this relay needs authentication
        if (pendingAuth.current.has(relay) && !authenticatedRelays.current.has(relay)) {
          const challenge = pendingAuth.current.get(relay)!;
          await handleAuthChallenge(relay, challenge);
          // Wait a bit for auth to complete
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // Use the enhanced pool for NIP-29 queries or when specific relays are provided
    const isNip29Query = filters.some(f => f.kinds?.some(k => k >= 39000 && k <= 39003));
    if (isNip29Query || opts?.relays) {
      console.log(`[Query] Using enhanced pool for ${isNip29Query ? 'NIP-29' : 'custom relay'} query`);
      const events = await pool.query(filters, opts);
      return Array.from(events);
    } else {
      // Use the base nostr for NIP-72 queries
      console.log('[Query] Using base nostr for NIP-72 query');
      return baseNostr.nostr.query(filters, opts ? { signal: opts.signal } : undefined);
    }
  }, [pool, handleAuthChallenge, baseNostr]);

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

  return (
    <EnhancedNostrContext.Provider value={{ nostr: enhancedNostr }}>
      {children}
    </EnhancedNostrContext.Provider>
  );
}
