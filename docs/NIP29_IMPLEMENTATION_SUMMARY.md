# NIP-29 Implementation Summary

## What We've Implemented

### 1. Chat Messages (Kind 9)
- **Hook**: `useNip29ChatMessages` - Queries for kind 9 events with `h` tag
- **Component**: `Nip29ChatMessages` - Sends kind 9 events to the group's relay
- **UI**: Separate "Chat" tab appears only for NIP-29 groups

### 2. Posts (Kind 11) 
- **PostList**: Updated to exclude kind 9 from posts, shows kind 11 and others
- **Liberal acceptance**: Accepts kinds 1, 11, 42, 30023, 1111 for posts
- **Approval**: Fixed to properly approve posts of different kinds

### 3. Groups Display
- **Fixed**: `useUnifiedGroupsWithCache` imports the correct hook
- **Fixed**: Removed blocking dependency so NIP-29 groups load in parallel
- **Result**: Both NIP-72 and NIP-29 groups show on /groups page

### 4. eCash/Nutzaps for NIP-29
- **Challenge**: NIP-29 groups don't have their own keys
- **Solution**: Created `useNip29GroupCreator` hook to find actual creator
- **Implementation**:
  - Queries for kind 9007 (GROUP_CREATE) events
  - Falls back to earliest admin if no CREATE event found
  - eCash goes to creator's wallet, not relay's wallet
  - Nutzaps published to group's specific relay with `h` tag

### 5. Updated Components
- **GroupNutzapButton**: Supports both group types with proper tags
- **useSendNutzap**: Can publish to specific relays for NIP-29
- **useGroupNutzaps**: Queries from group's relay for NIP-29 groups

## How to Test Manually

### 1. Groups Page
- Navigate to http://localhost:8080/groups
- Wait ~8 seconds for NIP-29 groups to load
- Verify you see both types of groups (look for relay URLs in descriptions)

### 2. NIP-29 Group Features
Navigate to a NIP-29 group like:
http://localhost:8080/group/nip29/wss%3A%2F%2Fcommunities.nos.social%2F/MXciDlZ5Me0Q64VL

#### Chat Tab
- Click "Chat" tab (only visible for NIP-29)
- Type a message and send
- Message should appear immediately
- Messages should be kind 9 events

#### Posts Tab  
- Posts should display (kind 11)
- "Review X Pending Posts" button for moderators
- Approval should work for different event kinds

#### eCash Tab
- Click "Send eCash" 
- Dialog should mention "managed by the relay" for NIP-29
- eCash goes to group creator (not relay operator)

### 3. What to Verify

✅ **Groups Loading**
- Both NIP-72 and NIP-29 groups appear
- No blocking/waiting between types

✅ **Chat Messages**
- Only in NIP-29 groups
- Use kind 9 events
- Don't appear in Posts tab

✅ **Posts**  
- Support multiple event kinds
- Approval works across kinds
- Pending posts button appears

✅ **eCash**
- Different description for NIP-29
- Published to group's relay
- Goes to actual creator

## Known Limitations

1. **Group Creation**: Requires relay support for kind 9007 events
2. **Group Wallets**: Not implemented - would require relay extension
3. **Creator Discovery**: Falls back to admin if no CREATE event exists
4. **Relay Trust**: Group management depends on relay operator

## Test Groups

### NIP-29 Groups
- Oslo Freedom Forum: `wss://communities.nos.social/MXciDlZ5Me0Q64VL`
- Any group from `wss://groups.fiatjaf.com`

### NIP-72 Groups  
- Most groups on the main page are NIP-72
- Look for groups without relay URLs in their cards