import { Nip29Group } from '@/types/groups';
import { NostrEvent } from '@nostrify/nostrify';
import { groupCache, CACHE_KEYS, CACHE_TTLS } from './groupCache';

export interface AuthStatusEntry {
  authenticated: boolean;
  timestamp: number;
  error?: string;
}

interface Nip29CacheData {
  relay: string;
  groups: Map<string, Nip29Group>;
  authStatus: Map<string, AuthStatusEntry>;
  lastFetch: number;
}

interface SerializedNip29CacheData {
  relay: string;
  groups: [string, Nip29Group][];
  authStatus: [string, AuthStatusEntry][];
  lastFetch: number;
}

export interface Nip29ChatCache {
  groupId: string;
  relay: string;
  messages: NostrEvent[];
  lastMessageTime: number;
  lastFetch: number;
}

/**
 * NIP-29 specific caching utilities
 */
export class Nip29Cache {
  /**
   * Store NIP-29 groups by relay
   */
  setRelayGroups(relay: string, groups: Nip29Group[]): boolean {
    const key = `${CACHE_KEYS.NIP29_CACHE}_relay_${this.encodeRelay(relay)}`;
    
    const cacheData: Nip29CacheData = {
      relay,
      groups: new Map(groups.map(g => [g.groupId, g])),
      authStatus: new Map(),
      lastFetch: Date.now(),
    };

    // Convert Maps to arrays for JSON serialization
    const serializable = {
      ...cacheData,
      groups: Array.from(cacheData.groups.entries()),
      authStatus: Array.from(cacheData.authStatus.entries()),
    };

    return this.setCache(key, serializable, CACHE_TTLS.GROUP_METADATA);
  }

  /**
   * Get NIP-29 groups for a relay
   */
  getRelayGroups(relay: string): Nip29Group[] | null {
    const key = `${CACHE_KEYS.NIP29_CACHE}_relay_${this.encodeRelay(relay)}`;
    const cached = this.getCache<SerializedNip29CacheData>(key);
    if (!cached) return null;

    // Reconstruct Maps from arrays
    const cacheData: Nip29CacheData = {
      ...cached,
      groups: new Map(cached.groups),
      authStatus: new Map(cached.authStatus),
    };

    return Array.from(cacheData.groups.values());
  }

  /**
   * Update authentication status for a relay
   */
  updateAuthStatus(relay: string, authenticated: boolean, error?: string): void {
    const key = `${CACHE_KEYS.NIP29_CACHE}_relay_${this.encodeRelay(relay)}`;
    const cached = this.getCache<SerializedNip29CacheData>(key);
    
    if (cached) {
      const cacheData: Nip29CacheData = {
        ...cached,
        groups: new Map(cached.groups),
        authStatus: new Map(cached.authStatus),
      };

      cacheData.authStatus.set(relay, {
        authenticated,
        timestamp: Date.now(),
        error,
      });

      const serializable = {
        ...cacheData,
        groups: Array.from(cacheData.groups.entries()),
        authStatus: Array.from(cacheData.authStatus.entries()),
      };

      this.setCache(key, serializable, CACHE_TTLS.NIP29_AUTH);
    }
  }

  /**
   * Get authentication status for a relay
   */
  getAuthStatus(relay: string): { authenticated: boolean; error?: string } | null {
    const key = `${CACHE_KEYS.NIP29_CACHE}_relay_${this.encodeRelay(relay)}`;
    const cached = this.getCache<SerializedNip29CacheData>(key);
    if (!cached) return null;

    const authStatus = new Map(cached.authStatus);
    const status = authStatus.get(relay);
    if (!status || typeof status !== 'object' || !('authenticated' in status)) return null;
    return status as { authenticated: boolean; error?: string };
  }

  /**
   * Store chat messages for a NIP-29 group
   */
  setChatMessages(groupId: string, relay: string, messages: NostrEvent[]): boolean {
    const key = `${CACHE_KEYS.NIP29_CACHE}_chat_${groupId}`;
    
    const cacheData: Nip29ChatCache = {
      groupId,
      relay,
      messages: messages.slice(0, 100), // Keep only latest 100 messages
      lastMessageTime: messages[0]?.created_at || 0,
      lastFetch: Date.now(),
    };

    return this.setCache(key, cacheData, CACHE_TTLS.USER_GROUPS); // 5 minutes for chat
  }

