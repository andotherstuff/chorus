# Chorus NIP-72 Extensions

`draft` `optional`

**⚠️ DISCLAIMER: This NIP is still under active development and subject to change. The event kinds and specifications described here are experimental and may be modified, deprecated, or replaced in future versions. It is not recommended to implement this NIP in production systems without first discussing it with the Chorus development team.**

This document describes the Chorus platform's extensions to NIP-72 (Moderated Communities) that enhance community management, user moderation, and content organization capabilities. Chorus implements NIP-22 (Comment) for all group discussions, treating the community itself as the root event for threaded conversations.

## Background

NIP-72 defines the basic framework for moderated communities on Nostr using:
- **Kind 34550**: Community definition events
- **Kind 4550**: Post approval events

NIP-22 defines a comment threading system using:
- **Kind 1111**: Comments scoped to a root event

Chorus combines these specifications, using NIP-22 comments scoped to NIP-72 communities for all group discussions, and extends this foundation with additional event kinds to provide comprehensive community management features including member lists, content pinning, join requests, and enhanced moderation workflows.

## Core NIP-72 Event Kinds

### Kind 34550: Community Definition
Defines a community with metadata and moderator lists as specified in NIP-72.

### Kind 4550: Post Approval  
Moderator approval events for comments as specified in NIP-72, extended to handle Kind 1111 comments.

**Tags:**
- `["a", communityId]` - References the target community
- `["e", commentId]` - References the approved comment
- `["p", commentAuthorPubkey]` - References the comment author
- `["k", "1111"]` - Kind of the approved comment

**Content:**
Contains the full JSON of the approved comment event for redistribution.

## Chorus Extensions

### Member Management Events

#### Kind 34551: Approved Members List
**Addressable event** that maintains a list of users who are pre-approved to post in the community without requiring individual post approvals.

**Tags:**
- `["d", communityId]` - Identifies which community this list belongs to
- `["p", pubkey]` - One tag per approved member

**Example:**
```json
{
  "kind": 34551,
  "pubkey": "moderator_pubkey",
  "created_at": 1234567890,
  "tags": [
    ["d", "34550:community_creator_pubkey:bitcoin-discussion"],
    ["p", "approved_user_1_pubkey"],
    ["p", "approved_user_2_pubkey"],
    ["p", "approved_user_3_pubkey"]
  ],
  "content": ""
}
```

#### Kind 34552: Declined Members List
**Addressable event** that tracks users whose join requests have been declined.

**Tags:**
- `["d", communityId]` - Identifies which community this list belongs to  
- `["p", pubkey]` - One tag per declined user

**Example:**
```json
{
  "kind": 34552,
  "pubkey": "moderator_pubkey",
  "created_at": 1234567890,
  "tags": [
    ["d", "34550:community_creator_pubkey:bitcoin-discussion"],
    ["p", "declined_user_1_pubkey"],
    ["p", "declined_user_2_pubkey"]
  ],
  "content": ""
}
```

#### Kind 34553: Banned Members List
**Addressable event** that maintains a list of users who are banned from the community.

**Tags:**
- `["d", communityId]` - Identifies which community this list belongs to
- `["p", pubkey]` - One tag per banned user

**Example:**
```json
{
  "kind": 34553,
  "pubkey": "moderator_pubkey", 
  "created_at": 1234567890,
  "tags": [
    ["d", "34550:community_creator_pubkey:bitcoin-discussion"],
    ["p", "banned_user_1_pubkey"],
    ["p", "banned_user_2_pubkey"]
  ],
  "content": ""
}
```

### Content Organization Events

#### Kind 34554: Pinned Posts List
**Addressable event** that maintains a list of posts pinned by community moderators.

**Tags:**
- `["d", communityId]` - Identifies which community this list belongs to
- `["e", eventId]` - One tag per pinned post

**Example:**
```json
{
  "kind": 34554,
  "pubkey": "moderator_pubkey",
  "created_at": 1234567890,
  "tags": [
    ["d", "34550:community_creator_pubkey:bitcoin-discussion"],
    ["e", "pinned_post_1_id"],
    ["e", "pinned_post_2_id"],
    ["e", "pinned_post_3_id"]
  ],
  "content": ""
}
```

#### Kind 34555: Pinned Groups List
**Addressable event** that allows users to maintain a personal list of their favorite/pinned communities.

**Tags:**
- `["d", "pinned-groups"]` - Identifies this as the user's pinned groups list
- `["a", communityId]` - One tag per pinned community

