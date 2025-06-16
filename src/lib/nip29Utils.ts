/**
 * NIP-29 Utilities for Group Instance Management
 * 
 * This module provides utilities for handling NIP-29 group identifiers and relay URLs
 * with proper normalization and validation according to the NIP-29 specification.
 */

/**
 * Normalizes a Nostr relay URL to a consistent, canonical format based on
 * common community practices and the behavior of the URL standard.
 * 
 * Key normalization rules:
 * - Enforces wss:// protocol (with an exception for localhost)
 * - Converts hostname to lowercase
 * - Removes default ports (443 for wss, 80 for ws)
 * - Removes authentication credentials, query parameters, and fragments
 * - Ensures a trailing slash for root paths, consistent with URL.toString()
 *
 * @param url The raw relay URL string
 * @returns The normalized URL string, or null if the input is invalid
 * 
 * @example
 * normalizeRelayUrl('relay.damus.io') // 'wss://relay.damus.io/'
 * normalizeRelayUrl('wss://relay.damus.io:443/') // 'wss://relay.damus.io/'
 * normalizeRelayUrl('ws://localhost:8080') // 'ws://localhost:8080/'
 * normalizeRelayUrl('invalid-url') // null
 */
export function normalizeRelayUrl(url: string | undefined | null): string | null {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return null;
  }

  // Prepend a protocol if missing to aid the URL parser.
  // We default to wss:// as it's the standard for secure public relays.
  let processedUrl = url.trim();
  if (!/^(wss?:\/\/)/i.test(processedUrl)) {
    processedUrl = `wss://${processedUrl}`;
  }

  try {
    const u = new URL(processedUrl);

    // Exception for local development: do not force-upgrade ws://localhost.
    const isLocalhost = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (!isLocalhost) {
      u.protocol = 'wss:';
    }

    // Nostr relay identifiers do not include auth, query, or fragments.
    u.username = '';
    u.password = '';
    u.search = '';
    u.hash = '';

    // Remove default ports for canonical representation.
    if ((u.protocol === 'wss:' && u.port === '443') || (u.protocol === 'ws:' && u.port === '80')) {
      u.port = '';
    }

    // Hostnames are case-insensitive.
    u.hostname = u.hostname.toLowerCase();

    // The URL.toString() method correctly handles path normalization,
    // including adding a trailing slash to root paths (e.g., "wss://host.com/"),
    // and preserving non-root paths. This is our desired canonical form.
    return u.toString();

  } catch (error) {
    // The input string was not a parseable URL.
    return null;
  }
}

/**
 * Represents a parsed NIP-29 group instance identifier
 */
export interface ParsedNip29Identifier {
  /** The group ID (case-sensitive) */
  id: string;
  /** The normalized relay URL */
  relayUrl: string;
}

/**
 * Parses a composite NIP-29 identifier (groupId@relayUrl).
 * Uses normalizeRelayUrl to ensure the relay part is canonical.
 * 
 * Handles edge cases:
 * - Group IDs containing '@' symbols (uses last '@' as delimiter)
 * - Invalid relay URLs
 * - Empty components
 * 
 * @param identifier The composite identifier string (e.g., "bitcoin-devs@wss://groups.nip29.com/")
 * @returns A structured object with the group ID and normalized relay URL, or null if invalid
 * 
 * @example
 * parseNip29Identifier('devs@relay.damus.io') 
 * // { id: 'devs', relayUrl: 'wss://relay.damus.io/' }
 * 
 * parseNip29Identifier('email@domain.com@relay.com') 
 * // { id: 'email@domain.com', relayUrl: 'wss://relay.com/' }
 * 
 * parseNip29Identifier('invalid@not-a-url') // null
 */
export function parseNip29Identifier(identifier: string | undefined | null): ParsedNip29Identifier | null {
  if (!identifier || typeof identifier !== 'string') {
    return null;
  }

  // Use lastIndexOf to handle group IDs that contain '@' symbols
  const lastAt = identifier.lastIndexOf('@');
  if (lastAt === -1 || lastAt === 0 || lastAt === identifier.length - 1) {
    // No '@', or it's at the very beginning or end.
    return null;
  }

  const id = identifier.substring(0, lastAt);
  const rawRelayUrl = identifier.substring(lastAt + 1);

  if (!id || !rawRelayUrl) {
    return null; // ID or URL part cannot be empty.
  }

  const normalizedRelayUrl = normalizeRelayUrl(rawRelayUrl);
  if (!normalizedRelayUrl) {
    // The relay URL part was invalid.
    return null;
  }

  // Group IDs should not be empty after potential trimming.
  const trimmedId = id.trim();
  if (trimmedId === '') {
    return null;
  }

  return {
    id: trimmedId, // Preserve the case of the ID (assume case-sensitive)
    relayUrl: normalizedRelayUrl,
  };
}

/**
 * Creates a canonical NIP-29 identifier from a group ID and relay URL.
 * Normalizes the relay URL to ensure consistency.
 * 
 * @param id The group ID
 * @param rawRelayUrl The raw relay URL
 * @returns The canonical composite identifier string, or null if the relay URL is invalid
 * 
 * @example
 * createNip29Identifier('bitcoin-devs', 'relay.damus.io')
 * // 'bitcoin-devs@wss://relay.damus.io/'
 * 
 * createNip29Identifier('test', 'invalid-url') // null
 */
export function createNip29Identifier(id: string, rawRelayUrl: string): string | null {
  if (!id || !rawRelayUrl) {
    return null;
  }

  const normalizedRelayUrl = normalizeRelayUrl(rawRelayUrl);
  if (!normalizedRelayUrl) {
    return null;
  }

  const trimmedId = id.trim();
  if (trimmedId === '') {
    return null;
  }

  return `${trimmedId}@${normalizedRelayUrl}`;
}

/**
 * Utility to extract relay host from a normalized relay URL for display purposes
 * 
 * @param relayUrl A normalized relay URL
 * @returns The host part (without protocol/path) for UI display
 * 
 * @example
 * getRelayHost('wss://groups.nip29.com/') // 'groups.nip29.com'
 * getRelayHost('wss://relay.damus.io:8080/') // 'relay.damus.io:8080'
 */
export function getRelayHost(relayUrl: string): string {
  try {
    const url = new URL(relayUrl);
    return url.port ? `${url.hostname}:${url.port}` : url.hostname;
  } catch {
    // Fallback: remove protocol and trailing slash
    return relayUrl.replace(/^wss?:\/\//, '').replace(/\/$/, '');
  }
}