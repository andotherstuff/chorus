# Groups Relay - NIP-29 Implementation Notes

## Overview

The groups_relay is a WebSocket proxy middleware that adds NIP-29 group chat functionality to any standard Nostr relay. It sits between Nostr clients and a backing relay (like strfry), intercepting and enriching events without modifying the underlying relay implementation.

## Architecture

### Core Design Principles

1. **Proxy Pattern**: Acts as a transparent proxy, forwarding events between clients and the backing relay
2. **Middleware Stack**: Uses a composable middleware architecture for modular functionality
3. **In-Memory State**: Maintains group state in memory with DashMap for thread-safe concurrent access
4. **Database Persistence**: SQLite database for event storage and recovery after restarts
5. **Relay-Signed Events**: Generates addressable events signed by the relay's private key

### Middleware Stack (Order Matters)

```
Client → LoggerMiddleware → Nip42Middleware → ValidationMiddleware → 
EventVerifierMiddleware → Nip70Middleware → Nip29Middleware → 
EventStoreMiddleware → Backing Relay
```

1. **LoggerMiddleware**: Logs all incoming/outgoing messages for debugging
2. **Nip42Middleware**: Handles NIP-42 authentication (AUTH challenge/response)
3. **ValidationMiddleware**: Validates event structure and required fields
4. **EventVerifierMiddleware**: Verifies event signatures
5. **Nip70Middleware**: Handles protected events (encryption/decryption)
6. **Nip29Middleware**: Core group management logic
7. **EventStoreMiddleware**: Database storage and relay forwarding

## NIP-29 Event Types

### Admin/Management Events (9000-9009)

These events must be signed by group admins:

- **9007 (GROUP_CREATE)**: Create a new group
  ```json
  {
    "content": "",
    "tags": [
      ["name", "Group Name"],
      ["about", "Group Description"],
      ["picture", "https://example.com/image.jpg"],
      ["private"],  // Optional: makes group private
      ["closed"]    // Optional: requires approval to join
    ]
  }
  ```

- **9000 (GROUP_ADD_USER)**: Add user to group
  ```json
  {
    "tags": [
      ["h", "<group_id>"],
      ["p", "<user_pubkey>"]
    ]
  }
  ```

- **9001 (GROUP_REMOVE_USER)**: Remove user from group
  ```json
  {
    "tags": [
      ["h", "<group_id>"],
      ["p", "<user_pubkey>"]
    ]
  }
  ```

- **9002 (GROUP_EDIT_METADATA)**: Update group metadata
  ```json
  {
    "tags": [
      ["h", "<group_id>"],
      ["name", "New Name"],
      ["about", "New Description"],
      ["picture", "https://example.com/new-image.jpg"],
      ["private", "<add|remove>"],
      ["closed", "<add|remove>"]
    ]
  }
  ```

- **9005 (GROUP_DELETE_EVENT)**: Delete a specific event
  ```json
  {
    "tags": [
      ["h", "<group_id>"],
      ["e", "<event_id>"]
    ]
  }
  ```

- **9006 (GROUP_SET_ROLES)**: Assign roles to users
  ```json
  {
    "tags": [
      ["h", "<group_id>"],
      ["p", "<user_pubkey>", "<role_name>"]
    ]
  }
  ```

- **9008 (GROUP_DELETE)**: Delete entire group
  ```json
  {
    "tags": [
      ["h", "<group_id>"]
    ]
  }
  ```

- **9009 (GROUP_CREATE_INVITE)**: Create invite code for closed groups
  ```json
  {
    "tags": [
      ["h", "<group_id>"]
    ]
  }
  ```

### User Events (9021-9022)

These can be created by any authenticated user:

- **9021 (GROUP_USER_JOIN_REQUEST)**: Request to join a group
  ```json
  {
    "content": "Optional message",
    "tags": [
      ["h", "<group_id>"],
      ["code", "<invite_code>"]  // Required for closed groups
    ]
  }
  ```

- **9022 (GROUP_USER_LEAVE_REQUEST)**: Leave a group
  ```json
  {
    "tags": [
      ["h", "<group_id>"]
    ]
  }
  ```

### Relay-Generated Events (39000-39003)

These addressable events are generated and signed by the relay:

