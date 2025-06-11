# Post Approval Fix Summary

## Issues Identified

### Issue 1: Post Approval Button Missing on Individual Post View
**Problem**: When an admin/moderator views an individual unapproved post (accessed via URL hash, e.g., `/group/groupId#postId`), they cannot see the approve button because the "Show only approved posts" filter hides unapproved posts.

**Root Cause**: The `showOnlyApproved` state in `GroupDetail.tsx` was filtering out unapproved posts even when a moderator was trying to view a specific unapproved post via direct link.

### Issue 2: Group Page Stuck on "Loading group..."
**Problem**: When navigating to `/group/protest.net`, the page gets stuck on "Loading group..." indefinitely.

**Root Cause**: The group ID "protest.net" is not in the expected format. Groups should be identified as either:
- NIP-72: `nip72:pubkey:identifier` (e.g., `nip72:abc123...def456:protest.net`)
- NIP-29: `nip29:relay:groupId` (e.g., `nip29:wss://relay.com:protest-group`)

## Solutions Implemented

### Fix 1: Auto-disable Approval Filter for Direct Post Links
Modified `GroupDetail.tsx` to automatically set `showOnlyApproved` to `false` when:
1. A URL hash is present (indicating a direct link to a specific post)
2. The current user is a moderator
3. The approval filter is currently enabled

This ensures moderators can always see and approve unapproved posts when accessing them via direct link.

### Fix 2: Improved Error Handling for Invalid Group IDs
Enhanced the error display in `GroupDetail.tsx` to:
1. Show a clear error message when the group ID format is invalid
2. Display the expected format for both NIP-72 and NIP-29 groups
3. Add console warnings for debugging

## Code Changes

### GroupDetail.tsx
```typescript
// Added logic to disable approval filter when viewing specific posts
if (isModerator && showOnlyApproved) {
  setShowOnlyApproved(false);
}

// Added better error messaging for invalid group IDs
if (!parsedRouteId && groupId) {
  // Show helpful error message with expected format
}
```

## Testing Recommendations

1. **Test Approval from Direct Link**:
   - As a moderator, navigate to a group with unapproved posts
   - Enable "Show only approved posts" filter
   - Click on a direct link to an unapproved post
   - Verify the post is visible and the approve button is shown

2. **Test Invalid Group ID Handling**:
   - Navigate to `/group/protest.net` or similar invalid ID
   - Verify a helpful error message is displayed
   - Verify the expected format is shown

## Additional Notes

The issue with "protest.net" suggests there might be legacy links or bookmarks using an old URL format. The application now handles these gracefully with clear error messages.

For the protest.net group to work properly, you need the full group ID which includes:
- The creator's public key
- The identifier "protest.net"

This would look like: `/group/nip72:PUBKEY:protest.net` where PUBKEY is the actual public key of the group creator.