# NIP-29 Relay Consistency Fix Plan

## Problem Analysis

From the screenshots and code analysis, the core issue is:

**NIP-29 groups are relay-specific but the app is not maintaining proper relay attribution**

### Current Issues:
1. Groups from `wss://groups.nip29.com/` appear to be available on multiple relays
2. The app loses track of which specific relay instance a group belongs to
3. Discovery and operation modes are mixed, causing relay confusion
4. Users can't distinguish between group instances on different relays

### Root Cause:
The `EnhancedNostrProvider` has relay mapping logic but it's not being used consistently throughout the app, causing groups to show incorrect relay information.

## Implementation Plan

### Phase 1: Data Model & Identity (CRITICAL)

#### Step 1.1: Create URL Normalization Utility
```typescript
// src/lib/relayUtils.ts
export function normalizeRelayUrl(url: string): string {
  // Remove trailing slashes, ensure wss:// protocol
  // Handle edge cases like ws:// -> wss://
}
```

#### Step 1.2: Create GroupInstance Data Model
```typescript
// src/types/nip29.ts
export interface GroupInstance {
  instanceId: string; // `${groupId}@${normalizedRelayUrl}`
  groupId: string;    // The actual group identifier (d tag)
  relayUrl: string;   // Normalized relay URL
  name?: string;
  about?: string;
  picture?: string;
  isJoined: boolean;
  userRole?: 'admin' | 'moderator' | 'member';
  lastFetched: number;
}

export interface Community {
  // Keep existing NIP-72 structure unchanged
  id: string;
  name: string;
  description: string;
  relays: string[]; // Multiple relays for NIP-72
  // ... existing fields
}
```

#### Step 1.3: Update Storage Layer
- Modify group caching to use `instanceId` as primary key
- Separate NIP-29 and NIP-72 storage completely
- Add migration logic for existing data

### Phase 2: Provider Layer Fixes (CRITICAL)

#### Step 2.1: Fix EnhancedNostrProvider Group Tracking
```typescript
// Update the groupRelays.current map to use instanceId
const groupInstances = useRef<Map<string, GroupInstance>>(new Map());

const addGroupInstance = useCallback((groupInstance: GroupInstance) => {
  groupInstances.current.set(groupInstance.instanceId, groupInstance);
}, []);

const getGroupInstance = useCallback((instanceId: string): GroupInstance | undefined => {
  return groupInstances.current.get(instanceId);
}, []);
```

#### Step 2.2: Fix Request Router (reqRouter)
```typescript
// In reqRouter function
for (const filter of filters) {
  if (filter.kinds?.some(k => k >= 39000 && k <= 39003)) {
    // NIP-29 query - must go to specific relay
    const groupId = filter['#d']?.[0] || filter['#h']?.[0];
    
    if (groupId) {
      // Check if we have a known instance for this group
      const knownInstance = Array.from(groupInstances.current.values())
        .find(instance => instance.groupId === groupId);
      
      if (knownInstance) {
        // Send ONLY to the specific relay for this instance
        relayMap.set(knownInstance.relayUrl, [filter]);
        continue;
      }
    }
    
    // Discovery mode: query default NIP-29 relay only
    relayMap.set(defaultNip29Relay, [filter]);
  } else {
    // NIP-72 or other: use default relays
    for (const relay of defaultRelays) {
      if (!relayMap.has(relay)) relayMap.set(relay, []);
      relayMap.get(relay)!.push(filter);
    }
  }
}
```

#### Step 2.3: Fix Event Router (eventRouter)
```typescript
// In eventRouter function
if (event.kind >= 9000 && event.kind <= 9021) {
  // NIP-29 event - must go to specific relay
  const groupId = event.tags.find(tag => tag[0] === 'h')?.[1];
  
  if (groupId) {
    const knownInstance = Array.from(groupInstances.current.values())
      .find(instance => instance.groupId === groupId);
    
    if (knownInstance) {
      return [knownInstance.relayUrl];
    }
  }
  
  // Fallback to default NIP-29 relay
  return [defaultNip29Relay];
}
```

