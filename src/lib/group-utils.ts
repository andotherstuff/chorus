import type { NostrEvent } from "@nostrify/nostrify";
import type { Group, GroupType, Nip72Group, Nip29Group } from "@/types/groups";
import { warn, log, DEBUG_NIP29_VALIDATION } from "@/lib/debug";

/**
 * Detect what type of group an event represents
 */
export function detectGroupType(event: NostrEvent): GroupType | null {
  // NIP-72: Kind 34550 community events
  if (event.kind === 34550) {
    return "nip72";
  }
  
  // NIP-29: Kind 39000-39999 group events
  if (event.kind >= 39000 && event.kind <= 39003) {
    return "nip29";
  }
  
  return null;
}

/**
 * Parse a NIP-72 community event into a Nip72Group
 */
export function parseNip72Group(event: NostrEvent): Nip72Group | null {
  if (event.kind !== 34550) return null;
  
  const dTag = event.tags.find(tag => tag[0] === "d");
  const nameTag = event.tags.find(tag => tag[0] === "name");
  const descriptionTag = event.tags.find(tag => tag[0] === "description");
  const imageTag = event.tags.find(tag => tag[0] === "image");
  const moderatorTags = event.tags.filter(tag => tag[0] === "p" && tag[3] === "moderator");
  
  if (!dTag) return null;
  
  const identifier = dTag[1];
  const name = nameTag?.[1] || identifier;
  const description = descriptionTag?.[1];
  const image = imageTag?.[1];
  const moderators = moderatorTags.map(tag => tag[1]);
  
  return {
    id: `34550:${event.pubkey}:${identifier}`,
    type: "nip72",
    name,
    description,
    image,
    pubkey: event.pubkey,
    created_at: event.created_at,
    identifier,
    moderators,
    tags: event.tags,  };
}

/**
 * Parse a NIP-29 group event into a Nip29Group
 */
