# Group Metadata Local Storage Caching Implementation Plan

## Overview
This plan outlines the implementation of local storage caching for NIP-72 and NIP-29 group metadata to make the groups page feel instant by showing cached data immediately while updating in the background.

## 1. Data to Cache

### Primary Cache Data
- **Group Metadata** (both NIP-72 and NIP-29)
  - id, name, description, image
  - pubkey, created_at
  - Type-specific data:
    - NIP-72: identifier, moderators, tags
    - NIP-29: groupId, relay, admins, members, isOpen, isPublic
  
- **Group Member Lists**
  - Full member lists for NIP-29 groups
  - Admin/moderator lists for both types
  - User's role in each group

- **Group Statistics** (for NIP-72)
  - Member count
  - Post count
  - Last activity timestamp

- **User's Group Relationships**
  - Pinned groups
  - Owned groups
  - Moderated groups
  - Member groups
  - Pending join requests

### Secondary Cache Data
- Recent posts per group (top 5-10)
- Group deletion requests
- Timestamp of last successful fetch

## 2. Cache Structure and Storage Format

### Storage Keys
```typescript
// Primary keys
const CACHE_KEYS = {
  // Group metadata by ID
  GROUP_METADATA: 'nostr:groups:metadata:v1',
  
  // User-specific data
  USER_GROUPS: (pubkey: string) => `nostr:user:${pubkey}:groups:v1`,
  USER_PINNED: (pubkey: string) => `nostr:user:${pubkey}:pinned:v1`,
  USER_PENDING: (pubkey: string) => `nostr:user:${pubkey}:pending:v1`,
  
  // Group-specific data
  GROUP_MEMBERS: (groupId: string) => `nostr:group:${groupId}:members:v1`,
  GROUP_STATS: (groupId: string) => `nostr:group:${groupId}:stats:v1`,
  
  // Meta information
  CACHE_TIMESTAMP: 'nostr:groups:cache:timestamp:v1',
  CACHE_VERSION: 'nostr:groups:cache:version:v1',
};
```

### Data Format
```typescript
interface CachedGroupData {
  groups: Map<string, Group>; // Group ID -> Group object
  timestamp: number; // Last update timestamp
  version: string; // Cache version for migrations
}

interface CachedUserGroups {
  owned: string[]; // Group IDs
  moderated: string[];
  member: string[];
  timestamp: number;
}

interface CachedGroupMembers {
  members: string[]; // Pubkeys
  admins: string[];
  moderators: string[];
  timestamp: number;
}

interface CacheMetadata {
  lastFullSync: number;
  partialSyncs: Map<string, number>; // GroupID -> timestamp
  cacheVersion: string;
}
```

## 3. Cache Invalidation Strategy

### Time-based Invalidation
- **Full cache**: 24 hours
- **Group metadata**: 1 hour
- **Member lists**: 30 minutes
- **User relationships**: 5 minutes
- **Statistics**: 10 minutes

### Event-based Invalidation
- When user creates/modifies a group
- When user joins/leaves a group
- When user's role changes
- On explicit refresh action
- On login/logout

### Partial Updates
- Update only changed groups instead of full cache refresh
- Track individual group update timestamps
- Background refresh for stale data while showing cached version

## 4. Settings to Enable/Disable Caching

### User Settings
```typescript
interface CacheSettings {
  enabled: boolean; // Master switch
  autoRefresh: boolean; // Background updates
  cacheGroups: boolean; // Cache group metadata
  cacheMembers: boolean; // Cache member lists
  cacheStats: boolean; // Cache statistics
  maxCacheAge: number; // Max age in hours (default: 24)
  maxCacheSize: number; // Max size in MB (default: 10)
}
```

### Settings UI Location
- Add new section in Settings page: "Performance & Cache"
- Include cache size indicator
- Clear cache button
- Toggle for each cache type

## 5. Implementation Approach

### New Utilities

