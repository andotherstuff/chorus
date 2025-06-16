/**
 * ABOUTME: Shared types and constants for the groups feature across both NIP-29 and NIP-72 protocols
 * ABOUTME: Provides discriminated unions and base interfaces for type-safe group handling
 */

import type { NostrEvent } from "@nostrify/nostrify";

export type GroupProtocol = "nip72" | "nip29";
export type UserRole = "owner" | "admin" | "moderator" | "member";

/**
 * Base metadata that all group types share
 */
export interface GroupMetadataBase {
  id: string;
  name: string;
  description?: string;
  image?: string;
  pubkey: string;
  created_at: number;
  tags: string[][];
}

/**
 * NIP-72 Community metadata (multi-relay)
 */
export interface Nip72CommunityMetadata extends GroupMetadataBase {
  protocol: "nip72";
  identifier: string;
  moderators: string[];
}

/**
 * NIP-29 Group metadata (relay-specific)
 */
export interface Nip29GroupMetadata extends GroupMetadataBase {
  protocol: "nip29";
  groupId: string;
  relayUrl: string;
  admins: string[];
  members?: string[];
  isOpen?: boolean;
  isPublic?: boolean;
}

/**
 * Discriminated union for group metadata
 */
export type GroupMetadata = Nip72CommunityMetadata | Nip29GroupMetadata;

/**
 * User-specific state for any group (cached separately)
 */
export interface UserGroupState {
  groupId: string;
  userPubkey: string;
  role?: UserRole;
  joinedAt?: number;
  lastSeenAt?: number;
  isPinned: boolean;
  notifications: {
    enabled: boolean;
    mentions: boolean;
    replies: boolean;
  };
}

/**
 * Complete group instance combining metadata and user state
 */
export interface GroupInstance {
  metadata: GroupMetadata;
  userState?: UserGroupState;
}

/**
 * Legacy Group type for backward compatibility
 */
export type Group = Nip72Group | Nip29Group;

export interface Nip72Group extends GroupMetadataBase {
  type: "nip72";
  identifier: string;
  moderators: string[];
}

export interface Nip29Group extends GroupMetadataBase {
  type: "nip29";
  groupId: string;
  relay: string;
  admins: string[];
  moderators: string[];
  members?: string[];
  isOpen?: boolean;
  isPublic?: boolean;
}

/**
 * Route identifier for URL construction
 */
export type GroupRouteId = 
  | { protocol: "nip72"; pubkey: string; identifier: string }
  | { protocol: "nip29"; relayUrl: string; groupId: string };

/**
 * Group creation form data
 */
export interface CreateGroupData {
  name: string;
  description?: string;
  image?: string;
  protocol: GroupProtocol;
  identifier?: string; // For NIP-72
  relayUrl?: string;   // For NIP-29
  isPrivate?: boolean;
  isOpen?: boolean;
  isPublic?: boolean;
}

/**
 * Group member information
 */
export interface GroupMember {
  pubkey: string;
  relayUrl?: string; // For NIP-29 context
  role: UserRole;
  joinedAt?: number;
}