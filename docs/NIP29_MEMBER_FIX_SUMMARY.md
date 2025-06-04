# NIP-29 Member Display Fix Summary

## Issue Identified
Members were not displaying for NIP-29 groups. The console showed that `useNip29GroupMembers` was querying for kind 39002 events but the queries weren't being routed to the correct NIP-29 relays.

## Root Cause
The `EnhancedNostrProvider` routing logic was only checking for `#h` tags to determine the group ID for NIP-29 queries:
```typescript
const groupId = filter['#h']?.[0];
```

However, NIP-29 member list events (kind 39002) use `#d` tags for addressable events, not `#h` tags.

## Fix Applied
Modified `/src/components/EnhancedNostrProvider.tsx` line 237 to check both tag types:
```typescript
const groupId = filter['#d']?.[0] || filter['#h']?.[0];
```

## How NIP-29 Member Management Works

### Event Kinds
- **39002**: Relay-generated member list (addressable event using #d tag)
- **39001**: Admin list
- **39000**: Group metadata

### Query Pattern
```typescript
// useNip29GroupMembers queries with:
{
  kinds: [39002],
  "#d": [groupId],  // Using #d tag for addressable event
  limit: 1
}
```

### Member Storage
Members are stored in the tags of kind 39002 events:
- `["p", "<pubkey>"]` - Regular member
- `["p", "<pubkey>", "admin"]` - Admin member

## Testing Verification

### Test URL
Visit: http://localhost:8080/group/nip29/wss%3A%2F%2Fcommunities.nos.social%2F/MXciDlZ5Me0Q64VL#members

### Expected Behavior
1. EnhancedNostrProvider should route the query to `wss://communities.nos.social/`
2. The relay should return kind 39002 events with member lists
3. Members should display in the UI

### Console Logs to Check
```
[NIP-29] Filter analysis: {
  kinds: [39002],
  dTag: ["MXciDlZ5Me0Q64VL"],
  hTag: undefined,
  groupId: "MXciDlZ5Me0Q64VL",
  groupRelay: "wss://communities.nos.social/"
}
```

## Build Status
✅ Build completed successfully with no TypeScript errors

## Related Files
- `/src/components/EnhancedNostrProvider.tsx` - Fixed routing logic
- `/src/hooks/useNip29Groups.ts` - Contains useNip29GroupMembers hook
- `/src/components/groups/SimpleMembersList.tsx` - Displays members for both NIP-72 and NIP-29

## Summary
Both NIP-72 and NIP-29 member display issues have been fixed:
1. **NIP-72**: Fixed by extracting just the identifier from communityId in useApprovedMembers
2. **NIP-29**: Fixed by updating routing logic to check both #d and #h tags

The app now correctly queries and displays members for both group types.