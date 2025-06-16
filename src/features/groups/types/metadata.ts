/**
 * ABOUTME: Group metadata parsing and validation utilities for NIP-29 and NIP-72 protocols
 * ABOUTME: Handles event parsing, metadata extraction, and type-safe conversions between protocols
 */

import type { NostrEvent } from "@nostrify/nostrify";
import { 
  GroupMetadata, 
  Nip72CommunityMetadata, 
  Nip29GroupMetadata,
  GroupProtocol 
} from "./shared";
import { normalizeRelayUrl } from "@/lib/nip29Utils";

/**
 * Detect the protocol type from a Nostr event
 */
export function detectGroupProtocol(event: NostrEvent): GroupProtocol | null {
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
 * Parse a NIP-72 community event into metadata
 */
export function parseNip72Metadata(event: NostrEvent): Nip72CommunityMetadata | null {
  if (event.kind !== 34550) return null;
  
  const dTag = event.tags.find(tag => tag[0] === "d");
  const nameTag = event.tags.find(tag => tag[0] === "name");
  const descriptionTag = event.tags.find(tag => tag[0] === "description");
  const imageTag = event.tags.find(tag => tag[0] === "image");
  const moderatorTags = event.tags.filter(tag => tag[0] === "p" && tag[3] === "moderator");
  
  if (!dTag || !dTag[1]) return null;
  
  const identifier = dTag[1];
  const name = nameTag?.[1] || identifier;
  const description = descriptionTag?.[1];
  const image = imageTag?.[1];
  const moderators = moderatorTags.map(tag => tag[1]);
  
  return {
    id: `nip72:${event.pubkey}:${identifier}`,
    protocol: "nip72",
    name,
    description,
    image,
    pubkey: event.pubkey,
    created_at: event.created_at,
    identifier,
    moderators,
    tags: event.tags,
  };
}

/**
 * Parse a NIP-29 group event into metadata
 */
export function parseNip29Metadata(event: NostrEvent, relayUrl: string): Nip29GroupMetadata | null {
  // NIP-29 relay-generated events are kinds 39000-39003
  if (event.kind !== 39000 && event.kind !== 39001 && event.kind !== 39002) return null;
  
  const normalizedRelay = normalizeRelayUrl(relayUrl);
  if (!normalizedRelay) {
    console.warn(`[parseNip29Metadata] Invalid relay URL: ${relayUrl}`);
    return null;
  }
  
  // For kind 39000 (group metadata), parse the group information
  if (event.kind === 39000) {
    const dTag = event.tags.find(tag => tag[0] === "d"); // group id for addressable events
    const nameTag = event.tags.find(tag => tag[0] === "name");
    const aboutTag = event.tags.find(tag => tag[0] === "about");
    const pictureTag = event.tags.find(tag => tag[0] === "picture");
    const closedTag = event.tags.find(tag => tag[0] === "closed");
    const privateTag = event.tags.find(tag => tag[0] === "private");
    
    if (!dTag || !dTag[1]) return null;
    
    const groupId = dTag[1];
    const name = nameTag?.[1] || groupId;
    const description = aboutTag?.[1];
    const image = pictureTag?.[1];
    
    return {
      id: `nip29:${normalizedRelay}:${groupId}`,
      protocol: "nip29",
      name,
      description,
      image,
      pubkey: event.pubkey, // This is the relay's pubkey for relay-generated events
      created_at: event.created_at,
      groupId,
      relayUrl: normalizedRelay,
      admins: [], // Will be populated from kind 39002 events
      members: [], // Will be populated from kind 39002 events
      isOpen: !closedTag, // If no "closed" tag, group is open
      isPublic: !privateTag, // If no "private" tag, group is public
      tags: event.tags
    };
  }
  
  // For other kinds, we might want to handle them differently
  return null;
}

/**
 * Generic group metadata parser
 */
export function parseGroupMetadata(event: NostrEvent, relayUrl?: string): GroupMetadata | null {
  const protocol = detectGroupProtocol(event);
  
  if (protocol === "nip72") {
    return parseNip72Metadata(event);
  }
  
  if (protocol === "nip29" && relayUrl) {
    return parseNip29Metadata(event, relayUrl);
  }
  
  return null;
}

/**
 * Convert new GroupMetadata to legacy Group format for backward compatibility
 */
export function metadataToLegacyGroup(metadata: GroupMetadata): any {
  if (metadata.protocol === "nip72") {
    return {
      id: metadata.id,
      type: "nip72",
      name: metadata.name,
      description: metadata.description,
      image: metadata.image,
      pubkey: metadata.pubkey,
      created_at: metadata.created_at,
      identifier: metadata.identifier,
      moderators: metadata.moderators,
      tags: metadata.tags,
    };
  } else {
    return {
      id: metadata.id,
      type: "nip29",
      name: metadata.name,
      description: metadata.description,
      image: metadata.image,
      pubkey: metadata.pubkey,
      created_at: metadata.created_at,
      groupId: metadata.groupId,
      relay: metadata.relayUrl,
      admins: metadata.admins,
      moderators: [], // NIP-29 uses admins instead of moderators
      members: metadata.members,
      isOpen: metadata.isOpen,
      isPublic: metadata.isPublic,
      tags: metadata.tags,
    };
  }
}

/**
 * Generate a community ID for backward compatibility
 */
export function getCommunityId(metadata: GroupMetadata): string {
  return metadata.id;
}

/**
 * Create a composite identifier for NIP-29 groups
 */
export function createNip29CompositeId(groupId: string, relayUrl: string): string {
  const normalizedRelay = normalizeRelayUrl(relayUrl);
  if (!normalizedRelay) {
    throw new Error(`Invalid relay URL: ${relayUrl}`);
  }
  return `nip29:${normalizedRelay}:${groupId}`;
}