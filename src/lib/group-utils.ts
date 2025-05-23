import type { NostrEvent } from "@nostrify/nostrify";
import type { Group, GroupType, Nip72Group, Nip29Group } from "@/types/groups";

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
    const hTag = event.tags.find(tag => tag[0] === "h"); // group id
    const nameTag = event.tags.find(tag => tag[0] === "name");
    const aboutTag = event.tags.find(tag => tag[0] === "about");
    const pictureTag = event.tags.find(tag => tag[0] === "picture");
    const closedTag = event.tags.find(tag => tag[0] === "closed");
    const privateTag = event.tags.find(tag => tag[0] === "private");
    
    if (!hTag || !hTag[1]) return null;
    
    const groupId = hTag[1];
    const name = nameTag?.[1] || groupId;
    const description = aboutTag?.[1];
    const image = pictureTag?.[1];
    
    return {
      id: `nip29:${encodeURIComponent(relay)}:${groupId}`,
      type: "nip29",
      name,
      description,
      image,
      pubkey: event.pubkey, // This is the relay's pubkey for relay-generated events
      created_at: event.created_at,
      // creatorPubkey is same as pubkey for NIP-29
      groupId,
      relay,
      admins: [], // Will be populated from kind 39002 events
      members: [], // Will be populated from kind 39002 events
      moderators: [], // NIP-29 uses admins instead of moderators      isOpen: !closedTag, // If no "closed" tag, group is open
      isPublic: !privateTag, // If no "private" tag, group is public
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
  const parts = routeId.split(":");
  
  if (parts[0] === "nip72" && parts.length >= 3) {
    return {
      type: "nip72",
      pubkey: parts[1],
      identifier: parts.slice(2).join(":") // Handle identifiers with colons
    };
  } else if (parts[0] === "nip29" && parts.length >= 3) {
    const relay = decodeURIComponent(parts[1]);
    const groupId = parts.slice(2).join(":"); // Handle group IDs with colons
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