**Example:**
```json
{
  "kind": 34555,
  "pubkey": "user_pubkey",
  "created_at": 1234567890,
  "tags": [
    ["d", "pinned-groups"],
    ["a", "34550:creator1_pubkey:bitcoin-discussion"],
    ["a", "34550:creator2_pubkey:nostr-development"],
    ["a", "34550:creator3_pubkey:photography"]
  ],
  "content": ""
}
```

### Moderation Action Events

#### Kind 4551: Post Removal
**Regular event** that indicates a moderator has removed a post from the community.

**Tags:**
- `["a", communityId]` - References the target community
- `["e", eventId]` - References the removed comment
- `["p", authorPubkey]` - References the comment author
- `["k", "1111"]` - Kind of the original comment

**Content:**
The content field can be left blank or optionally include a moderation reason.

**Example:**
```json
{
  "kind": 4551,
  "pubkey": "moderator_pubkey",
  "created_at": 1234567890,
  "tags": [
    ["a", "34550:community_creator_pubkey:bitcoin-discussion"],
    ["e", "removed_post_id"],
    ["p", "post_author_pubkey"],
    ["k", "1111"]
  ],
  "content": "Removed for violating community guidelines"
}
```

#### Kind 4552: Join Request
**Regular event** that represents a user's request to join a community.

**Tags:**
- `["a", communityId]` - References the target community

**Example:**
```json
{
  "kind": 4552,
  "pubkey": "requesting_user_pubkey",
  "created_at": 1234567890,
  "tags": [
    ["a", "34550:community_creator_pubkey:bitcoin-discussion"]
  ],
  "content": "I would like to join this community to discuss Bitcoin topics."
}
```

#### Kind 4553: Leave Request  
**Regular event** that represents a user's request to leave a community.

**Tags:**
- `["a", communityId]` - References the target community

**Example:**
```json
{
  "kind": 4553,
  "pubkey": "leaving_user_pubkey",
  "created_at": 1234567890,
  "tags": [
    ["a", "34550:community_creator_pubkey:bitcoin-discussion"]
  ],
  "content": "I am leaving this community."
}
```

#### Kind 4554: Close Report
**Regular event** that indicates a moderator has resolved a report (Kind 1984).

**Tags:**
- `["e", reportId]` - References the original report event
- `["a", communityId]` - References the target community  
- `["t", actionType]` - Indicates the action taken (e.g., "content removed", "user banned", "closed without action")

**Example:**
```json
{
  "kind": 4554,
  "pubkey": "moderator_pubkey",
  "created_at": 1234567890,
  "tags": [
    ["e", "original_report_id"],
    ["a", "34550:community_creator_pubkey:bitcoin-discussion"],
    ["t", "content removed"]
  ],
  "content": "Report resolved: Content violated community guidelines and has been removed."
}
```

### Group Discussion Events (NIP-22 Implementation)

All group discussions in Chorus use **Kind 1111** (NIP-22 Comments) scoped to the community as the root event. This provides proper threading while maintaining compatibility with the broader Nostr ecosystem.

#### Kind 1111: Group Comment (Top-Level Post)
A top-level post in a community, implemented as a NIP-22 comment scoped to the community.

**Tags (NIP-22 compliant):**
- `["A", communityId]` - Root scope: the community (uppercase)
- `["K", "34550"]` - Root kind: community (uppercase)
- `["P", communityCreatorPubkey]` - Root author: community creator (uppercase)
- `["a", communityId]` - Parent scope: same as root for top-level posts (lowercase)
- `["k", "34550"]` - Parent kind: community (lowercase)
- `["p", communityCreatorPubkey]` - Parent author: community creator (lowercase)

**Example:**
```json
{
  "kind": 1111,
  "pubkey": "user_pubkey",
  "created_at": 1234567890,
  "tags": [
    ["A", "34550:community_creator_pubkey:bitcoin-discussion"],
    ["K", "34550"],
    ["P", "community_creator_pubkey"],
    ["a", "34550:community_creator_pubkey:bitcoin-discussion"],
    ["k", "34550"],
    ["p", "community_creator_pubkey"]
  ],
  "content": "What do you think about the latest Bitcoin price movement?"
}
```

#### Kind 1111: Group Comment (Reply)
A reply to another comment in a community, following NIP-22 threading rules.

