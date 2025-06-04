# NIP-29 Group Creator Identification Implementation

## Overview

This implementation adds the ability to identify the actual creator of a NIP-29 group, which is essential for proper eCash ownership attribution. Unlike NIP-72 communities where the event author is the owner, NIP-29 groups require querying for the GROUP_CREATE event or inferring from early admin events.

## Implementation Details

### 1. New Hook: `useNip29GroupCreator`

Located in `/src/hooks/useNip29GroupCreator.ts`, this hook provides two main functions:

#### `useNip29GroupCreator(groupId, relay)`
- Queries for kind 9007 (GROUP_CREATE) events on the specified relay
- Attempts to correlate GROUP_CREATE events with the specific group
- Falls back to finding the first admin event if no CREATE event is found
- Returns creator information including:
  - `creatorPubkey`: The public key of the group creator
  - `createEvent`: The actual GROUP_CREATE event (if found)
  - `createdAt`: Timestamp of group creation
  - `isInferred`: Whether the creator was inferred vs found directly

#### `useIsNip29GroupOwner(groupId, relay, pubkey)`
- Convenience hook to check if a given pubkey is the group owner
- Returns boolean indicating ownership

### 2. Integration with GroupDetail Page

The GroupDetail page has been updated to:
- Import and use the `useNip29GroupCreator` hook
- Determine ownership differently for NIP-29 vs NIP-72 groups
- Pass the correct owner pubkey to the GroupNutzapButton component

```typescript
// For NIP-29 groups, find the actual creator
const { data: creatorInfo } = useNip29GroupCreator(
  parsedRouteId?.type === "nip29" ? parsedRouteId.groupId : undefined,
  parsedRouteId?.type === "nip29" ? parsedRouteId.relay : undefined
);

// Determine ownership based on group type
const isOwner = user && groupData && (
  parsedRouteId?.type === "nip29" 
    ? (creatorInfo?.creatorPubkey === user.pubkey)
    : (user.pubkey === groupData.pubkey)
);

// Get the actual owner pubkey for eCash
const ownerPubkey = parsedRouteId?.type === "nip29"
  ? (creatorInfo?.creatorPubkey || groupData?.pubkey || '')
  : (groupData?.pubkey || '');
```

### 3. eCash Integration

The GroupNutzapButton now receives the correct owner pubkey:
- For NIP-72 groups: Uses the event author (groupData.pubkey)
- For NIP-29 groups: Uses the discovered creator pubkey

This ensures eCash sent to support a group goes to the actual creator, not just any admin.

## Technical Challenges

### GROUP_CREATE Event Correlation

The NIP-29 specification doesn't directly include the group ID in the GROUP_CREATE event, making it challenging to correlate which CREATE event corresponds to which group. The implementation uses two strategies:

1. **Direct Search**: Look for GROUP_CREATE events and then check if the author has admin events for the target group
2. **Inference**: Find the earliest admin event for the group and assume that person is the creator

### Relay-Specific Queries

NIP-29 groups are relay-specific, so all queries must be directed to the group's specific relay. The implementation ensures all queries include the relay parameter.

## Future Improvements

1. **Caching**: The creator information should be cached more aggressively since it doesn't change
2. **Relay Coordination**: Some relays might provide better ways to query for group creators
3. **Event Correlation**: Future NIP-29 updates might include better ways to correlate CREATE events with groups

## Usage Example

```typescript
// In a component that needs to know the group creator
const { data: creatorInfo, isLoading } = useNip29GroupCreator(groupId, relayUrl);

if (isLoading) {
  return <div>Loading creator info...</div>;
}

if (creatorInfo) {
  console.log(`Group created by ${creatorInfo.creatorPubkey} at ${creatorInfo.createdAt}`);
  if (creatorInfo.isInferred) {
    console.log('Note: Creator was inferred from admin events');
  }
}
```

## Testing

Use the test script `test-nip29-creator.js` to verify the implementation:
```bash
node test-nip29-creator.js
```

This will:
1. Login to the app
2. Navigate to a NIP-29 group
3. Check that the creator is properly identified
4. Verify the eCash button uses the correct owner pubkey