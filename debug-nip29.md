# Debug NIP-29 Groups with NAK

## Current App Behavior

The app is querying NIP-29 relays for group metadata events with these parameters:

- **Event Kind**: 39000 (relay-generated group metadata)
- **Limit**: 100 events
- **Relays**: 
  - `wss://communities.nos.social/`
  - `wss://relays.groups.nip29.com`
  - `wss://groups.fiatjaf.com`

## NAK Commands to Test

### 1. Test Basic Connection and Query for Group Metadata

```bash
# Test communities.nos.social
nak req -k 39000 --limit 100 wss://communities.nos.social/

# Test relays.groups.nip29.com
nak req -k 39000 --limit 100 wss://relays.groups.nip29.com

# Test groups.fiatjaf.com
nak req -k 39000 --limit 100 wss://groups.fiatjaf.com
```

### 2. Test for All NIP-29 Event Types

```bash
# Test for all relay-generated events (39000-39003)
nak req -k 39000 -k 39001 -k 39002 -k 39003 --limit 50 wss://communities.nos.social/
nak req -k 39000 -k 39001 -k 39002 -k 39003 --limit 50 wss://relays.groups.nip29.com
nak req -k 39000 -k 39001 -k 39002 -k 39003 --limit 50 wss://groups.fiatjaf.com
```

### 3. Test for User-Generated Group Events

```bash
# Test for user events like group creation (9007) and join requests (9021)
nak req -k 9007 -k 9021 --limit 20 wss://communities.nos.social/
nak req -k 9007 -k 9021 --limit 20 wss://relays.groups.nip29.com
nak req -k 9007 -k 9021 --limit 20 wss://groups.fiatjaf.com
```

### 4. Test Authentication (if needed)

Some NIP-29 relays might require NIP-42 authentication. To test with authentication:

```bash
# Generate your auth event first (if you have a private key)
export RELAY_URL="wss://communities.nos.social/"
export YOUR_PRIVATE_KEY="your_private_key_here"

# Connect with auth
nak req -k 39000 --limit 100 --auth $YOUR_PRIVATE_KEY $RELAY_URL
```

### 5. Test Specific Group ID (if you know one)

If you find any groups, you can query for specific group data:

```bash
# Replace GROUP_ID with actual group ID found in previous queries
nak req -k 39000 --tag h=GROUP_ID wss://communities.nos.social/
```

## What to Look For

1. **Connection Success**: Does NAK connect to the relay?
2. **Events Returned**: Are any events returned for kind 39000?
3. **Event Structure**: Do the events have the expected NIP-29 structure?
4. **Authentication**: Do any relays send AUTH challenges?
5. **Group Metadata**: Do events contain group names, descriptions, etc.?

## Expected Event Structure for Kind 39000

```json
{
  "kind": 39000,
  "tags": [
    ["d", "group-id"],
    ["name", "Group Name"],
    ["about", "Group Description"],
    ["picture", "https://example.com/image.jpg"]
  ],
  "content": "",
  "pubkey": "relay_public_key",
  "created_at": 1234567890,
  "sig": "signature"
}
```

## Debugging Steps

1. Run the basic connection tests first
2. Check if any events are returned
3. If no events, try with authentication
4. If still no events, the relays might not have any public groups
5. Check the event structure of any returned events
6. Look for `h` (group ID) and `name` tags

## Alternative Query Strategy

If kind 39000 doesn't work, try looking for the original group creation events:

```bash
# Look for group creation events (kind 9007)
nak req -k 9007 --limit 50 wss://communities.nos.social/
```

These would be the original user-generated events that create groups, which the relay then uses to generate the 39000 events.