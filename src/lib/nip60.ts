import { bytesToHex } from "@noble/hashes/utils";
import { nip19 } from "nostr-tools";
import type { NostrSigner } from "@nostrify/nostrify";

/**
 * Derives a private key from a nostr signature by:
 * 1. Creating a minimal event with only the user's pubkey
 * 2. Signing that event with the user's nostr signer
 * 3. Using the first 64 characters of the signature as the private key
 * 
 * @param signer - The user's nostr signer
 * @param pubkey - The user's public key
 * @returns A hex-encoded private key derived from the signature
 */
export async function derivePrivkeyFromNostrSignature(
  signer: NostrSigner,
  pubkey: string
): Promise<string> {
  // Create a minimal event with only the pubkey
  const minimalEvent = {
    kind: 1337,
    created_at: 1033381312,
    tags: [],
    content: "cashu-wallet-seed",
    pubkey
  };

  // Sign the event
  const signedEvent = await signer.signEvent(minimalEvent);

  // Extract the first 64 characters from the signature as the private key
  const derivedPrivkey = signedEvent.sig.slice(0, 64);

  return derivedPrivkey;
}

/**
 * Gets an npub from a hex pubkey
 */
export function getEncodedPubkey(pubkey: string): string {
  return nip19.npubEncode(pubkey);
} 