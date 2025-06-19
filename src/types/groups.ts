import type { NostrEvent } from "@nostrify/nostrify";

export type GroupType = "nip72" | "nip29";

// User roles in groups - using main branch compatible types
export type UserRole = "owner" | "admin" | "moderator" | "member";

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
  groupId: string; // The part after the apostrophe in the identifier
  relay: string;
  groupIdentifier?: string; // Full identifier in format host'group-id
  admins: string[];
  moderators: string[];
  members?: string[];
  isOpen?: boolean;
  isPublic?: boolean;
  tags: string[][];
}

export type Group = Nip72Group | Nip29Group;

export interface CreateGroupData {
  name: string;
  description?: string;
  image?: string;
  type: GroupType;
  identifier?: string;
  relay?: string;
  isPrivate?: boolean;
  isOpen?: boolean;
  isPublic?: boolean;
}

export interface GroupMember {
  pubkey: string;
  relay?: string;
  role: string;
}

export type GroupRouteId = 
  | { type: "nip72"; pubkey: string; identifier: string }
  | { type: "nip29"; relay: string; groupId: string }
  | null;
