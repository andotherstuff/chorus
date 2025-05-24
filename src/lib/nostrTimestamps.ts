// Utility functions for tracking Nostr event timestamps

const TIMESTAMP_PREFIX = 'nostr_last_event_';

/**
 * Construct storage key based on pubkey and event kind
 */
export function getStorageKey(pubkey: string, kind: number): string {
  return `${TIMESTAMP_PREFIX}${pubkey}_${kind}`;
}

/**
 * Store timestamp for a published event
 */
export function storeEventTimestamp(pubkey: string, kind: number): void {
  const timestamp = Math.floor(Date.now() / 1000);
  const key = getStorageKey(pubkey, kind);
  localStorage.setItem(key, timestamp.toString());
}

/**
 * Get the last stored timestamp for a specific event kind and pubkey
 * Returns undefined if no timestamp is stored
 */
export function getLastEventTimestamp(pubkey: string, kind: number): number | undefined {
  const key = getStorageKey(pubkey, kind);
  const storedValue = localStorage.getItem(key);

  if (storedValue) {
    return parseInt(storedValue, 10);
  }

  return undefined;
}

/**
 * Update the stored timestamp for a specific event kind and pubkey
 */
export function updateLastEventTimestamp(pubkey: string, kind: number, timestamp: number): void {
  const key = getStorageKey(pubkey, kind);
  localStorage.setItem(key, timestamp.toString());
} 