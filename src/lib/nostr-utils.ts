/**
 * Parse a Nostr address string in the format "kind:pubkey:identifier"
 * @param address The Nostr address string
 * @returns An object with kind, pubkey, and identifier, or null if invalid
 */
export function parseNostrAddress(
  address: string
): { kind: number; pubkey: string; identifier: string } | null {
  try {
    // Check if it's a NIP-19 address (naddr, nevent, etc.)
    if (address.startsWith('naddr') || address.startsWith('nevent')) {
      // For a real implementation, you would use nip19.decode here
      // For simplicity in this example, we'll assume it's already decoded
      console.warn('NIP-19 address decoding not implemented in this example');
      return null;
    }

    // Parse standard format: kind:pubkey:identifier
    const parts = address.split(':');
    if (parts.length !== 3) {
      return null;
    }

    const kind = Number.parseInt(parts[0], 10);
    const pubkey = parts[1];
    const identifier = parts[2];

    if (isNaN(kind) || !pubkey || !identifier) {
      return null;
    }

    return { kind, pubkey, identifier };
  } catch (error) {
    console.error('Error parsing Nostr address:', error);
    return null;
  }
}

/**
 * Format a timestamp into a human-readable relative time string
 * @param timestamp Unix timestamp in seconds
 * @returns A string like "2 hours ago", "just now", etc.
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) {
    return 'just now';
  } else if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (diff < 2592000) {
    const days = Math.floor(diff / 86400);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else if (diff < 31536000) {
    const months = Math.floor(diff / 2592000);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(diff / 31536000);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
  }
}