export function parseNip29Group(event: NostrEvent, relay: string): Nip29Group | null {
  // NIP-29 relay-generated events are kinds 39000-39003
  if (event.kind !== 39000 && event.kind !== 39001 && event.kind !== 39002) return null;
  
  // For kind 39000 (group metadata), parse the group information
  if (event.kind === 39000) {
    // STRICT NIP-29 VALIDATION: Check required tags according to spec
    const dTag = event.tags.find(tag => tag[0] === "d" && tag[1]); // group id - REQUIRED
    const nameTag = event.tags.find(tag => tag[0] === "name" && tag[1]); // group name - REQUIRED
    
    // Check for REQUIRED visibility tag (must be either public or private)
    const publicTag = event.tags.find(tag => tag[0] === "public" && tag.length === 1);
    const privateTag = event.tags.find(tag => tag[0] === "private" && tag.length === 1);
    const hasValidVisibility = publicTag || privateTag;
    
    // Check for REQUIRED access tag (must be either open or closed)
    const openTag = event.tags.find(tag => tag[0] === "open" && tag.length === 1);
    const closedTag = event.tags.find(tag => tag[0] === "closed" && tag.length === 1);
    const hasValidAccess = openTag || closedTag;
    
    // REJECT if any required tags are missing
    if (!dTag) {
      if (DEBUG_NIP29_VALIDATION) {
        warn(`[NIP-29] Rejecting group event: missing required 'd' tag`, { 
          eventId: event.id?.substring(0, 8),
          pubkey: event.pubkey?.substring(0, 8),
          relay 
        });
      }
      return null;
    }
    
    if (!nameTag) {
      if (DEBUG_NIP29_VALIDATION) {
        warn(`[NIP-29] Rejecting group event: missing required 'name' tag`, { 
          eventId: event.id?.substring(0, 8),
          groupId: dTag[1],
          relay 
        });
      }
      return null;
    }
    
    if (!hasValidVisibility) {
      if (DEBUG_NIP29_VALIDATION) {
        warn(`[NIP-29] Rejecting group event: missing required visibility tag (public or private)`, { 
          eventId: event.id?.substring(0, 8),
          groupId: dTag[1],
          relay 
        });
      }
      return null;
    }
    
    if (!hasValidAccess) {
      if (DEBUG_NIP29_VALIDATION) {
        warn(`[NIP-29] Rejecting group event: missing required access tag (open or closed)`, { 
          eventId: event.id?.substring(0, 8),
          groupId: dTag[1],
          relay 
        });
      }
      return null;
    }
    
    // Additional validation: ensure no conflicting tags
    if (publicTag && privateTag) {
      if (DEBUG_NIP29_VALIDATION) {
        warn(`[NIP-29] Rejecting group event: conflicting visibility tags (both public and private)`, { 
          eventId: event.id?.substring(0, 8),
          groupId: dTag[1],
          relay 
        });
      }
      return null;
    }
    
    if (openTag && closedTag) {
      if (DEBUG_NIP29_VALIDATION) {
        warn(`[NIP-29] Rejecting group event: conflicting access tags (both open and closed)`, { 
          eventId: event.id?.substring(0, 8),
          groupId: dTag[1],
          relay 
        });
      }
      return null;
    }

    // CRITICAL NIP-29 VALIDATION: Group identifier must match relay host
    const groupIdentifier = dTag[1];
    
    // Parse the group identifier format: <host>'<group-id>
    const identifierParts = groupIdentifier.split("'");
    if (identifierParts.length !== 2) {
      if (DEBUG_NIP29_VALIDATION) {
        warn(`[NIP-29] Rejecting group event: invalid group identifier format (must be host'group-id)`, { 
          eventId: event.id?.substring(0, 8),
          groupIdentifier,
          expectedFormat: "host'group-id",
          relay 
        });
      }
      return null;
    }
    
    const [hostFromIdentifier, groupId] = identifierParts;
    
    // Validate group-id characters: must be a-z0-9-_ only
    if (!/^[a-z0-9\-_]+$/.test(groupId)) {
      if (DEBUG_NIP29_VALIDATION) {
        warn(`[NIP-29] Rejecting group event: invalid group-id characters (must be a-z0-9-_)`, { 
          eventId: event.id?.substring(0, 8),
          groupId,
          relay 
        });
      }
      return null;
    }
    
    // Extract hostname from relay URL for comparison
    let relayHost: string;
    try {
      const relayUrl = new URL(relay);
      relayHost = relayUrl.hostname;
    } catch (error) {
      if (DEBUG_NIP29_VALIDATION) {
        warn(`[NIP-29] Rejecting group event: invalid relay URL`, { 
          eventId: event.id?.substring(0, 8),
          relay,
          error: error.message
        });
      }
      return null;
    }
    
    // Validate that the host in the group identifier matches the relay host
    if (hostFromIdentifier !== relayHost) {
      if (DEBUG_NIP29_VALIDATION) {
        warn(`[NIP-29] Rejecting group event: group identifier host mismatch`, { 
          eventId: event.id?.substring(0, 8),
          groupIdentifier,
          hostFromIdentifier,
          relayHost,
          relay,
          reason: `Group identifier host '${hostFromIdentifier}' does not match relay host '${relayHost}'`
        });
      }
      return null;
    }
    
    // Optional tags
    const aboutTag = event.tags.find(tag => tag[0] === "about");
    const pictureTag = event.tags.find(tag => tag[0] === "picture");
    
    const name = nameTag[1];
    const description = aboutTag?.[1];
    const image = pictureTag?.[1];
    
    // Event passed validation - create group object
    if (DEBUG_NIP29_VALIDATION) {
      log(`[NIP-29] Valid group event accepted: ${name}`, { 
        groupIdentifier,
        groupId,
        relayHost,
        relay,
        isPublic: !!publicTag,
        isOpen: !!openTag
      });
    }
    
    return {
      id: `nip29:${encodeURIComponent(relay)}:${groupId}`, // Use the actual group ID (part after apostrophe)
      type: "nip29",
      name,
      description,
      image,
      pubkey: event.pubkey, // This is the relay's pubkey for relay-generated events
      created_at: event.created_at,
      groupId, // Store the actual group ID (part after apostrophe)
      relay,
      groupIdentifier, // Store the full identifier for reference
      admins: [], // Will be populated from kind 39002 events
      members: [], // Will be populated from kind 39002 events
      moderators: [], // NIP-29 uses admins instead of moderators
      isOpen: !!openTag, // true if "open" tag exists
      isPublic: !!publicTag, // true if "public" tag exists
      tags: event.tags
    };
  }
  
  // For other kinds, we might want to handle them differently
  return null;
}

