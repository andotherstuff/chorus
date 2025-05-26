# Hide Groups Feature

This document describes the implementation of the Hide Groups feature for Site Admins.

## Overview

Site Admins can now hide groups from all public listings using 1984 (report) events. Hidden groups will not appear in:
- The main Groups page
- Profile pages' common groups sections
- Any other public group listings

## Site Admin Definition

Site Admins are defined as owners or moderators of this specific group:
`34550:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:and-other-stuff-mb3c9stb`

## How It Works

### For Site Admins

1. **Hide a Group**: Site Admins see a "Hide group" option in the dropdown menu (three dots) on any group card
2. **Report Dialog**: Clicking "Hide group" opens a dialog similar to the post reporting dialog
3. **Reason Selection**: Site Admins can select from predefined reasons:
   - Spam
   - Illegal content
   - Malware/Scam
   - Inappropriate
   - Other
4. **Additional Details**: Site Admins can provide additional context in a text area
5. **Submit**: The system creates a 1984 (report) event that tags the group ID

### For All Users

1. **Hidden Groups**: Groups with 1984 events from Site Admins are automatically filtered out of all public listings
2. **Real-time Updates**: The hidden groups list is cached and refreshed periodically
3. **No Notification**: Regular users don't see any indication that groups have been hidden

## Technical Implementation

### New Hooks

- `useSiteAdmin()`: Checks if the current user is a Site Admin
- `useHiddenGroups()`: Fetches and caches the list of hidden groups
- `useHideGroup()`: Allows Site Admins to hide groups

### New Components

- `HideGroupDialog`: Dialog for Site Admins to hide groups with reason selection

### Updated Components

- `GroupCard`: Added "Hide group" option for Site Admins
- `Groups`: Filters out hidden groups
- `CommonGroupsList`: Filters out hidden groups
- `CommonGroupsListImproved`: Filters out hidden groups

### Event Structure

When a Site Admin hides a group, a 1984 event is created with:
- `kind`: 1984 (REPORT)
- `tags`: `[["a", communityId, reason]]`
- `content`: Additional details provided by the Site Admin

### Filtering Logic

The system:
1. Queries for all 1984 events from Site Admin pubkeys
2. Extracts group IDs from "a" tags that start with "34550:"
3. Filters these groups from all public listings
4. Caches the results for performance

## Files Modified

### New Files
- `src/hooks/useSiteAdmin.ts`
- `src/hooks/useHiddenGroups.ts`
- `src/hooks/useHideGroup.ts`
- `src/components/groups/HideGroupDialog.tsx`

### Modified Files
- `src/components/groups/GroupCard.tsx`
- `src/pages/Groups.tsx`
- `src/components/profile/CommonGroupsList.tsx`
- `src/components/profile/CommonGroupsListImproved.tsx`

## Usage

### For Site Admins
1. Navigate to any group listing
2. Click the three dots menu on a group card
3. Select "Hide group"
4. Choose a reason and provide details
5. Click "Hide Group"

### For Developers
```typescript
// Check if user is Site Admin
const { isSiteAdmin } = useSiteAdmin();

// Get hidden groups
const { data: hiddenGroups } = useHiddenGroups();

// Hide a group (Site Admins only)
const { hideGroup } = useHideGroup();
await hideGroup({
  communityId: "34550:pubkey:identifier",
  reason: "spam",
  details: "This group is posting spam content"
});
```

## Security Considerations

- Only Site Admins can hide groups
- The Site Admin group ID is hardcoded to prevent unauthorized access
- Hidden groups are filtered client-side based on 1984 events
- The system relies on the integrity of the Nostr network for event verification

## Performance

- Hidden groups list is cached with 1-minute stale time
- Queries are optimized with timeouts and limits
- Filtering is done in memory for fast performance