  /**
   * Get chat messages for a NIP-29 group
   */
  getChatMessages(groupId: string): NostrEvent[] | null {
    const key = `${CACHE_KEYS.NIP29_CACHE}_chat_${groupId}`;
    const cached = this.getCache<Nip29ChatCache>(key);
    return cached?.messages || null;
  }

  /**
   * Store all NIP-29 groups across all relays
   */
  setAllGroups(groupsByRelay: Map<string, Nip29Group[]>): void {
    groupsByRelay.forEach((groups, relay) => {
      this.setRelayGroups(relay, groups);
    });

    // Also store a summary for quick access
    const allGroups: Nip29Group[] = [];
    groupsByRelay.forEach(groups => allGroups.push(...groups));
    
    const summary = {
      totalGroups: allGroups.length,
      relays: Array.from(groupsByRelay.keys()),
      lastFetch: Date.now(),
    };

    this.setCache(`${CACHE_KEYS.NIP29_CACHE}_summary`, summary, CACHE_TTLS.USER_GROUPS);
  }

  /**
   * Get all NIP-29 groups from all cached relays
   */
  getAllGroups(): Nip29Group[] {
    const allGroups: Nip29Group[] = [];
    
    // Look for all relay-specific caches
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${CACHE_KEYS.NIP29_CACHE}_relay_`)) {
        const groups = this.getRelayGroupsFromKey(key);
        if (groups) {
          allGroups.push(...groups);
        }
      }
    }

    return allGroups;
  }

  /**
   * Helper to get groups from a specific cache key
   */
  private getRelayGroupsFromKey(key: string): Nip29Group[] | null {
    const cached = this.getCache<SerializedNip29CacheData>(key);
    if (!cached) return null;

    const cacheData: Nip29CacheData = {
      ...cached,
      groups: new Map(cached.groups),
      authStatus: new Map(cached.authStatus),
    };

    return Array.from(cacheData.groups.values());
  }

  /**
   * Encode relay URL for use as a key
   */
  private encodeRelay(relay: string): string {
    return relay.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * Helper methods that delegate to groupCache
   */
  private setCache<T>(key: string, data: T, ttl: number): boolean {
    try {
      const entry = {
        data,
        timestamp: Date.now(),
        ttl,
        version: 'v1',
      };
      localStorage.setItem(key, JSON.stringify(entry));
      return true;
    } catch (error) {
      console.error(`[Nip29Cache] Error setting cache for ${key}:`, error);
      return false;
    }
  }

  private getCache<T>(key: string): T | null {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const entry = JSON.parse(stored);
      const age = Date.now() - entry.timestamp;
      
      if (age > entry.ttl) {
        localStorage.removeItem(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error(`[Nip29Cache] Error getting cache for ${key}:`, error);
      return null;
    }
  }

  /**
   * Clear all NIP-29 caches
   */
  clearAll(): void {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEYS.NIP29_CACHE)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`[Nip29Cache] Cleared ${keysToRemove.length} cache entries`);
  }

  /**
   * Get cache statistics for NIP-29
   */
  getStats(): {
    relayCount: number;
    groupCount: number;
    chatCacheCount: number;
    totalSize: number;
  } {
    let relayCount = 0;
    let chatCacheCount = 0;
    let totalSize = 0;
    const groups = new Set<string>();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(CACHE_KEYS.NIP29_CACHE)) continue;

      const value = localStorage.getItem(key);
      if (value) {
        totalSize += value.length;

        if (key.includes('_relay_')) {
          relayCount++;
          try {
            const data = JSON.parse(value);
            if (data.data?.groups) {
              data.data.groups.forEach(([id]: [string, Nip29Group]) => groups.add(id));
            }
          } catch (e) {
            // Skip invalid entries
          }
        } else if (key.includes('_chat_')) {
          chatCacheCount++;
        }
      }
    }

    return {
      relayCount,
      groupCount: groups.size,
      chatCacheCount,
      totalSize,
    };
  }
}

// Singleton instance
export const nip29Cache = new Nip29Cache();