**Tags (NIP-22 compliant):**
- `["A", communityId]` - Root scope: the community (uppercase)
- `["K", "34550"]` - Root kind: community (uppercase)  
- `["P", communityCreatorPubkey]` - Root author: community creator (uppercase)
- `["e", parentCommentId]` - Parent event: the comment being replied to (lowercase)
- `["k", "1111"]` - Parent kind: comment (lowercase)
- `["p", parentCommentAuthorPubkey]` - Parent author: comment author (lowercase)

**Example:**
```json
{
  "kind": 1111,
  "pubkey": "replying_user_pubkey",
  "created_at": 1234567890,
  "tags": [
    ["A", "34550:community_creator_pubkey:bitcoin-discussion"],
    ["K", "34550"],
    ["P", "community_creator_pubkey"],
    ["e", "parent_comment_id"],
    ["k", "1111"],
    ["p", "parent_comment_author_pubkey"]
  ],
  "content": "I think the price movement is due to institutional adoption increasing."
}
```

## Implementation Notes

### Addressable vs Regular Events

**Addressable Events (3455x kinds)** use `["d", identifier]` tags for self-identification:
- Kind 34550: Community definitions
- Kind 34551: Approved members lists  
- Kind 34552: Declined members lists
- Kind 34553: Banned members lists
- Kind 34554: Pinned posts lists
- Kind 34555: Pinned groups lists

**Regular Events (455x kinds)** use `["a", communityId]` tags to reference communities:
- Kind 4550: Post approvals
- Kind 4551: Post removals
- Kind 4552: Join requests
- Kind 4553: Leave requests  
- Kind 4554: Close reports

### Auto-Approval Workflow

Comments from users in the approved members list (Kind 34551) are automatically considered approved without requiring individual Kind 4550 approval events. This reduces moderation overhead for trusted community members.

### NIP-22 Threading Implementation

Chorus implements NIP-22 threading with the community (Kind 34550) as the root event:

1. **Top-level comments**: Both uppercase (root) and lowercase (parent) tags point to the community
2. **Nested replies**: Uppercase tags point to the community (root), lowercase tags point to the parent comment
3. **Querying top-level posts**: Filter Kind 1111 events where parent kind (`k` tag) is "34550"
4. **Querying replies**: Filter Kind 1111 events where parent kind (`k` tag) is "1111"

This approach ensures proper threading while maintaining the community as the central organizing principle.

### Query Patterns

**Top-level posts in a community:**
```json
{
  "kinds": [1111],
  "#A": ["34550:creator_pubkey:community_identifier"],
  "limit": 50
}
```
Then filter results where the `k` tag value is "34550".

**Replies to a specific comment:**
```json
{
  "kinds": [1111],
  "#e": ["parent_comment_id"],
  "limit": 100
}
```

**All comments in a community (posts + replies):**
```json
{
  "kinds": [1111],
  "#A": ["34550:creator_pubkey:community_identifier"],
  "limit": 100
}
```

**Approvals for comments in a community:**
```json
{
  "kinds": [4550],
  "#a": ["34550:creator_pubkey:community_identifier"],
  "#k": ["1111"],
  "limit": 50
}
```

### Moderation Hierarchy

1. **Community Creator**: Has full control over the community
2. **Moderators**: Listed in the community definition with `["p", pubkey, relay, "moderator"]` tags
3. **Approved Members**: Can post comments without individual approval
4. **Regular Members**: Comments require moderator approval
5. **Banned Users**: Cannot post, all content hidden

### Client Implementation

Clients SHOULD:
- Display approved comments by default
- Provide toggles to view pending/unapproved content for moderators
- Hide content from banned users
- Show visual indicators for pinned posts
- Implement join request workflows for private communities
- Support NIP-22 threaded replies within communities
- Properly distinguish between top-level comments (parent kind "34550") and nested replies (parent kind "1111")
- Query using appropriate tag filters (`#A` for root scope, `#e` for parent events)

## Security Considerations

- Member lists should only be updated by community moderators
- Clients should verify moderator permissions before displaying moderation actions
- Banned user lists should be respected across all community interactions
- Report resolution events should only be created by authorized moderators

## Compatibility

These extensions are designed to be compatible with both NIP-72 and NIP-22. Clients that implement:

- **Basic NIP-72 only**: Will see community definitions and approvals but not threaded discussions
- **NIP-22 only**: Will see threaded comments but may not understand community context
- **Both NIP-72 and NIP-22**: Will have full functionality including threaded community discussions
- **Chorus extensions**: Will have access to enhanced moderation and organization features

The use of NIP-22 for group discussions ensures broader interoperability with other Nostr clients that support comment threading.