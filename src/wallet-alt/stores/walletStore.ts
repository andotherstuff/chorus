import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// NIP-60 Event Kinds (as defined in the NIP)
export const NIP60_KINDS = {
  WALLET_INFO: 17375,   // Replaceable event for wallet info (mints list, etc)
  TOKEN: 7375,     // Token events for unspent proofs
  HISTORY: 7376,   // Spending history events
  QUOTE: 7374,     // Quote events (optional, for minting/melting quotes)
} as const;

// Define types for Cashu Proofs and Tokens based on NIP-60
export interface CashuProof {
  id: string;      // Mint keyset ID (from NIP-20)
  amount: number;  // Amount in satoshis
  secret: string;  // Proof secret (random 32 bytes)
  C: string;       // Commitment (secp256k1 public key in hex format)
}

export interface CashuTokenEntry {
  mint: string;    // Mint URL
  proofs: CashuProof[];
  // NIP-60 also defines 'del' for spent token IDs, but we'll track spent status in the store for simplicity
}

export interface CashuTokenEvent {
  id: string;          // Nostr Event ID of the kind 7375 token event
  token: CashuTokenEntry;   // Token data (mint URL and proofs)
  spent?: boolean;     // Whether this token event has been spent (referenced by another event's #e tag)
  spentBy?: string;    // The ID of the event that spent this token (e.g., a kind 7376 history event)
  createdAt: number;   // Nostr Event creation timestamp
  // Add other relevant Nostr event fields if needed, like 'pubkey'
}

// Define type for Wallet Info (kind 17375)
export interface WalletInfo {
  mints?: string[];       // List of mint URLs associated with this wallet
  defaultMint?: string;  // Optional default mint URL
  // NIP-60 allows other data like 'name', 'description', etc.
  name?: string;
  description?: string;
}

// Define type for History Entries (kind 7376)
export interface HistoryEntry {
  id: string;          // Nostr Event ID of the kind 7376 history event
  direction: 'in' | 'out'; // 'in' for received tokens, 'out' for sent/melted tokens
  amount: number;      // Amount of the transaction in satoshis
  description?: string; // Optional description for the transaction
  relatedEvents: string[]; // List of Nostr Event IDs related to this transaction (e.g., kind 7375 token events, kind 9735 zap receipts)
  createdAt: number;   // Nostr Event creation timestamp
}

// Define the state shape for our wallet store
interface WalletState {
  info?: WalletInfo;      // Wallet info from the kind 17375 event
  tokens: CashuTokenEvent[]; // List of all token events (spent and unspent)
  history: HistoryEntry[]; // List of transaction history entries
  status: {
    initialized: boolean; // True if the wallet data has been fetched from Nostr at least once
    syncing: boolean;     // True when fetching or publishing data to Nostr
    error?: string;       // Any error messages
  };

  // Actions to update the state
  setWalletInfo: (info: WalletInfo) => void;
  addMint: (mintUrl: string) => void;
  removeMint: (mintUrl: string) => void;
  setDefaultMint: (mintUrl: string) => void;
  addTokenEvent: (tokenEvent: CashuTokenEvent) => void;
  markTokenSpent: (tokenId: string, spentByEventId: string) => void;
  addHistoryEntry: (entry: HistoryEntry) => void;
  setInitialized: (initialized: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setError: (error?: string) => void;
  resetState: () => void; // Optional action to clear the wallet state
}

// Create the Zustand store
export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      info: undefined,
      tokens: [],
      history: [],
      status: {
        initialized: false,
        syncing: false,
        error: undefined,
      },

      // Implement actions
      setWalletInfo: (info) => set((state): Partial<WalletState> => ({ info })),
      addMint: (mintUrl) => set((state) => ({
        info: {
          ...state.info,
          mints: [...new Set([...(state.info?.mints || []), mintUrl])]
        } as Partial<WalletInfo>, // Explicitly cast to Partial<WalletInfo>
      })) as Partial<WalletState>, // Explicitly cast to Partial<WalletState>
      removeMint: (mintUrl) => set((state) => ({
        info: {
          ...state.info,
          mints: (state.info?.mints || []).filter(m => m !== mintUrl),
          defaultMint: state.info?.defaultMint === mintUrl ? undefined : state.info?.defaultMint,
        }
      })),
      setDefaultMint: (mintUrl) => set((state) => ({
        info: { ...state.info, defaultMint: mintUrl }
      })),
      addTokenEvent: (tokenEvent) => set((state) => ({
        // Prevent duplicates based on event ID
        tokens: [...state.tokens.filter(t => t.id !== tokenEvent.id), tokenEvent]
      })),
      markTokenSpent: (tokenId, spentByEventId) => set((state) => ({
        tokens: state.tokens.map(token => 
          token.id === tokenId ? { ...token, spent: true, spentBy: spentByEventId } : token
        )
      })),
      addHistoryEntry: (entry) => set((state) => ({
         // Prevent duplicates based on event ID
        history: [...state.history.filter(h => h.id !== entry.id), entry]
      })),
      setInitialized: (initialized) => set((state) => ({ status: { ...state.status, initialized }})),
      setSyncing: (syncing) => set((state) => ({ status: { ...state.status, syncing }})),
      setError: (error) => set((state) => ({ status: { ...state.status, error }})),
      resetState: () => set({
        info: undefined,
        tokens: [],
        history: [],
        status: {
          initialized: false,
          syncing: false,
          error: undefined,
        },
      }),
    }),
    { // Persist options
      name: 'jacked-cashu-wallet-storage', // unique name for local storage
      version: 1,
      // Optionally, add a custom storage mechanism if not using local storage
      // storage: createJSONStorage(() => sessionStorage),
    }
  )
);