#### `/src/lib/cache/groupCache.ts`
```typescript
import { Group } from "@/types/groups";

export class GroupCache {
  private readonly VERSION = "1.0.0";
  
  async getCachedGroups(): Promise<CachedGroupData | null> {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.GROUP_METADATA);
      if (!cached) return null;
      
      const data = JSON.parse(cached);
      if (this.isExpired(data.timestamp)) return null;
      
      return data;
    } catch {
      return null;
    }
  }
  
  async setCachedGroups(groups: Group[]): Promise<void> {
    const data: CachedGroupData = {
      groups: new Map(groups.map(g => [g.id, g])),
      timestamp: Date.now(),
      version: this.VERSION,
    };
    
    localStorage.setItem(CACHE_KEYS.GROUP_METADATA, JSON.stringify({
      ...data,
      groups: Array.from(data.groups.entries()),
    }));
  }
  
  async updateGroup(group: Group): Promise<void> {
    const cached = await this.getCachedGroups();
    if (!cached) return;
    
    cached.groups.set(group.id, group);
    await this.setCachedGroups(Array.from(cached.groups.values()));
  }
  
  private isExpired(timestamp: number, maxAge = 3600000): boolean {
    return Date.now() - timestamp > maxAge;
  }
  
  async clearCache(): Promise<void> {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith('nostr:groups:') || key.startsWith('nostr:user:')
    );
    keys.forEach(key => localStorage.removeItem(key));
  }
}
```

#### `/src/lib/cache/cacheSettings.ts`
```typescript
export class CacheSettings {
  private readonly KEY = 'nostr:cache:settings:v1';
  
  getSettings(): CacheSettings {
    const stored = localStorage.getItem(this.KEY);
    return stored ? JSON.parse(stored) : this.getDefaults();
  }
  
  updateSettings(settings: Partial<CacheSettings>): void {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(this.KEY, JSON.stringify(updated));
  }
  
  private getDefaults(): CacheSettings {
    return {
      enabled: true,
      autoRefresh: true,
      cacheGroups: true,
      cacheMembers: true,
      cacheStats: true,
      maxCacheAge: 24,
      maxCacheSize: 10,
    };
  }
}
```

### Enhanced Hooks

#### Enhanced `useUnifiedGroups` Hook
```typescript
export function useUnifiedGroups() {
  const cache = useMemo(() => new GroupCache(), []);
  const settings = useMemo(() => new CacheSettings(), []);
  const [cachedData, setCachedData] = useState<CachedGroupData | null>(null);
  
  // Load cached data immediately
  useEffect(() => {
    if (settings.getSettings().enabled) {
      cache.getCachedGroups().then(setCachedData);
    }
  }, []);
  
  // Existing query with background update
  const query = useQuery({
    queryKey: ["unified-groups", user?.pubkey, pinnedGroups, nip29Groups],
    queryFn: async (c) => {
      // ... existing query logic ...
      
      // Update cache after successful fetch
      if (result.allGroups && settings.getSettings().enabled) {
        await cache.setCachedGroups(result.allGroups);
      }
      
      return result;
    },
    // Show stale data while refetching
    staleTime: settings.getSettings().enabled ? 300000 : 0, // 5 minutes if cache enabled
    cacheTime: 3600000, // Keep in React Query cache for 1 hour
    refetchOnWindowFocus: !settings.getSettings().enabled,
  });
  
  // Return cached data immediately, then fresh data when available
  return {
    ...query,
    data: query.data || cachedData?.groups || [],
    isFromCache: !query.data && !!cachedData,
  };
}
```

#### New `useCachedGroups` Hook
```typescript
export function useCachedGroups() {
  const cache = useMemo(() => new GroupCache(), []);
  const [cachedGroups, setCachedGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    cache.getCachedGroups()
      .then(data => {
        if (data) {
          setCachedGroups(Array.from(data.groups.values()));
        }
      })
      .finally(() => setIsLoading(false));
  }, []);
  
  return { cachedGroups, isLoading };
}
```

#### Enhanced `useNip29Groups` Hook
```typescript
export function useNip29Groups(groupRelays: string[] = []) {
  const cache = useMemo(() => new GroupCache(), []);
  const settings = useMemo(() => new CacheSettings(), []);
  
  // Load cached NIP-29 groups immediately
  const { cachedGroups } = useCachedGroups();
  const cachedNip29Groups = useMemo(() => 
    cachedGroups.filter(g => g.type === 'nip29'),
    [cachedGroups]
  );
  
  const query = useQuery({
    // ... existing query options ...
    
    // Return cached data as initial data
    initialData: cachedNip29Groups.length > 0 ? cachedNip29Groups : undefined,
    
    onSuccess: async (groups) => {
      // Update individual groups in cache
      if (settings.getSettings().enabled) {
        for (const group of groups) {
          await cache.updateGroup(group);
        }
      }
    },
  });
  
  return query;
}
```

## 6. Showing Cached Data with Background Updates

