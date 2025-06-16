/**
 * ABOUTME: Main exports for the groups feature type system
 * ABOUTME: Provides centralized access to all group-related types, utilities, and backward compatibility
 */

// Core types
export type {
  GroupProtocol,
  UserRole,
  GroupMetadataBase,
  Nip72CommunityMetadata,
  Nip29GroupMetadata,
  GroupMetadata,
  UserGroupState,
  GroupInstance,
  GroupRouteId,
  CreateGroupData,
  GroupMember,
  // Legacy types for backward compatibility
  Group,
  Nip72Group,
  Nip29Group,
} from "./shared";

// Parsing and utility functions
export {
  detectGroupProtocol,
  parseNip72Metadata,
  parseNip29Metadata,
  parseGroupMetadata,
  metadataToLegacyGroup,
  getCommunityId,
  createNip29CompositeId,
} from "./metadata";

// Re-export normalized types for compatibility with existing imports
export type { GroupType } from "@/types/groups";

// Import types for utility functions
import type { 
  GroupMetadata, 
  Nip29GroupMetadata, 
  Nip72CommunityMetadata,
  GroupRouteId 
} from "./shared";

// Utility functions for migration and compatibility
export function isNip29Group(group: GroupMetadata | any): group is Nip29GroupMetadata {
  return group.protocol === "nip29" || group.type === "nip29";
}

export function isNip72Group(group: GroupMetadata | any): group is Nip72CommunityMetadata {
  return group.protocol === "nip72" || group.type === "nip72";
}

/**
 * Get the relay URL for a group (handles both new and legacy formats)
 */
export function getGroupRelayUrl(group: GroupMetadata | any, defaultRelays: string[]): string {
  if (isNip29Group(group)) {
    return group.relayUrl || (group as any).relay;
  }
  // NIP-72 groups use default relay (typically first in list)
  return defaultRelays[0];
}

/**
 * Create a route identifier for URL construction
 */
export function createGroupRouteId(group: GroupMetadata | any): string {
  if (isNip72Group(group)) {
    return `nip72:${group.pubkey}:${group.identifier}`;
  } else if (isNip29Group(group)) {
    const relayUrl = group.relayUrl || (group as any).relay;
    const groupId = group.groupId;
    return `nip29:${encodeURIComponent(relayUrl)}:${groupId}`;
  }
  throw new Error(`Unknown group type: ${group.protocol || group.type}`);
}

/**
 * Parse a group route ID back to components
 */
export function parseGroupRouteId(routeId: string): GroupRouteId | null {
  if (routeId.startsWith("nip72:")) {
    const withoutPrefix = routeId.substring(6);
    const colonIndex = withoutPrefix.indexOf(":");
    if (colonIndex === -1) return null;
    
    const pubkey = withoutPrefix.substring(0, colonIndex);
    const identifier = withoutPrefix.substring(colonIndex + 1);
    
    return {
      protocol: "nip72",
      pubkey,
      identifier
    };
  } else if (routeId.startsWith("nip29:")) {
    const withoutPrefix = routeId.substring(6);
    const lastColonIndex = withoutPrefix.lastIndexOf(":");
    if (lastColonIndex === -1) return null;
    
    const encodedRelay = withoutPrefix.substring(0, lastColonIndex);
    const groupId = withoutPrefix.substring(lastColonIndex + 1);
    const relayUrl = decodeURIComponent(encodedRelay);
    
    return {
      protocol: "nip29",
      relayUrl,
      groupId
    };
  }
  
  return null;
}