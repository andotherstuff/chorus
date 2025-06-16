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
import { log, error as logError, warn } from '@/lib/debug';
import { normalizeRelayUrl } from '@/lib/nip29Utils';
import type { GroupInstance, GroupMetadata } from '@/features/groups/types';

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
  
  // New group instance management
  addGroupInstance: (instance: GroupInstance) => void;
  resolveGroupInstance: (compositeId: string) => GroupInstance | undefined;
  getGroupInstances: (groupId: string) => GroupInstance[];
  removeGroupInstance: (compositeId: string) => void;
  createCompositeId: (groupId: string, relayUrl: string) => string;
  
  // Legacy methods (deprecated but maintained for compatibility)
  /** @deprecated Use addGroupInstance instead */
  addGroupRelay: (groupId: string, relay: string) => void;
  /** @deprecated Use getGroupInstances(groupId) or resolveGroupInstance(compositeId) */
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
  nip29DefaultRelay = 'wss://groups.nip29.com/',
  signer 
}: EnhancedNostrProviderProps) {
  // Get the base nostr instance from the regular provider
  const baseNostr = useNostr();
  
  // NIP-29 groups should be relay-specific - only use default relay unless specific group relay is registered
  const nip29Relays = useMemo(() => [
    nip29DefaultRelay
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
    log(`[EnhancedNostrProvider] Opening connection to ${url}`);
    
    // Check if we already have a connection
    if (relayConnections.current.has(url)) {
      log(`[EnhancedNostrProvider] Reusing existing connection to ${url}`);
      return relayConnections.current.get(url)!;
    }

    const relay = new NRelay1(url);
    relayConnections.current.set(url, relay);
    
    // Log connection status by monitoring the internal WebSocket
    // 
    // FIXME: This is a brittle hack that relies on NRelay1's internal implementation.
    // The NRelay1 constructor creates a WebSocket asynchronously, but doesn't expose
    // any event or promise to know when it's ready. We use setTimeout to wait for
    // the socket property to be populated on the relay instance.
    // 
    // This should be replaced if @nostrify/nostrify ever exposes:
    // - A connection status property/event
    // - A promise that resolves when the connection is established
    // - A proper public API to access connection state
    //
    // Risk: This could break on any minor version update of @nostrify/nostrify
    // if they change their internal socket property name or creation timing.
    setTimeout(() => {
      const ws = (relay as unknown as { socket?: WebSocket }).socket;
      if (ws) {
        log(`[EnhancedNostrProvider] WebSocket state for ${url}: ${ws.readyState} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)`);
        
        // Add connection event listeners
        ws.addEventListener('open', () => {
          log(`[EnhancedNostrProvider] WebSocket connected to ${url}`);
        });
        
        ws.addEventListener('close', () => {
          log(`[EnhancedNostrProvider] WebSocket disconnected from ${url}`);
          relayConnections.current.delete(url);
          authenticatedRelays.current.delete(url);
        });
        
        ws.addEventListener('error', (error) => {
          logError(`[EnhancedNostrProvider] WebSocket error for ${url}:`, error);
        });

        // Set up message listener for NIP-42 auth
        const originalOnMessage = ws.onmessage;
        ws.onmessage = async (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            log(`[EnhancedNostrProvider] Received from ${url}:`, message);
            
            // Check for AUTH challenge
            if (Array.isArray(message) && message[0] === 'AUTH' && message[1]) {
              log(`[NIP-42] Received AUTH challenge from ${url}:`, message[1]);
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
        warn(`[EnhancedNostrProvider] No WebSocket found for ${url}`);
      }
    }, 100);

    return relay;
  }, [signer]);

  // Handle NIP-42 authentication
  const handleAuthChallenge = useCallback(async (relayUrl: string, challenge: string) => {
    if (!signer) {
      warn(`[NIP-42] Cannot authenticate with ${relayUrl}: No signer available`);
      return;
    }

    try {
      log(`[NIP-42] Authenticating with ${relayUrl}`);
      
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
          log(`[NIP-42] Successfully authenticated with ${relayUrl}`);
        }
      }
    } catch (error) {
      logError(`[NIP-42] Failed to authenticate with ${relayUrl}:`, error);
    }
  }, [signer]);

  // Ensure relay is connected and authenticated
  const ensureRelayAuth = useCallback(async (relayUrl: string) => {
    // First ensure connection
    if (!relayConnections.current.has(relayUrl)) {
      log(`[NIP-42] Connecting to ${relayUrl}...`);
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

  // Group instance management with hybrid model (flat map + secondary index)
  const groupInstances = useRef<Map<string, GroupInstance>>(new Map());
  const groupIndex = useRef<Map<string, Set<string>>>(new Map());
  // Legacy compatibility
  const legacyGroupRelays = useRef<Map<string, string>>(new Map());

  // Create composite ID for group instances
  const createCompositeId = useCallback((groupId: string, relayUrl: string): string => {
    const normalized = normalizeRelayUrl(relayUrl);
    if (!normalized) {
      throw new Error(`Invalid relay URL: ${relayUrl}`);
    }
    return `${groupId}@${normalized}`;
  }, []);

  // Add a group instance to tracking
  const addGroupInstance = useCallback((instance: GroupInstance) => {
    const metadata = instance.metadata;
    let groupId: string;
    let relayUrl: string;

    if (metadata.protocol === 'nip29') {
      groupId = metadata.groupId;
      relayUrl = metadata.relayUrl;
    } else {
      // NIP-72 doesn't have a specific relay, skip instance tracking
      warn('[Groups] Cannot add NIP-72 community as group instance');
      return;
    }

    const compositeId = createCompositeId(groupId, relayUrl);
    
    if (groupInstances.current.has(compositeId)) {
      log(`[Groups] Updating existing group instance: ${compositeId}`);
    } else {
      log(`[Groups] Adding new group instance: ${compositeId}`);
    }

    groupInstances.current.set(compositeId, instance);

    // Update secondary index
    if (!groupIndex.current.has(groupId)) {
      groupIndex.current.set(groupId, new Set());
    }
    groupIndex.current.get(groupId)!.add(compositeId);

    // Update legacy map for compatibility
    legacyGroupRelays.current.set(groupId, relayUrl);
  }, [createCompositeId]);

  // Resolve specific group instance by composite ID
  const resolveGroupInstance = useCallback((compositeId: string): GroupInstance | undefined => {
    return groupInstances.current.get(compositeId);
  }, []);

  // Get all instances for a group ID
  const getGroupInstances = useCallback((groupId: string): GroupInstance[] => {
    const compositeIds = groupIndex.current.get(groupId);
    if (!compositeIds || compositeIds.size === 0) {
      return [];
    }

    return Array.from(compositeIds)
      .map(id => groupInstances.current.get(id))
      .filter((instance): instance is GroupInstance => !!instance);
  }, []);

  // Remove group instance
  const removeGroupInstance = useCallback((compositeId: string) => {
    const instance = groupInstances.current.get(compositeId);
    if (!instance) {
      warn(`[Groups] Cannot remove unknown group instance: ${compositeId}`);
      return;
    }

    const metadata = instance.metadata;
    if (metadata.protocol === 'nip29') {
      const groupId = metadata.groupId;
      
      groupInstances.current.delete(compositeId);

      // Update secondary index
      const indexedSet = groupIndex.current.get(groupId);
      if (indexedSet) {
        indexedSet.delete(compositeId);
        if (indexedSet.size === 0) {
          groupIndex.current.delete(groupId);
          // Also clear legacy map if no instances remain
          legacyGroupRelays.current.delete(groupId);
        }
      }
      
      log(`[Groups] Removed group instance: ${compositeId}`);
    }
  }, []);

  // Legacy compatibility methods
  const addGroupRelay = useCallback((groupId: string, relay: string) => {
    legacyGroupRelays.current.set(groupId, relay);
    log(`[Groups] Legacy: Registered relay ${relay} for group ${groupId}`);
  }, []);

  const getGroupRelay = useCallback((groupId: string): string | undefined => {
    // First check if we have tracked instances for this group
    const instances = getGroupInstances(groupId);
    if (instances.length > 0) {
      // Return the first instance's relay (or implement preferred logic later)
      const firstInstance = instances[0];
      if (firstInstance.metadata.protocol === 'nip29') {
        return firstInstance.metadata.relayUrl;
      }
    }
    
    // Fallback to legacy map
    return legacyGroupRelays.current.get(groupId);
  }, [getGroupInstances]);

  const getNip29DefaultRelay = useCallback((): string => {
    return defaultNip29Relay;
  }, [defaultNip29Relay]);

  // Create the enhanced pool with group-aware routing
  const pool = useMemo(() => {
    return new NPool({
      open,
      reqRouter: async (filters: NostrFilter[]) => {
        const relayMap = new Map<string, NostrFilter[]>();
        
        log('[EnhancedNostrProvider] Routing query filters:', filters);
        
        for (const filter of filters) {
          // Check if this is a NIP-29 query (relay-generated kinds 39000-39003)
          if (filter.kinds?.some(k => k >= 39000 && k <= 39003)) {
            log('[NIP-29] Detected NIP-29 query, analyzing for group instances');
            
            // Extract group ID from filter (typically in #d tag for addressable events)
            const groupId = filter['#d']?.[0] || filter['#h']?.[0];
            
            log('[NIP-29] Filter analysis:', {
              kinds: filter.kinds,
              dTag: filter['#d'],
              hTag: filter['#h'],
              groupId,
            });
            
            if (groupId) {
              // Check if we have tracked instances for this specific group
              const instances = getGroupInstances(groupId);
              
              if (instances.length > 0) {
                log(`[NIP-29] Found ${instances.length} tracked instances for group ${groupId}`);
                
                // Route to ALL known relays for this group to ensure completeness
                for (const instance of instances) {
                  if (instance.metadata.protocol === 'nip29') {
                    const relayUrl = instance.metadata.relayUrl;
                    if (!relayMap.has(relayUrl)) {
                      relayMap.set(relayUrl, []);
                    }
                    relayMap.get(relayUrl)!.push(filter);
                    log(`[NIP-29] Routing query to tracked instance relay: ${relayUrl}`);
                  }
                }
              } else {
                // No tracked instances - this might be discovery mode
                // Check legacy map as fallback
                const legacyRelay = legacyGroupRelays.current.get(groupId);
                if (legacyRelay) {
                  const normalizedRelay = normalizeRelayUrl(legacyRelay);
                  if (normalizedRelay) {
                    if (!relayMap.has(normalizedRelay)) {
                      relayMap.set(normalizedRelay, []);
                    }
                    relayMap.get(normalizedRelay)!.push(filter);
                    log(`[NIP-29] Routing query to legacy relay: ${normalizedRelay}`);
                  }
                } else {
                  // True discovery mode - use default NIP-29 relay
                  if (!relayMap.has(defaultNip29Relay)) {
                    relayMap.set(defaultNip29Relay, []);
                  }
                  relayMap.get(defaultNip29Relay)!.push(filter);
                  log(`[NIP-29] Discovery mode: routing to default NIP-29 relay ${defaultNip29Relay}`);
                }
              }
            } else {
              // No specific group ID - general NIP-29 query (e.g., browsing all groups)
              // Use default NIP-29 relay for discovery
              if (!relayMap.has(defaultNip29Relay)) {
                relayMap.set(defaultNip29Relay, []);
              }
              relayMap.get(defaultNip29Relay)!.push(filter);
              log(`[NIP-29] General query: routing to default NIP-29 relay ${defaultNip29Relay}`);
            }
          } else {
            // Regular query - use NIP-72 relays
            log('[NIP-72] Routing query to default NIP-72 relays');
            for (const relay of defaultRelays) {
              if (!relayMap.has(relay)) {
                relayMap.set(relay, []);
              }
              relayMap.get(relay)!.push(filter);
            }
          }
        }
        
        log('[EnhancedNostrProvider] Final relay routing:', Array.from(relayMap.keys()));
        return relayMap;
      },
      eventRouter: async (event: NostrEvent) => {
        const relayUrls: string[] = [];
        
        log(`[EnhancedNostrProvider] Routing event kind ${event.kind}`);
        
        // Check if this is a NIP-29 event (user-generated for groups: 9000-9030, or relay-generated: 39000+)
        const hTag = event.tags.find(tag => tag[0] === 'h');
        if (hTag || (((event.kind >= 9000 && event.kind <= 9030) || event.kind === 11)) || (event.kind >= 39000)) {
          log('[NIP-29] Detected NIP-29 event, analyzing for group instances');
          
          // Extract group ID from the event
          const groupId = hTag?.[1];
          
          if (groupId) {
            // Check if we have tracked instances for this specific group
            const instances = getGroupInstances(groupId);
            
            if (instances.length > 0) {
              log(`[NIP-29] Found ${instances.length} tracked instances for group ${groupId}`);
              
              // For publishing, we typically want to target the specific relay where the user is active
              // For now, use the first instance's relay (could be enhanced with user preference later)
              const firstInstance = instances[0];
              if (firstInstance.metadata.protocol === 'nip29') {
                relayUrls.push(firstInstance.metadata.relayUrl);
                log(`[NIP-29] Routing event to tracked instance relay: ${firstInstance.metadata.relayUrl}`);
              }
            } else {
              // No tracked instances - check legacy map as fallback
              const legacyRelay = legacyGroupRelays.current.get(groupId);
              if (legacyRelay) {
                const normalizedRelay = normalizeRelayUrl(legacyRelay);
                if (normalizedRelay) {
                  relayUrls.push(normalizedRelay);
                  log(`[NIP-29] Routing event to legacy relay: ${normalizedRelay}`);
                }
              } else {
                // Use default NIP-29 relay
                relayUrls.push(defaultNip29Relay);
                log(`[NIP-29] No group instance found, routing to default NIP-29 relay ${defaultNip29Relay}`);
              }
            }
          } else {
            // No group ID - general NIP-29 event
            relayUrls.push(defaultNip29Relay);
            log(`[NIP-29] General event: routing to default NIP-29 relay ${defaultNip29Relay}`);
          }
        } else {
          // Regular event - use NIP-72 relays
          log('[NIP-72] Routing event to default NIP-72 relays');
          relayUrls.push(...defaultRelays);
        }
        
        log('[EnhancedNostrProvider] Final event routing:', relayUrls);
        return relayUrls;
      }
    });
  }, [defaultRelays, defaultNip29Relay, open, getGroupInstances]);

  /**
   * Enhanced query with authentication support
   */
  const query = useCallback(async (
    filters: NostrFilter[],
    opts?: { signal?: AbortSignal; relays?: string[] }
  ): Promise<NostrEvent[]> => {
    log('[Query] Starting query with filters:', JSON.stringify(filters, null, 2));
    log('[Query] Query options:', { relays: opts?.relays, hasSignal: !!opts?.signal });
    
    // If specific relays are provided, ensure they're authenticated
    if (opts?.relays) {
      log('[Query] Ensuring authentication for relays:', opts.relays);
      for (const relay of opts.relays) {
        await ensureRelayAuth(relay);
      }
    }

    // If specific relays are provided, create a temporary pool for this query
    if (opts?.relays && opts.relays.length > 0) {
      log(`[Query] Creating temporary pool for relays:`, opts.relays);
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
      log('[Query] Executing query on temporary pool...');
      const events = await tempPool.query(filters, opts);
      const eventsArray = Array.from(events);
      log(`[Query] Temporary pool returned ${eventsArray.length} events`);
      eventsArray.forEach((event, index) => {
        log(`[Query] Event ${index + 1}:`, {
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
      log(`[Query] Using enhanced pool for NIP-29 query`);
      const events = await pool.query(filters, opts);
      const eventsArray = Array.from(events);
      log(`[Query] Enhanced pool returned ${eventsArray.length} events`);
      return eventsArray;
    } else {
      // Use the base nostr for NIP-72 queries
      log('[Query] Using base nostr for NIP-72 query');
      const events = await baseNostr.nostr.query(filters, opts ? { signal: opts.signal } : undefined);
      log(`[Query] Base nostr returned ${events.length} events`);
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
        log(`[Publish] Publishing NIP-29 event to group relay: ${groupRelay}`);
      } else if (opts.relays && opts.relays.length > 0) {
        // Use the specified relay and register it for future use
        targetRelays = opts.relays;
        addGroupRelay(opts.groupId, opts.relays[0]);
        log(`[Publish] Publishing NIP-29 event to new relay: ${opts.relays[0]}`);
      } else {
        // Use default NIP-29 relay
        targetRelays = [defaultNip29Relay];
        addGroupRelay(opts.groupId, defaultNip29Relay);
        log(`[Publish] Publishing NIP-29 event to default relay: ${defaultNip29Relay}`);
      }
    } else if (opts?.groupType === "nip72") {
      // For NIP-72, explicitly use the NIP-72 relays
      targetRelays = defaultRelays;
      log(`[Publish] Publishing NIP-72 event to NIP-72 relays: ${defaultRelays.join(', ')}`);
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
      log(`[Publish] Publishing NIP-29 event via enhanced pool to: ${targetRelays.join(', ')}`);
      await pool.event(event, { ...opts, relays: targetRelays, signal: AbortSignal.timeout(10000) });
    } else {
      // Use the base nostr for NIP-72 events
      log(`[Publish] Publishing NIP-72 event via base nostr`);
      await baseNostr.nostr.event(event, opts ? { signal: opts.signal } : undefined);
    }
  }, [pool, defaultRelays, defaultNip29Relay, getGroupRelay, addGroupRelay, handleAuthChallenge, baseNostr]);

  const enhancedNostr: EnhancedNostr = useMemo(() => ({
    pool,
    query,
    event,
    // New group instance management
    addGroupInstance,
    resolveGroupInstance,
    getGroupInstances,
    removeGroupInstance,
    createCompositeId,
    // Legacy methods
    addGroupRelay,
    getGroupRelay,
    getNip29DefaultRelay
  }), [
    pool, 
    query, 
    event, 
    addGroupInstance,
    resolveGroupInstance,
    getGroupInstances,
    removeGroupInstance,
    createCompositeId,
    addGroupRelay, 
    getGroupRelay, 
    getNip29DefaultRelay
  ]);
  
  // Preconnect to NIP-29 relays on mount
  useEffect(() => {
    log('[EnhancedNostrProvider] Preconnecting to NIP-29 relays...');
    for (const relay of nip29Relays) {
      try {
        open(relay);
        log(`[EnhancedNostrProvider] Initiated connection to ${relay}`);
      } catch (error) {
        logError(`[EnhancedNostrProvider] Failed to connect to ${relay}:`, error);
      }
    }
  }, [nip29Relays, open]);

  return (
    <EnhancedNostrContext.Provider value={{ nostr: enhancedNostr }}>
      {children}
    </EnhancedNostrContext.Provider>
  );
}