### Visual Indicators
```typescript
// In GroupCard component
interface GroupCardProps {
  // ... existing props
  isFromCache?: boolean;
  lastUpdated?: number;
}

function GroupCard({ isFromCache, lastUpdated, ...props }: GroupCardProps) {
  return (
    <Card className={cn(
      "relative",
      isFromCache && "opacity-90"
    )}>
      {isFromCache && (
        <Badge 
          variant="secondary" 
          className="absolute top-2 right-2 text-xs"
        >
          Cached
        </Badge>
      )}
      {/* Rest of the component */}
    </Card>
  );
}
```

### Loading States
```typescript
// In Groups page
function Groups() {
  const { cachedGroups, isLoading: isCacheLoading } = useCachedGroups();
  const { data, isLoading, isFromCache } = useUnifiedGroups();
  
  // Show cached data immediately
  const displayGroups = data?.allGroups || cachedGroups;
  
  return (
    <div>
      {/* Show refresh indicator if loading fresh data */}
      {isFromCache && isLoading && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Updating groups...
        </div>
      )}
      
      {/* Render groups (cached or fresh) */}
      {displayGroups.map(group => (
        <GroupCard 
          key={group.id}
          community={group}
          isFromCache={isFromCache && !data}
          // ... other props
        />
      ))}
    </div>
  );
}
```

## 7. Handling Both NIP-72 and NIP-29 Groups

### Type-specific Caching
```typescript
class GroupCache {
  async getCachedGroupsByType(type: 'nip72' | 'nip29'): Promise<Group[]> {
    const cached = await this.getCachedGroups();
    if (!cached) return [];
    
    return Array.from(cached.groups.values())
      .filter(group => group.type === type);
  }
  
  async updateNip29GroupMembers(
    groupId: string, 
    members: string[], 
    admins: string[]
  ): Promise<void> {
    const key = CACHE_KEYS.GROUP_MEMBERS(groupId);
    const data: CachedGroupMembers = {
      members,
      admins,
      moderators: [],
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  }
}
```

### Relay-specific Caching for NIP-29
```typescript
interface Nip29RelayCache {
  relay: string;
  groups: string[]; // Group IDs
  lastSync: number;
}

class Nip29Cache {
  async getCachedRelayGroups(relay: string): Promise<string[]> {
    const key = `nostr:nip29:relay:${encodeURIComponent(relay)}:v1`;
    const cached = localStorage.getItem(key);
    if (!cached) return [];
    
    const data: Nip29RelayCache = JSON.parse(cached);
    if (this.isExpired(data.lastSync, 1800000)) return []; // 30 min
    
    return data.groups;
  }
}
```

## 8. Migration and Versioning

### Cache Version Management
```typescript
class CacheMigration {
  async migrate(): Promise<void> {
    const currentVersion = localStorage.getItem(CACHE_KEYS.CACHE_VERSION);
    
    if (!currentVersion) {
      // First time - clear any old cache format
      this.clearOldCache();
    } else if (currentVersion < this.VERSION) {
      // Run migrations based on version
      await this.runMigrations(currentVersion, this.VERSION);
    }
    
    localStorage.setItem(CACHE_KEYS.CACHE_VERSION, this.VERSION);
  }
}
```

## 9. Performance Monitoring

### Cache Hit Rate Tracking
```typescript
class CacheMetrics {
  private hits = 0;
  private misses = 0;
  
  recordHit(): void {
    this.hits++;
    this.updateMetrics();
  }
  
  recordMiss(): void {
    this.misses++;
    this.updateMetrics();
  }
  
  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }
  
  private updateMetrics(): void {
    if ((this.hits + this.misses) % 100 === 0) {
      console.log(`Cache hit rate: ${(this.getHitRate() * 100).toFixed(1)}%`);
    }
  }
}
```

## 10. Implementation Timeline

### Phase 1: Core Infrastructure (Days 1-2)
- Create cache utilities and classes
- Implement basic get/set operations
- Add cache settings management

### Phase 2: Hook Integration (Days 3-4)
- Enhance useUnifiedGroups with caching
- Update useNip29Groups for cached data
- Add cache warming on app load

### Phase 3: UI Updates (Days 5-6)
- Add cache indicators to GroupCard
- Implement settings UI
- Add refresh controls

### Phase 4: Optimization (Days 7-8)
- Implement background updates
- Add cache size management
- Performance monitoring

### Phase 5: Testing & Polish (Days 9-10)
- Test with various data sizes
- Handle edge cases
- Add user documentation

## Success Metrics
- Groups page loads instantly (< 100ms) with cached data
- Background updates complete within 5 seconds
- Cache hit rate > 80% for returning users
- Storage usage < 10MB for typical user
- No UI jank during background updates