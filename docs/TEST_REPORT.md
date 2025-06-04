# NIP-29 Groups Testing Report

## Test Date: January 31, 2025

## Test Environment
- URL: http://localhost:8080/
- Browser: Chrome (via vibe-tools/Stagehand)
- Branch: nip29-clean-merge

## Test Results

### 1. Groups Page (http://localhost:8080/groups)
✅ **PASSED** - Groups page loads successfully
✅ **PASSED** - Both NIP-72 and NIP-29 groups are displayed
✅ **PASSED** - Console shows correct group counts (81 NIP-72 + 11 NIP-29)

### 2. NIP-72 Group Test (Oslo Freedom Forum)
URL: http://localhost:8080/group/nip72:826be9c067e944d87299e42e7d72a1508f4a3c1ebeaaa8c4c96c4d3e5733ad68:Oslo-Freedom-Forum-2025

❌ **FAILED** - Group loads but posts are not displayed
✅ **PASSED** - queryId conversion works correctly (console shows conversion from "nip72:..." to "34550:...")
❌ **ISSUE** - Page shows "Loading group..." indefinitely, no posts appear

### 3. NIP-29 Group Test  
URL: http://localhost:8080/group/nip29:wss%3A%2F%2Fcommunities.nos.social%2F:MXciDlZ5Me0Q64VL

✅ **FIXED** - URL parsing now works correctly after fix to parseGroupRouteId
✅ **PASSED** - Relay URL is correctly parsed as "wss://communities.nos.social/"
✅ **PASSED** - Console shows: `[GroupDetail] Legacy route parsed: {"type":"nip29","relay":"wss://communities.nos.social/","groupId":"MXciDlZ5Me0Q64VL"}`
✅ **PASSED** - Group metadata loads (shows "NIP-60/61" with description "Nutsacks and nutzaps")
✅ **PASSED** - Console shows posts are found: `[PostList] Found 50 NIP-29 posts`
❌ **FAILED** - Posts are not rendered in the UI despite being found

## Issues Identified

### Issue 1: NIP-72 Posts Not Displaying
Despite the queryId conversion fix being applied correctly, posts are still not appearing. The page remains stuck on "Loading group...".

**Possible causes:**
- PostList component may not be rendering
- Query may be failing silently
- Approval events (kind 4550) may not be properly parsed/displayed

### Issue 2: NIP-29 URL Parsing Error [FIXED]
✅ Fixed by updating parseGroupRouteId to use lastIndexOf for splitting the relay URL from group ID.

### Issue 3: Posts Not Rendering in UI
Both NIP-72 and NIP-29 posts are being fetched successfully (according to console logs) but are not being displayed in the UI.

**Evidence:**
- NIP-29: Console shows `[PostList] Found 50 NIP-29 posts` but UI shows empty posts area
- NIP-72: Page shows "Loading group..." indefinitely

**Possible causes:**
- PostList component rendering logic issue
- Posts data structure mismatch
- Missing error handling causing silent failures

## Recommendations

1. **Fix NIP-29 URL parsing** - Update the parsing logic to properly handle encoded URLs
2. **Debug PostList rendering** - Add more logging to understand why posts aren't displaying
3. **Test with real relay connections** - Ensure relay connections are working properly
4. **Add error handling** - Display errors when groups or posts fail to load instead of showing "Loading..." indefinitely

## Console Logs Summary

Key logs observed:
- `[Groups] Total groups: 92 (81 NIP-72 + 11 NIP-29)`
- `[GroupDetail] Legacy route parsed: {"type":"nip72","pubkey":"826be...","identifier":"Oslo-Freedom-Forum-2025"}`
- `[Query] Creating temporary pool for relays: [wss]` (incorrect - should be full URL)
- `[NIP-42] Connecting to wss...` (incorrect - should be full URL)

## Next Steps

1. Fix the NIP-29 URL parsing issue in GroupDetail.tsx
2. Add debugging to PostList to understand why posts aren't rendering
3. Test with authenticated user to see if that affects post visibility
4. Create integration tests for both NIP-72 and NIP-29 group types