#### Step 2.4: Add Discovery vs Operation Separation
```typescript
export interface EnhancedNostr {
  // ... existing methods
  discoverGroups: (searchTerm?: string) => Promise<GroupInstance[]>;
  joinGroupInstance: (instanceId: string) => Promise<void>;
  getJoinedInstances: () => GroupInstance[];
}
```

### Phase 3: UI/UX Updates

#### Step 3.1: Update Group Cards
```typescript
// src/components/groups/GroupCard.tsx
// Add relay badge for NIP-29 groups
{groupType === 'nip29' && (
  <Badge variant="outline" className="text-xs">
    {relayUrl.replace('wss://', '')}
  </Badge>
)}
```

#### Step 3.2: Update Search Results
```typescript
// Show multiple instances of same group clearly
// "Bitcoin Devs @ groups.nip29.com"
// "Bitcoin Devs @ groups.fiatjaf.com" 
// These should be treated as separate results
```

#### Step 3.3: Group Instance Management
```typescript
// In group detail view, clearly show:
// - Which relay instance user is viewing
// - Option to discover other instances
// - No mixing of data between instances
```

#### Step 3.4: Preserve NIP-72 Experience
```typescript
// Ensure NIP-72 communities:
// - Continue showing "Multi-relay" or no relay info
// - Work exactly as before
// - Are not affected by NIP-29 changes
```

### Phase 4: Data Migration & Safety

#### Step 4.1: Create Migration Script
```typescript
// src/lib/migrations/nip29GroupMigration.ts
export async function migrateGroupData() {
  // 1. Identify existing groups without proper relay attribution
  // 2. Query relays to re-establish correct relay for each group
  // 3. Create proper GroupInstance objects
  // 4. Handle conflicts where same group exists on multiple relays
  // 5. Preserve user's joined status and role information
}
```

#### Step 4.2: Add Validation & Testing
```typescript
// Tests to ensure:
// - NIP-29 groups only query their specific relay
// - NIP-72 communities continue working with multiple relays
// - No data mixing between group instances
// - UI correctly displays relay information
// - Migration doesn't corrupt existing data
```

## Implementation Steps

### Immediate Priority (Fix Core Issue)

1. **Step 1**: Create URL normalization utility (`src/lib/relayUtils.ts`)
2. **Step 2**: Create GroupInstance data model (`src/types/nip29.ts`)
3. **Step 3**: Update EnhancedNostrProvider group tracking
4. **Step 4**: Fix reqRouter to route to specific relays
5. **Step 5**: Fix eventRouter to publish to correct relay
6. **Step 6**: Update group cards to show relay information

### Secondary Priority (UX & Safety)

7. **Step 7**: Add discovery vs operation mode separation
8. **Step 8**: Update search results to show group instances clearly
9. **Step 9**: Create data migration script
10. **Step 10**: Add comprehensive testing

### Validation Steps

After each phase:
- [ ] Verify groups from `groups.nip29.com` only show as being on `groups.nip29.com`
- [ ] Verify NIP-72 communities continue working unchanged
- [ ] Verify no data mixing between group instances
- [ ] Verify users can distinguish between group instances
- [ ] Verify existing functionality preserved

## Success Criteria

✅ **Primary Goal**: Groups show correct relay attribution  
✅ **Secondary Goal**: NIP-72 communities unaffected  
✅ **Tertiary Goal**: Clear UX for group instances  
✅ **Safety Goal**: No breaking changes or data corruption  

## Risk Mitigation

- **Gradual Implementation**: One phase at a time with validation
- **Backward Compatibility**: Keep existing APIs during transition
- **Data Safety**: Migration script with rollback capability
- **User Communication**: Clear UI indicators for relay information

## Timeline Estimate

- **Phase 1**: 2-3 days (critical path)
- **Phase 2**: 2-3 days (provider fixes)  
- **Phase 3**: 1-2 days (UI updates)
- **Phase 4**: 1-2 days (migration & testing)

**Total**: ~6-10 days for complete implementation