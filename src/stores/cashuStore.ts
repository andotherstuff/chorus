import { Keys, MeltQuoteResponse, MintQuoteResponse, type Proof } from '@cashu/cashu-ts'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { GetInfoResponse, MintKeyset, MintKeys } from '@cashu/cashu-ts'
import { CashuToken } from '@/lib/cashu';

interface ProofWithEventId extends Proof {
  eventId: string;
}

export interface Nip60TokenEvent {
  id: string;
  token: CashuToken;
  createdAt: number;
}

interface CashuStore {
  mints: { url: string, mintInfo?: GetInfoResponse, keysets?: MintKeyset[], keys?: Record<string, MintKeys>[], events?: Nip60TokenEvent[], mintQuotes?: Record<string, MintQuoteResponse>, meltQuotes?: Record<string, MeltQuoteResponse> }[];
  proofs: ProofWithEventId[];
  privkey?: string;
  activeMintUrl?: string;
  pendingOnboardingToken?: string;

  addMint: (url: string) => void;
  getMint: (url: string) => { url: string, mintInfo?: GetInfoResponse, keysets?: MintKeyset[], keys?: Record<string, MintKeys>[], events?: Nip60TokenEvent[], mintQuotes?: Record<string, MintQuoteResponse>, meltQuotes?: Record<string, MeltQuoteResponse> };
  setMintInfo: (url: string, mintInfo: GetInfoResponse) => void;
  setKeysets: (url: string, keysets: MintKeyset[]) => void;
  setKeys: (url: string, keys: Record<string, MintKeys>[]) => void;
  addProofs: (proofs: Proof[], eventId: string) => void;
  removeProofs: (proofs: Proof[]) => void;
  setPrivkey: (privkey: string) => void;
  getMintProofs: (mintUrl: string) => Promise<Proof[]>;
  setProofEventId: (proof: Proof, eventId: string) => void;
  getProofEventId: (proof: Proof) => string | undefined;
  getProofsByEventId: (eventId: string) => Proof[];
  getMintQuotes: (mintUrl: string) => Record<string, MintQuoteResponse>;
  getMeltQuotes: (mintUrl: string) => Record<string, MeltQuoteResponse>;
  addMintQuote: (mintUrl: string, quote: MintQuoteResponse) => void;
  addMeltQuote: (mintUrl: string, quote: MeltQuoteResponse) => void;
  updateMintQuote: (mintUrl: string, quoteId: string, quote: MintQuoteResponse) => void;
  updateMeltQuote: (mintUrl: string, quoteId: string, quote: MeltQuoteResponse) => void;
  getMintQuote: (mintUrl: string, quoteId: string) => MintQuoteResponse;
  getMeltQuote: (mintUrl: string, quoteId: string) => MeltQuoteResponse;
  setActiveMintUrl: (url: string) => void;
  getActiveMintUrl: () => string | undefined;
  setPendingOnboardingToken: (token: string | undefined) => void;
  getPendingOnboardingToken: () => string | undefined;
  clearStore: () => void;
}

