# Real Nostr Testing Plan for +chorus App

## Overview

This testing plan includes actual interaction with Nostr relays, creating real events, and verifying functionality through both API-level tests and browser automation.

## Test Accounts

We've created test accounts with known keys for automated testing:

- **Alice Test** (Owner/Moderator)
  - nsec: `nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5`
  - npub: `npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6`

- **Bob Test** (Regular Member)
  - nsec: `nsec1jufhdeeqkxhzcy3z6wqxlhf3lj83e9zgz7g4ezzn2jlqp843petqvld38t`
  - npub: `npub1v0lxs8638u4lrn6nclvqfqxa38kqmhapw0cf6pxycswhc2e4nt0qpradnj`

- **Charlie Test** (New User)
  - nsec: `nsec14m97e7k0yglqfemsm3h8wuley3mhc6qjp5tey3eyyx3xvh8w2nuqj5l4fc`
  - npub: `npub15s8evnug5n3d3mngl3wshrhtxw0608qcvlg2cqt82u2kkf96l24syaetzj`

## Test Data Conventions

- All test groups are prefixed with `test-chorus-`
- All test content is prefixed with `[TEST]`
- Test profile pictures use RoboHash for consistency
- Timestamps included in all test data for uniqueness

## Available Test Scripts

### 1. Real Nostr Integration Tests (`test-real-nostr.cjs`)

Tests actual Nostr protocol functionality:
- Creates user profiles (kind 0 events)
- Creates NIP-72 communities (kind 34550)
- Creates NIP-29 groups (kind 9007)
- Posts to communities (kind 1)
- Posts to groups (kind 9/11)
- Replies to posts (kind 1111)

**Run with:**
```bash
node test-real-nostr.cjs
```

### 2. E2E Browser Tests (`test-app-e2e.js`)

Tests the actual UI with Playwright:
- Homepage navigation
- User onboarding flow
- Login with nsec
- Groups page functionality
- Group creation via UI
- Group detail pages

**Run with:**
```bash
node test-app-e2e.js
```

### 3. API Health Checks (`test-app-api.sh`)

Quick health checks:
- Server availability
- Resource loading
- PWA configuration
- Service worker status

**Run with:**
```bash
./test-app-api.sh
```

## Test Execution Plan

### Phase 1: Infrastructure Verification ✅
1. Verify dev server is running
2. Check resource loading
3. Validate PWA setup

### Phase 2: Nostr Protocol Testing
1. **User Creation**
   - Publish kind 0 events for test accounts
   - Verify profiles propagate to relays
   - Check metadata rendering

2. **Group Creation**
   - Create NIP-72 community on public relays
   - Create NIP-29 group on specialized relay
   - Verify group metadata events

3. **Content Publishing**
   - Post text content to both group types
   - Add media attachments
   - Test reply threads
   - Verify event propagation

4. **Interactions**
   - Test reactions (kind 7)
   - Test nutzaps (kind 9735)
   - Test deletion requests (kind 5)

### Phase 3: UI/UX Testing
1. **Authentication Flows**
   - Onboarding new users
   - Login with nsec
   - Account switching
   - Logout functionality

2. **Group Management**
   - Browse groups page
   - Create groups via UI
   - Join/leave groups
   - Member management

3. **Content Creation**
   - Create posts with form
   - Upload media files
   - Reply to posts
   - Edit/delete content

4. **Advanced Features**
   - Push notifications
   - Cashu wallet integration
   - Search functionality
   - Mobile responsiveness

## Verification Methods

### Relay Verification
```javascript
// Query relays for created events
const filter = { 
  kinds: [34550], 
  '#d': ['test-chorus-*'],
  limit: 10 
};
const events = await pool.querySync(relays, filter);
```

### UI Verification
- Screenshot capture at each step
- Console error monitoring
- Network request validation
- Element visibility checks

### Data Persistence
- Verify events appear on multiple relays
- Check data consistency across sessions
- Validate event signatures

## Expected Outcomes

### Successful Test Indicators:
- ✅ All test accounts have published profiles
- ✅ Test groups appear in relay queries
- ✅ Posts are visible in created groups
- ✅ UI reflects created data
- ✅ No console errors during operation
- ✅ Screenshots show expected states

### Common Issues to Watch For:
- ⚠️ Relay connection timeouts
- ⚠️ CORS issues with file uploads
- ⚠️ WebSocket disconnections
- ⚠️ Missing NIP-07 extension
- ⚠️ Slow relay responses

## Test Data Cleanup

Test data remains on relays for verification but can be identified by:
- `[TEST]` prefix in content
- `test-chorus-` prefix in group IDs
- Test account npubs

To clean up:
1. Publish kind 5 deletion events
2. Remove test groups from relay databases
3. Clear browser local storage

## Continuous Testing

For ongoing development:
1. Run tests before each deployment
2. Monitor relay health
3. Track performance metrics
4. Update test accounts as needed
5. Maintain test data conventions

## Test Results Location

All test results are saved in:
- `test-results/` - Screenshots and reports
- `test-results/nostr-test-results.json` - Nostr event IDs
- `test-results/e2e-test-report.json` - UI test results
- `test-results/real-nostr-test-report.json` - Full integration report

---

**Note**: These tests create real data on real Nostr relays. The test data is clearly marked but will persist on the network unless explicitly deleted.