- **39000 (GROUP_METADATA)**: Current group metadata
  ```json
  {
    "content": "",
    "tags": [
      ["d", "<group_id>"],
      ["name", "Group Name"],
      ["about", "Description"],
      ["picture", "https://example.com/image.jpg"],
      ["private"],  // If private
      ["closed"]    // If closed
    ]
  }
  ```

- **39001 (GROUP_ADMINS)**: List of group administrators
  ```json
  {
    "tags": [
      ["d", "<group_id>"],
      ["p", "<admin_pubkey_1>", "admin"],
      ["p", "<admin_pubkey_2>", "admin"]
    ]
  }
  ```

- **39002 (GROUP_MEMBERS)**: List of all group members
  ```json
  {
    "tags": [
      ["d", "<group_id>"],
      ["p", "<member_pubkey_1>"],
      ["p", "<member_pubkey_2>"]
    ]
  }
  ```

- **39003 (GROUP_ROLES)**: Available roles in the group
  ```json
  {
    "tags": [
      ["d", "<group_id>"],
      ["role", "admin"],
      ["role", "moderator"],
      ["role", "member"]
    ]
  }
  ```

## Group Types and Permissions

### Group Visibility Types

1. **Public Groups** (default)
   - Anyone can read events
   - Members can write events
   - No authentication required to read

2. **Private Groups** (with `private` tag)
   - Only members can read events
   - Only members can write events
   - Requires NIP-42 authentication

### Group Access Types

1. **Open Groups** (default)
   - Join requests are automatically approved
   - Anyone can become a member

2. **Closed Groups** (with `closed` tag)
   - Requires invite code or admin approval
   - Join requests are pending until approved

### Permission Matrix

| Action | Public+Open | Public+Closed | Private+Open | Private+Closed |
|--------|-------------|---------------|--------------|----------------|
| Read | Anyone | Anyone | Members only | Members only |
| Write | Members | Members | Members | Members |
| Join | Auto-approve | Invite/Approval | Auto-approve* | Invite/Approval* |

*Requires authentication

## Event Flow

### Inbound Event Processing (Client → Relay)

1. **WebSocket Message Received**
   - Parsed as `ClientMessage` (EVENT, REQ, CLOSE, AUTH)

2. **Middleware Processing**
   - Each middleware can modify, reject, or pass through
   - NIP-29 middleware validates group permissions

3. **Group Event Handling**
   - For group management events (9000-9009):
     - Validate user has required role
     - Execute group operation
     - Generate addressable events (39000-39003)
   - For regular events with `h` tag:
     - Verify user is group member
     - Add group-specific tags

4. **Storage and Forwarding**
   - Store in SQLite database
   - Forward to backing relay
   - Broadcast generated events to subscribers

### Outbound Event Processing (Relay → Client)

1. **Event Reception**
   - From backing relay subscription
   - From database queries

2. **Filtering**
   - NIP-29 middleware checks group visibility
   - Private groups: only send to authenticated members
   - Remove events from deleted groups

3. **Client Delivery**
   - Convert to `RelayMessage`
   - Send over WebSocket connection

## Data Structures

### Group State

```rust
struct Group {
    id: String,                          // Group identifier
    name: String,                        // Display name
    about: Option<String>,               // Description
    picture: Option<String>,             // Avatar URL
    private: bool,                       // Requires auth to read
    closed: bool,                        // Requires invite to join
    created_at: u64,                     // Unix timestamp
    admins: HashSet<String>,             // Admin public keys
    members: HashSet<String>,            // All member public keys
    roles: HashMap<String, String>,      // pubkey → role mapping
    join_requests: HashMap<String, u64>, // Pending requests
    invites: HashMap<String, u64>,       // Active invite codes
}
```

### Groups Manager

```rust
struct Groups {
    groups: Arc<DashMap<String, Group>>, // Thread-safe group storage
    relay_keys: Keys,                    // Relay's signing keys
}
```

## Configuration

### YAML Configuration Files

**settings.yml** (default configuration):
```yaml
relay_secret_key: "<64-char-hex>"  # Relay's private key
local_addr: "0.0.0.0:8080"         # Listen address
relay_url: "ws://127.0.0.1:7777"   # Backing relay WebSocket
public_url: "wss://example.com"    # Public-facing URL
db_path: "./db/groups.db"          # SQLite database path
auth_required: false               # Global auth requirement
auth_url: "wss://example.com"      # Expected URL in AUTH
```

**settings.local.yml** (overrides for local development)

