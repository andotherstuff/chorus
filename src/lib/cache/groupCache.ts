import { Group } from '@/types/groups';

// Cache version for migration handling
const CACHE_VERSION = 'v1';

// Cache keys
export const CACHE_KEYS = {
  GROUPS: `chorus_groups_${CACHE_VERSION}`,
  GROUP_MEMBERS: `chorus_group_members_${CACHE_VERSION}`,
  USER_GROUPS: `chorus_user_groups_${CACHE_VERSION}`,
  NIP29_CACHE: `chorus_nip29_cache_${CACHE_VERSION}`,
  CACHE_SETTINGS: 'chorus_cache_settings',
  CACHE_METADATA: `chorus_cache_metadata_${CACHE_VERSION}`,
} as const;

// Cache TTLs (in milliseconds)
export const CACHE_TTLS = {
  GROUP_METADATA: 7 * 24 * 60 * 60 * 1000, // 7 days for group metadata (rarely changes)
  MEMBER_LISTS: 60 * 60 * 1000, // 1 hour for member lists
  USER_GROUPS: 5 * 60 * 1000, // 5 minutes for user's group relationships
  GROUP_STATS: 15 * 60 * 1000, // 15 minutes for stats
  NIP29_AUTH: 24 * 60 * 60 * 1000, // 24 hours for NIP-29 auth state
} as const;

// Cache settings interface
export interface CacheSettings {
  enabled: boolean;
  maxSizeBytes: number;
  showIndicators: boolean;
  groupMetadataTTL: number;
  memberListsTTL: number;
  debugMode: boolean;
}

// Default cache settings
export const DEFAULT_CACHE_SETTINGS: CacheSettings = {
  enabled: true,
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  showIndicators: true,
  groupMetadataTTL: CACHE_TTLS.GROUP_METADATA,
  memberListsTTL: CACHE_TTLS.MEMBER_LISTS,
  debugMode: false,
};

// Cache entry interface
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  version: string;
}

// Group cache data structure
export interface GroupCacheData {
  groups: Map<string, Group>;
  lastFetch: number;
  partialUpdate: boolean;
}

// Member cache data structure
export interface MemberCacheData {
  groupId: string;
  owners: string[];
  moderators: string[];
  members: string[];
  approvedMembers: string[];
  lastFetch: number;
}

// User groups cache data structure
export interface UserGroupsCacheData {
  userPubkey: string;
  ownedGroups: string[];
  moderatedGroups: string[];
  memberGroups: string[];
  pinnedGroups: string[];
  lastFetch: number;
}

/**
 * GroupCache class - Manages caching for group metadata
 */
export class GroupCache {
  private settings: CacheSettings;

  constructor() {
    this.settings = this.loadSettings();
  }

  /**
   * Load cache settings from localStorage
   */
  private loadSettings(): CacheSettings {
    try {
      const stored = localStorage.getItem(CACHE_KEYS.CACHE_SETTINGS);
      if (stored) {
        return { ...DEFAULT_CACHE_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[GroupCache] Error loading settings:', error);
    }
    return DEFAULT_CACHE_SETTINGS;
  }

  /**
   * Save cache settings to localStorage
   */
  saveSettings(settings: Partial<CacheSettings>): void {
    this.settings = { ...this.settings, ...settings };
    try {
      localStorage.setItem(CACHE_KEYS.CACHE_SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('[GroupCache] Error saving settings:', error);
    }
  }

  /**
   * Get cache settings
   */
  getSettings(): CacheSettings {
    return this.settings;
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.settings.enabled && !this.settings.debugMode;
  }

  /**
   * Store data in cache with TTL
   */
  private setCache<T>(key: string, data: T, ttl: number): boolean {
    if (!this.isEnabled()) return false;

    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        version: CACHE_VERSION,
      };

      const serialized = JSON.stringify(entry);
      
      // Check size before storing
      if (serialized.length > this.settings.maxSizeBytes) {
        console.warn(`[GroupCache] Cache entry too large for ${key}`);
        return false;
      }

      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error(`[GroupCache] Error setting cache for ${key}:`, error);
      this.handleStorageError(error);
      return false;
    }
  }

  /**
   * Get data from cache if valid
   */
  private getCache<T>(key: string): T | null {
    if (!this.isEnabled()) return null;

    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const entry: CacheEntry<T> = JSON.parse(stored);
      
      // Check version
      if (entry.version !== CACHE_VERSION) {
        localStorage.removeItem(key);
        return null;
      }

      // Check TTL
      const age = Date.now() - entry.timestamp;
      if (age > entry.ttl) {
        localStorage.removeItem(key);
        return null;
      }

      if (this.settings.debugMode) {
        console.log(`[GroupCache] Cache hit for ${key}, age: ${Math.round(age / 1000)}s`);
      }

      return entry.data;
    } catch (error) {
      console.error(`[GroupCache] Error getting cache for ${key}:`, error);
      localStorage.removeItem(key);
      return null;
    }
  }

