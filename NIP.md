# Chorus NIP-72 Extensions

`draft` `optional`

**⚠️ DISCLAIMER: This NIP is still under active development and subject to change. The event kinds and specifications described here are experimental and may be modified, deprecated, or replaced in future versions. It is not recommended to implement this NIP in production systems without first discussing it with the Chorus development team.**

This document describes the Chorus platform's extensions to NIP-72 (Moderated Communities) that enhance community management, user moderation, and content organization capabilities.

## Background

NIP-72 defines the basic framework for moderated communities on Nostr using:
- **Kind 34550**: Community definition events
- **Kind 4550**: Post approval events

Chorus extends this foundation with additional event kinds to provide comprehensive community management features including member lists, content pinning, join requests, and enhanced moderation workflows.

## Core NIP-72 Event Kinds

### Kind 34550: Community Definition
Defines a community with metadata and moderator lists as specified in NIP-72.

### Kind 4550: Post Approval  
Moderator approval events for posts as specified in NIP-72.

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
- `["e", eventId]` - References the removed post
- `["p", authorPubkey]` - References the post author
- `["k", originalKind]` - Kind of the original post

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
    ["k", "1"]
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

### Enhanced Post Events

#### Kind 11: Group Post
Standard text note posted to a community, extending Kind 1 with community targeting.

**Tags:**
- `["a", communityId]` - References the target community

**Example:**
```json
{
  "kind": 11,
  "pubkey": "user_pubkey",
  "created_at": 1234567890,
  "tags": [
    ["a", "34550:community_creator_pubkey:bitcoin-discussion"]
  ],
  "content": "What do you think about the latest Bitcoin price movement?"
}
```

#### Kind 1111: Group Post Reply
Reply to a group post, enabling threaded discussions within communities.

**Tags:**
- `["a", communityId]` - References the target community
- `["e", parentPostId]` - References the parent post being replied to
- `["p", parentAuthorPubkey]` - References the author of the parent post

**Example:**
```json
{
  "kind": 1111,
  "pubkey": "replying_user_pubkey", 
  "created_at": 1234567890,
  "tags": [
    ["a", "34550:community_creator_pubkey:bitcoin-discussion"],
    ["e", "parent_post_id"],
    ["p", "parent_post_author_pubkey"]
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

Posts from users in the approved members list (Kind 34551) are automatically considered approved without requiring individual Kind 4550 approval events. This reduces moderation overhead for trusted community members.

### Moderation Hierarchy

1. **Community Creator**: Has full control over the community
2. **Moderators**: Listed in the community definition with `["p", pubkey, relay, "moderator"]` tags
3. **Approved Members**: Can post without individual approval
4. **Regular Members**: Posts require moderator approval
5. **Banned Users**: Cannot post, all content hidden

### Client Implementation

Clients SHOULD:
- Display approved posts by default
- Provide toggles to view pending/unapproved content for moderators
- Hide content from banned users
- Show visual indicators for pinned posts
- Implement join request workflows for private communities
- Support threaded replies within communities

## Security Considerations

- Member lists should only be updated by community moderators
- Clients should verify moderator permissions before displaying moderation actions
- Banned user lists should be respected across all community interactions
- Report resolution events should only be created by authorized moderators

## Compatibility

These extensions are designed to be backward compatible with NIP-72. Clients that only implement basic NIP-72 will still function but may not display the enhanced moderation and organization features.