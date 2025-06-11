# Pending Posts Tab Implementation

## Summary

Added a "Pending Posts" tab to the manage section for NIP-72 groups with the following features:

### 1. New Tab in Manage Section
- Added "Pending Posts" tab between "Members" and "Reports" tabs
- Only shows for NIP-72 groups (not NIP-29, since NIP-29 uses relay-enforced access control)
- Shows badge with total count of pending posts and replies

### 2. Approve Button Label
- Added "Approve" label next to the approve icon (checkmark)
- Changed from icon-only button to button with text
- Added tooltip for better UX

### 3. Rejected Posts Support
- Added tabs within Pending Posts: "Pending" and "Rejected"
- Moderators can now reject approved posts (shows as "Reject Post" in dropdown)
- Rejected posts can be re-approved by moderators
- Shows count badges for both pending and rejected posts

### 4. Components Modified

#### `/src/pages/GroupDetail.tsx`
- Added import for PendingPostsList component
- Updated TabsList to use dynamic grid columns based on group type
- Added "Pending Posts" tab with MessageSquare icon and badge

#### `/src/components/groups/PendingPostsList.tsx`
- Refactored to use tabs for Pending/Rejected posts
- Added query for rejected posts count
- Shows appropriate alerts for each tab state

#### `/src/components/groups/PostList.tsx`
- Changed approve button from icon-only to include "Approve" text
- Added "Reject Post" option for approved posts in moderator dropdown
- Exported PostItem component for reuse

#### `/src/components/groups/RejectedPostsList.tsx` (New)
- Displays posts that have been rejected
- Allows moderators to re-approve rejected posts
- Shows removal information for each post

## Features

1. **Pending Posts Tab**: Shows all posts awaiting approval with clear "Approve" buttons
2. **Rejected Posts Tab**: Shows posts that were rejected, allowing moderators to change their mind
3. **Visual Indicators**: Badge counts on tabs show number of items needing attention
4. **Improved UX**: Clear labeling and tooltips for all moderator actions