/**
 * Generate a community ID from group data (for backward compatibility)
 */
export function getCommunityId(group: Group): string {
  return group.id;
}

/**
 * Check if a group is owned by a user
 */
export function isGroupOwner(group: Group, userPubkey: string): boolean {
  return group.pubkey === userPubkey;
}

/**
 * Check if a user is an admin/moderator of a group
 */
export function isGroupModerator(group: Group, userPubkey: string): boolean {
  if (group.type === "nip72") {
    return group.moderators.includes(userPubkey);
  } else if (group.type === "nip29") {
    return group.admins.includes(userPubkey);
  }
  return false;
}

/**
 * Get the user's role in a group
 */
export function getUserRole(group: Group, userPubkey: string): "owner" | "admin" | "moderator" | "member" | null {
  if (isGroupOwner(group, userPubkey)) {
    return "owner";
  }
  
  if (group.type === "nip72" && group.moderators.includes(userPubkey)) {
    return "moderator";
  }
  
  if (group.type === "nip29" && group.admins.includes(userPubkey)) {
    return "admin";
  }
  
  // For members, we'd need to check membership lists
  // This would require additional queries
  return null;
}

/**
 * Get the appropriate relay for a group
 */
export function getGroupRelay(group: Group, defaultRelays: string[]): string {
  if (group.type === "nip29" && group.relay) {
    return group.relay;
  }
  return defaultRelays[0]; // Use default relay for NIP-72 groups
}

/**
 * Create a group identifier for URL routing
 */
export function createGroupRouteId(group: Group): string {
  if (group.type === "nip72") {
    return `nip72:${group.pubkey}:${group.identifier}`;
  } else {
    return `nip29:${encodeURIComponent(group.relay)}:${group.groupId}`;
  }
}

/**
 * Parse a group route ID back to components
 */
export function parseGroupRouteId(routeId: string): { type: GroupType; pubkey?: string; identifier?: string; relay?: string; groupId?: string } | null {
  // First check if it starts with nip72: or nip29:
  if (routeId.startsWith("nip72:")) {
    const withoutPrefix = routeId.substring(6); // Remove "nip72:"
    const colonIndex = withoutPrefix.indexOf(":");
    if (colonIndex === -1) return null;
    
    const pubkey = withoutPrefix.substring(0, colonIndex);
    const identifier = withoutPrefix.substring(colonIndex + 1);
    
    return {
      type: "nip72",
      pubkey,
      identifier
    };
  } else if (routeId.startsWith("nip29:")) {
    const withoutPrefix = routeId.substring(6); // Remove "nip29:"
    
    // Find the last colon to separate relay URL from group ID
    // This handles encoded URLs like wss%3A%2F%2Fcommunities.nos.social%2F
    const lastColonIndex = withoutPrefix.lastIndexOf(":");
    if (lastColonIndex === -1) return null;
    
    const encodedRelay = withoutPrefix.substring(0, lastColonIndex);
    const groupId = withoutPrefix.substring(lastColonIndex + 1);
    const relay = decodeURIComponent(encodedRelay);
    
    return {
      type: "nip29",
      relay,
      groupId
    };
  }
  
  return null;
}

/**
 * Parse any event into a Group (for compatibility)
 */
export function parseGroup(event: NostrEvent, relay?: string): Group | null {
  // Check if it's a NIP-72 event
  if (event.kind === 34550) {
    return parseNip72Group(event);
  }
  
  // Check if it's a NIP-29 event
  if (event.kind >= 39000 && event.kind <= 39003 && relay) {
    return parseNip29Group(event, relay);
  }
  
  return null;
}
