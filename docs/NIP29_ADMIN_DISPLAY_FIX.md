# NIP-29 Admin/Moderator Display Fix

## Problem
NIP-29 groups were not showing admins/moderators in the "Group Owner & Moderators" section, despite having admins configured.

## Root Cause
The `useNip29GroupMembers` hook was only querying for **kind 39002** (GROUP_MEMBERS) events and trying to extract admin roles from member tags. However, according to the NIP-29 specification, admin information is stored separately in **kind 39001** (GROUP_ADMINS) events.

## NIP-29 Event Structure

According to `/docs/relay_nip29_notes.md`:

### 39001 (GROUP_ADMINS) - Admin list
```json
{
  "tags": [
    ["d", "<group_id>"],
    ["p", "<admin_pubkey_1>", "admin"],
    ["p", "<admin_pubkey_2>", "admin"]
  ]
}
```

### 39002 (GROUP_MEMBERS) - Member list  
```json
{
  "tags": [
    ["d", "<group_id>"],
    ["p", "<member_pubkey_1>"],
    ["p", "<member_pubkey_2>"]
  ]
}
```

## Solution
Updated both `useNip29GroupMembers` and the main `useNip29Groups` hooks to query for **both** event kinds:

### 1. Updated `useNip29GroupMembers` Hook
```typescript
// Query for both member list (39002) and admin list (39001) events
const [memberEvents, adminEvents] = await Promise.all([
  nostr.query([{
    kinds: [39002], // NIP-29 relay-generated member list
    "#d": [groupId],
    limit: 1
  }], { signal, relays: [relay] }),
  nostr.query([{
    kinds: [39001], // NIP-29 relay-generated admin list
    "#d": [groupId],
    limit: 1
  }], { signal, relays: [relay] })
]);
```

### 2. Separate Parsing Logic
- **Members**: Extracted from kind 39002 events with `["p", "<pubkey>"]` tags
- **Admins**: Extracted from kind 39001 events with `["p", "<pubkey>", "admin"]` tags

### 3. User Role Detection
```typescript
let userRole: 'admin' | 'member' | null = null;
if (user) {
  if (admins.includes(user.pubkey)) {
    userRole = 'admin';
  } else if (members.includes(user.pubkey)) {
    userRole = 'member';
  }
}
```

## Files Modified

### `/src/hooks/useNip29Groups.ts`
- **`useNip29GroupMembers`**: Added query for kind 39001 (admin events)
- **`useNip29Groups`**: Updated to fetch both member and admin events for all groups
- Added proper admin/member parsing according to NIP-29 spec

## Impact
- ✅ NIP-29 group admins/moderators now display correctly in the "Group Owner & Moderators" section
- ✅ Proper role detection for current user (admin vs member)
- ✅ Maintains backward compatibility with existing functionality
- ✅ Follows official NIP-29 specification

## Testing
After this fix, NIP-29 groups should show their admins in the moderator section of the group page, and users should see their correct roles (admin/member) reflected in the UI.