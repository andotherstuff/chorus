# protest.net NIP-72 Group Discovery Debug Summary

## Issue
The protest.net NIP-72 community shows up in posts but not in the Groups list page.

## Root Cause Analysis

### 1. Limited Relay Coverage
The app was only querying `wss://relay.chorus.community/` for NIP-72 groups (kind 34550 events). The protest.net group metadata might be stored on other relays that weren't being queried.

### 2. How Posts Reference Groups
Posts reference NIP-72 groups using "a" tags in the format:
```
["a", "34550:pubkey:identifier", "relay-url", "relay"]
```

For protest.net, posts have tags like:
```
["a", "34550:pubkey:protest.net", "wss://some-relay.com", "relay"]
```

## Changes Made

### 1. Added Additional Relays
Modified `src/App.tsx` to query multiple relays for NIP-72 groups:
- `wss://relay.chorus.community/` (original)
- `wss://relay.damus.io/`
- `wss://relay.nostr.band/`
- `wss://nos.lol/`

### 2. Added Debug Logging
- In `PostList.tsx`: Added specific logging to detect posts with protest.net in 'a' tags
- In `useUnifiedGroups.ts`: Added logging to check if protest.net community is found
- In `NostrProvider.tsx`: Added logging to identify NIP-72 group queries

## Next Steps

1. **Run the app** with these changes and check the console logs to see:
   - Which relay (if any) has the protest.net group metadata
   - The exact format of the protest.net group identifier in the 'a' tags

2. **If protest.net is still not found**, we may need to:
   - Query the specific relay mentioned in the post's 'a' tag
   - Add dynamic relay discovery based on where posts reference groups
   - Check if the protest.net group uses a different identifier format

3. **Consider implementing relay hints**:
   - When posts reference a group with an 'a' tag that includes a relay hint, we should query that specific relay for the group metadata

## Technical Details

The protest.net group is identified as:
- Type: NIP-72 (kind 34550)
- Identifier: "protest.net" (in the 'd' tag)
- Full reference: `34550:pubkey:protest.net`

The group metadata event should have this structure:
```json
{
  "kind": 34550,
  "pubkey": "creator-pubkey",
  "tags": [
    ["d", "protest.net"],
    ["name", "Protest Network"],
    ["description", "..."],
    ["image", "..."],
    ["p", "moderator-pubkey", "", "moderator"]
  ],
  "content": ""
}
```