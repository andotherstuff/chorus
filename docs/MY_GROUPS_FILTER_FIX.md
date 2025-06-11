# My Groups Filter Fix

## Issue
The "My Groups" filter wasn't working correctly - it wasn't showing groups where the user was a member, particularly for NIP-72 groups.

## Root Cause
The `useUserGroups` hook correctly fetches NIP-72 groups where the user is involved (owner, moderator, or member), but the filtering logic in the Groups page was trying to parse and match these events incorrectly.

## Solution
1. Created a `userGroupIds` Set at the top level that contains all group IDs from the `useUserGroups` hook
2. Simplified the `isUserGroup` function to check if a group ID exists in this set for NIP-72 membership
3. Maintained all existing checks for owners, moderators/admins, NIP-29 members, and pending requests

## Technical Details

### Changes to `/src/pages/Groups.tsx`:

1. Added a memoized `userGroupIds` Set:
```typescript
const userGroupIds = useMemo(() => {
  const groupIds = new Set<string>();
  
  if (userGroups?.allGroups) {
    // Add all NIP-72 groups from useUserGroups
    userGroups.allGroups.forEach(event => {
      const group = parseGroup(event);
      if (group) {
        groupIds.add(getCommunityId(group));
      }
    });
  }
  
  return groupIds;
}, [userGroups]);
```

2. Updated `isUserGroup` function to use the Set:
```typescript
// Check if this group is in the user's group IDs set (for NIP-72 membership)
if (userGroupIds.has(groupId)) {
  return true;
}
```

3. Updated the dependency array to use `userGroupIds` instead of `userGroups`

## How It Works

1. The `useUserGroups` hook fetches all NIP-72 groups where the user is:
   - Owner (author of the group event)
   - Moderator (tagged with role "moderator")
   - Member (listed in approved members lists - kind 30383)

2. We convert these NostrEvent objects to Group IDs and store them in a Set for O(1) lookup

3. When filtering groups, we check multiple conditions:
   - Is user the owner?
   - Is user a moderator/admin?
   - For NIP-29: Is user in the members array?
   - Does user have a pending join request?
   - Is the group ID in our userGroupIds Set? (catches NIP-72 membership)

## Notes

- NIP-29 group membership is handled differently (stored in the group's members array from relay-generated events)
- The fix maintains all existing functionality while properly identifying NIP-72 group membership
- Performance is optimized by using Sets for quick lookups instead of array iterations