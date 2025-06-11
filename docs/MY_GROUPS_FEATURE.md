# My Groups Feature Implementation

## Summary

Added a "My Groups" link to the user dropdown menu that filters the groups page to show only groups where the user is involved (owner, moderator/admin, or member).

## Changes Made

### 1. AccountSwitcher Component (`/src/components/auth/AccountSwitcher.tsx`)
- Added `Users` icon import from lucide-react
- Added "My Groups" menu item between "View Profile" and "Wallet"
- Links to `/groups?filter=my-groups`

### 2. Groups Page (`/src/pages/Groups.tsx`)
- Added `useSearchParams` import from react-router-dom
- Added logic to detect `filter=my-groups` query parameter
- Added `isUserGroup` function to filter groups based on user's involvement:
  - Shows groups where user is owner
  - Shows groups where user is moderator (NIP-72) or admin (NIP-29)
  - Shows groups where user is member
  - Shows groups where user has pending join request
- Updated page title and description based on filter mode
- Added "Show All Groups" link when in filtered mode
- Updated empty state message for "My Groups" view

## User Experience

When users click "My Groups" from the dropdown menu:
1. They are taken to `/groups?filter=my-groups`
2. The page shows only groups they're involved with
3. The title changes from "Groups" to "My Groups"
4. The description explains they're seeing groups they own, moderate, or are members of
5. A "Show All Groups" link appears to easily switch back to the full view
6. If they have no groups, they see a helpful message with a button to browse all groups

## Technical Details

The filtering logic checks:
- **Ownership**: `group.pubkey === user.pubkey`
- **Moderation**: 
  - NIP-72: `group.moderators.includes(user.pubkey)`
  - NIP-29: `group.admins.includes(user.pubkey)`
- **Membership**:
  - NIP-29: `group.members?.includes(user.pubkey)`
  - NIP-72: Uses `getUserRoleForGroup` to check for member role
- **Pending Requests**: Checks if group ID is in `pendingJoinRequestsSet`

The same sorting algorithm is applied, so pinned groups and user's role priority still work correctly.