  /**
   * Store groups in cache
   */
  setGroups(groups: Group[]): boolean {
    const cacheData: GroupCacheData = {
      groups: new Map(groups.map(g => [g.id, g])),
      lastFetch: Date.now(),
      partialUpdate: false,
    };

    // Convert Map to array for JSON serialization
    const serializable = {
      ...cacheData,
      groups: Array.from(cacheData.groups.entries()),
    };

    return this.setCache(CACHE_KEYS.GROUPS, serializable, this.settings.groupMetadataTTL);
  }

  /**
   * Get groups from cache
   */
  getGroups(): Group[] | null {
    const cached = this.getCache<{ groups: [string, Group][], lastFetch: number, partialUpdate: boolean }>(CACHE_KEYS.GROUPS);
    if (!cached) return null;

    // Reconstruct Map from array
    const cacheData: GroupCacheData = {
      ...cached,
      groups: new Map(cached.groups),
    };

    return Array.from(cacheData.groups.values());
  }

  /**
   * Update a single group in cache
   */
  updateGroup(group: Group): boolean {
    const cached = this.getCache<{ groups: [string, Group][], lastFetch: number, partialUpdate: boolean }>(CACHE_KEYS.GROUPS);
    if (!cached) return false;

    const cacheData: GroupCacheData = {
      ...cached,
      groups: new Map(cached.groups),
    };

    cacheData.groups.set(group.id, group);
    cacheData.partialUpdate = true;

    const serializable = {
      ...cacheData,
      groups: Array.from(cacheData.groups.entries()),
    };

    return this.setCache(CACHE_KEYS.GROUPS, serializable, this.settings.groupMetadataTTL);
  }

  /**
   * Store member data for a group
   */
  setGroupMembers(groupId: string, members: MemberCacheData): boolean {
    const key = `${CACHE_KEYS.GROUP_MEMBERS}_${groupId}`;
    return this.setCache(key, members, this.settings.memberListsTTL);
  }

  /**
   * Get member data for a group
   */
  getGroupMembers(groupId: string): MemberCacheData | null {
    const key = `${CACHE_KEYS.GROUP_MEMBERS}_${groupId}`;
    return this.getCache<MemberCacheData>(key);
  }

  /**
   * Store user's groups
   */
  setUserGroups(userPubkey: string, data: UserGroupsCacheData): boolean {
    const key = `${CACHE_KEYS.USER_GROUPS}_${userPubkey}`;
    return this.setCache(key, data, CACHE_TTLS.USER_GROUPS);
  }

  /**
   * Get user's groups
   */
  getUserGroups(userPubkey: string): UserGroupsCacheData | null {
    const key = `${CACHE_KEYS.USER_GROUPS}_${userPubkey}`;
    return this.getCache<UserGroupsCacheData>(key);
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    Object.values(CACHE_KEYS).forEach(key => {
      if (key === CACHE_KEYS.CACHE_SETTINGS) return; // Don't clear settings
      
      // Clear base keys
      localStorage.removeItem(key);
      
      // Clear any keys that start with this prefix (for grouped data)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey?.startsWith(key)) {
          keysToRemove.push(storageKey);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    });

    console.log('[GroupCache] All caches cleared');
  }

  /**
   * Get cache size in bytes
   */
  getCacheSize(): number {
    let totalSize = 0;
    
    Object.values(CACHE_KEYS).forEach(key => {
      // Check base key
      const item = localStorage.getItem(key);
      if (item) totalSize += item.length;
      
      // Check prefixed keys
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey?.startsWith(key)) {
          const value = localStorage.getItem(storageKey);
          if (value) totalSize += value.length;
        }
      }
    });

    return totalSize;
  }

  /**
   * Handle storage errors (quota exceeded, etc.)
   */
  private handleStorageError(error: unknown): void {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('[GroupCache] Storage quota exceeded, clearing old cache entries');
      this.pruneOldEntries();
    }
  }

  /**
   * Remove oldest cache entries to free space
   */
  private pruneOldEntries(): void {
    const entries: { key: string; timestamp: number; size: number }[] = [];

    // Collect all cache entries with timestamps
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !Object.values(CACHE_KEYS).some(k => key.startsWith(k))) continue;
      if (key === CACHE_KEYS.CACHE_SETTINGS) continue;

      try {
        const value = localStorage.getItem(key);
        if (!value) continue;

        const entry = JSON.parse(value);
        if (entry.timestamp) {
          entries.push({
            key,
            timestamp: entry.timestamp,
            size: value.length,
          });
        }
      } catch (e) {
        // Skip invalid entries
      }
    }

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Remove oldest entries until we free 20% of max size
    const targetSize = this.settings.maxSizeBytes * 0.8;
    let currentSize = this.getCacheSize();
    
    for (const entry of entries) {
      if (currentSize <= targetSize) break;
      localStorage.removeItem(entry.key);
      currentSize -= entry.size;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    enabled: boolean;
    size: number;
    itemCount: number;
    hitRate: number;
  } {
    const size = this.getCacheSize();
    let itemCount = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && Object.values(CACHE_KEYS).some(k => key.startsWith(k))) {
        itemCount++;
      }
    }

    return {
      enabled: this.isEnabled(),
      size,
      itemCount,
      hitRate: 0, // This would need to be tracked separately
    };
  }
}

// Singleton instance
export const groupCache = new GroupCache();