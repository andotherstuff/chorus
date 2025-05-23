import type { NostrEvent } from "@nostrify/nostrify";

export type GroupType = "nip72" | "nip29";

// Common interface for all groups with discriminated union
export interface GroupBase {
  id: string;
  name: string;
  description?: string;
  image?: string;
  pubkey: string;
  created_at: number;
}

export interface Nip72Group extends GroupBase {
  type: "nip72";
  identifier: string;
  moderators: string[];
  tags: string[][];
}

export interface Nip29Group extends GroupBase {
  type: "nip29";
  groupId: string;
  relay: string;
  admins: string[];
  moderators: string[];
  members?: string[];
  isOpen?: boolean;      // Whether anyone can join without approval
  isPublic?: boolean;    // Whether the group is publicly discoverable
  tags: string[][];
}

export type Group = Nip72Group | Nip29Group;

// Group creation data
export interface CreateGroupData {
  name: string;
  description?: string;
  image?: string;
  type: GroupType;
  identifier?: string;
  relay?: string;
  isPrivate?: boolean;
  isOpen?: boolean;      // For NIP-29: whether the group accepts anyone
  isPublic?: boolean;    // For NIP-29: whether the group is discoverable
}

// User roles in groups
export type UserRole = "owner" | "admin" | "moderator" | "member";

// Group member info
export interface GroupMember {
  pubkey: string;
  relay?: string;
  role: string;
}

// Parsed group route ID
export type GroupRouteId = 
  | { type: "nip72"; pubkey: string; identifier: string }
  | { type: "nip29"; relay: string; groupId: string }
  | null;
