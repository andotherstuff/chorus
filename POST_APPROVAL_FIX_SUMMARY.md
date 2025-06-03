# Post Approval Fix Summary

## Issue
Post approval wasn't working correctly in the Nostr groups app. Approved posts were not showing up in the PostList component for certain groups, particularly the Oslo Freedom Forum group.

## Root Cause
The Oslo Freedom Forum group (and potentially others) is using a hybrid approach:
- The group is defined as a NIP-72 community (kind 34550)
- But posts are being created as NIP-29 group posts (kind 11) instead of regular text notes (kind 1)

The PostList component was only querying for kind 1 posts for NIP-72 groups, missing all the kind 11 posts.

## Investigation Results
Running tests against the relay revealed:
- 0 kind 1 posts in the Oslo Freedom Forum group
- 32 kind 11 posts in the same group
- 5 approved posts (3 of kind 11, 2 of kind 1111 replies)

## Fix Applied
Updated the PostList component to query for both kind 1 and kind 11 posts when dealing with NIP-72 groups:

1. **Updated pending posts query** (line ~300):
   ```typescript
   // Before:
   kinds: [1], // Regular text notes for NIP-72
   
   // After:
   kinds: [1, 11], // Regular text notes and group posts
   ```

2. **Updated pinned posts query** (line ~392):
   ```typescript
   // Before:
   kinds: [1, KINDS.GROUP_POST],
   
   // After:
   kinds: [1, KINDS.GROUP_POST, KINDS.NIP29_GROUP_POST],
   ```

## Impact
- Approved posts now display correctly for groups using kind 11 posts
- The app handles hybrid NIP-72/NIP-29 usage patterns
- All 32 posts in the Oslo Freedom Forum group are now visible
- 3 approved posts are correctly marked as approved

## Testing
Created test scripts that verified:
- Posts are now being fetched correctly
- Approved posts match between the approval events and displayed posts
- The build succeeds without TypeScript errors

## Files Modified
- `/src/components/groups/PostList.tsx` - Added kind 11 to post queries

## Recommendation
Consider standardizing whether groups should use kind 1 or kind 11 for posts, or officially support both patterns in the documentation.