### Environment Variables

- `DATABASE_URL`: Override database path
- `RUST_LOG`: Logging level (debug, info, warn, error)

## Database Schema

### Events Table
```sql
CREATE TABLE events (
    id TEXT PRIMARY KEY,
    pubkey TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    kind INTEGER NOT NULL,
    tags TEXT NOT NULL,
    content TEXT NOT NULL,
    sig TEXT NOT NULL
);

CREATE INDEX idx_events_pubkey ON events(pubkey);
CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_events_kind ON events(kind);
```

## Frontend Integration

The relay includes a React-based web UI for group management:

- **Create groups**: Web form for creating new groups
- **Browse groups**: List all available groups
- **Join groups**: Request to join or use invite codes
- **Manage groups**: Admin interface for member management

The frontend is served from the same port as the WebSocket relay, with routing handled by Axum.

## Deployment

### Docker Deployment

```dockerfile
# Multi-stage build
FROM rust:alpine AS builder
# Build relay

FROM node:alpine AS frontend-builder  
# Build frontend

FROM alpine:latest
# Copy artifacts and run
```

### Docker Compose Setup

```yaml
services:
  strfry:
    image: dockurr/strfry
    volumes:
      - ./config/strfry.conf:/app/strfry.conf
      - ./db/strfry:/app/db
    ports:
      - "7777:7777"

  groups-relay:
    build: .
    depends_on:
      - strfry
    environment:
      - DATABASE_URL=/app/db/groups.db
    volumes:
      - ./db:/app/db
      - ./config:/app/config
    ports:
      - "8080:8080"
```

## Testing with Nostr Clients

### Using nostril (CLI)

```bash
# Create a group
nostril --envelope --sec $PRIVKEY --content "" \
  --kind 9007 \
  --tag name "Test Group" \
  --tag about "A test group" | \
  websocat ws://localhost:8080

# Join a group  
nostril --envelope --sec $PRIVKEY --content "" \
  --kind 9021 \
  --tag h "group-id" | \
  websocat ws://localhost:8080

# Send message to group
nostril --envelope --sec $PRIVKEY --content "Hello group!" \
  --kind 1 \
  --tag h "group-id" | \
  websocat ws://localhost:8080
```

### REQ Filters

```json
// Get group metadata
{"kinds": [39000], "authors": ["relay-pubkey"], "#d": ["group-id"]}

// Get group members
{"kinds": [39002], "authors": ["relay-pubkey"], "#d": ["group-id"]}

// Get group messages
{"kinds": [1], "#h": ["group-id"]}

// Get all groups
{"kinds": [39000], "authors": ["relay-pubkey"]}
```

## Security Considerations

1. **Authentication**: Uses NIP-42 AUTH for user verification
2. **Authorization**: Role-based access control (Admin, Member, Custom roles)
3. **Signature Verification**: All events are cryptographically verified
4. **Relay Signatures**: Addressable events are signed by relay's key
5. **Rate Limiting**: Should be implemented at reverse proxy level
6. **Database Security**: SQLite with prepared statements to prevent injection

## Performance Optimizations

1. **Concurrent HashMap**: DashMap allows concurrent read/write access
2. **Lazy Loading**: Groups loaded from DB only on startup
3. **Caching**: In-memory group state avoids database queries
4. **Batch Processing**: Multiple events can be processed in parallel
5. **Connection Pooling**: Reuses WebSocket connections to backing relay

## Monitoring and Debugging

1. **Health Endpoint**: GET `/health` returns relay status
2. **Logging**: Configurable via `RUST_LOG` environment variable
3. **Metrics**: Can add Prometheus metrics to middleware
4. **Event Inspection**: Logger middleware shows all events

## Known Limitations

1. **Single Relay**: Currently supports only one backing relay
2. **Memory Usage**: All groups kept in memory (could be issue at scale)
3. **No Clustering**: Single instance only, no horizontal scaling
4. **Invite Expiry**: Invites don't automatically expire
5. **Migration**: No built-in data migration tools

## Future Enhancements

1. **Multiple Backing Relays**: Support relay pools
2. **Redis State Store**: For horizontal scaling
3. **Advanced Roles**: More granular permissions
4. **Moderation Tools**: Spam filtering, word filters
5. **Analytics**: Group activity metrics
6. **Webhooks**: External integrations
7. **Federation**: Cross-relay group synchronization