// Usage:
// const mints = useStore((state) => state.mints);
// const proofs = useStore((state) => state.proofs);
// const addMint = useStore((state) => state.addMint);
// const addProof = useStore((state) => state.addProof);
export const useCashuStore = create<CashuStore>()(
  persist(
    (set, get) => ({
      mints: [],
      proofs: [],
      isLoading: false,
      activeMintUrl: undefined,
      pendingOnboardingToken: undefined,

      addMint(url) {
        const existingMints = get().mints.map((mint) => mint.url)
        if (!existingMints.includes(url)) {
          set({ mints: [...get().mints, { url }] })
          // Set as active if it's the first mint
          if (get().mints.length === 0) {
            set({ activeMintUrl: url })
          }
        }
      },

      getMint(url) {
        const mint = get().mints.find((mint) => mint.url === url);
        if (!mint) {
          throw new Error('No mint found for url');
        }
        return mint;
      },

      setMintInfo(url, mintInfo) {
        set({ mints: get().mints.map((mint) => mint.url === url ? { ...mint, mintInfo } : mint) })
      },

      setKeysets(url, keysets) {
        set({ mints: get().mints.map((mint) => mint.url === url ? { ...mint, keysets } : mint) })
      },

      setKeys(url, keys) {
        set({ mints: get().mints.map((mint) => mint.url === url ? { ...mint, keys } : mint) })
      },

      addProofs(proofs, eventId) {
        const existingProofs = get().proofs.map((p) => p.secret)
        for (const proof of proofs) {
          if (!existingProofs.includes(proof.secret)) {
            set({ proofs: [...get().proofs, { ...proof, eventId }] })
          }
        }
      },

      removeProofs(proofs: Proof[]) {
        set((state) => ({
          proofs: state.proofs.filter((proof) => !proofs.some((p) => p.secret === proof.secret))
        }));
      },

      setPrivkey(privkey) {
        set({ privkey })
      },

      async getMintProofs(mintUrl: string): Promise<Proof[]> {
        // get all active keysets for the mint
        const keysets = get().mints.find((mint) => mint.url === mintUrl)?.keysets;
        if (!keysets) {
          throw new Error('No keysets found for mint');
        }
        // filter only active keysets
        // const activeKeysets = keysets.filter((keyset) => keyset.active);
        // get all proofs for the keysets from store
        const proofs = get().proofs.filter((proof) => keysets.some((keyset) => keyset.id === proof.id));
        return proofs;
      },

      setProofEventId(proof, eventId) {
        set({ proofs: get().proofs.map((p) => p.secret === proof.secret ? { ...p, eventId } : p) });
      },

      getProofEventId(proof) {
        return get().proofs.find((p) => p.secret === proof.secret)?.eventId;
      },

      getProofsByEventId(eventId: string) {
        return get().proofs.filter((p) => p.eventId === eventId);
      },

      getMintQuotes(mintUrl: string) {
        const quotes = get().mints.find((mint) => mint.url === mintUrl)?.mintQuotes;
        if (!quotes) {
          throw new Error('No mint quotes found for mint');
        }
        return quotes;
      },

      getMeltQuotes(mintUrl: string) {
        const quotes = get().mints.find((mint) => mint.url === mintUrl)?.meltQuotes;
        if (!quotes) {
          throw new Error('No melt quotes found for mint');
        }
        return quotes;
      },

      addMintQuote(mintUrl: string, quote: MintQuoteResponse) {
        set({ mints: get().mints.map((mint) => mint.url === mintUrl ? { ...mint, mintQuotes: { ...mint.mintQuotes, [quote.quote]: quote } } : mint) });
      },

      addMeltQuote(mintUrl: string, quote: MeltQuoteResponse) {
        set({ mints: get().mints.map((mint) => mint.url === mintUrl ? { ...mint, meltQuotes: { ...mint.meltQuotes, [quote.quote]: quote } } : mint) });
      },

      updateMintQuote(mintUrl: string, quoteId: string, quote: MintQuoteResponse) {
        set({ mints: get().mints.map((mint) => mint.url === mintUrl ? { ...mint, mintQuotes: { ...mint.mintQuotes, [quoteId]: quote } } : mint) });
      },

      updateMeltQuote(mintUrl: string, quoteId: string, quote: MeltQuoteResponse) {
        set({ mints: get().mints.map((mint) => mint.url === mintUrl ? { ...mint, meltQuotes: { ...mint.meltQuotes, [quoteId]: quote } } : mint) });
      },

      getMintQuote(mintUrl: string, quoteId: string) {
        const quote = get().mints.find((mint) => mint.url === mintUrl)?.mintQuotes?.[quoteId];
        if (!quote) {
          throw new Error('No mint quote found for mint');
        }
        return quote;
      },

      getMeltQuote(mintUrl: string, quoteId: string) {
        const quote = get().mints.find((mint) => mint.url === mintUrl)?.meltQuotes?.[quoteId];
        if (!quote) {
          throw new Error('No melt quote found for mint');
        }
        return quote;
      },

      setActiveMintUrl(url: string) {
        set({ activeMintUrl: url });
      },

      getActiveMintUrl() {
        return get().activeMintUrl;
      },

      setPendingOnboardingToken(token: string | undefined) {
        set({ pendingOnboardingToken: token });
      },

      getPendingOnboardingToken() {
        return get().pendingOnboardingToken;
      },

      clearStore() {
        set({ mints: [], proofs: [], privkey: undefined, activeMintUrl: undefined, pendingOnboardingToken: undefined });
      },
    }),
    { name: 'cashu' },
  ),
)