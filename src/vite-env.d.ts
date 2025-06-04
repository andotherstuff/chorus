/// <reference types="vite/client" />

interface NostrEvent {
  id?: string;
  pubkey?: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig?: string;
}

interface Window {
  nostr?: {
    getPublicKey(): Promise<string>;
    signEvent(event: NostrEvent): Promise<NostrEvent>;
    getRelays?(): Promise<{[url: string]: {read: boolean, write: boolean}}>;
    nip04?: {
      encrypt(pubkey: string, plaintext: string): Promise<string>;
      decrypt(pubkey: string, ciphertext: string): Promise<string>;
    };
    nip44?: {
      encrypt(pubkey: string, plaintext: string): Promise<string>;
      decrypt(pubkey: string, ciphertext: string): Promise<string>;
    };
  };
}