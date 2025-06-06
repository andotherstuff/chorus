import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CASHU_EVENT_KINDS, CashuWalletStruct, CashuToken, activateMint, updateMintKeys, defaultMints } from '@/lib/cashu';
import { NostrEvent, getPublicKey } from 'nostr-tools';
import { useCashuStore, Nip60TokenEvent } from '@/stores/cashuStore';
import { Proof } from '@cashu/cashu-ts';
import { getLastEventTimestamp } from '@/lib/nostrTimestamps';
import { NSchema as n } from '@jsr/nostrify__nostrify';
import { z } from 'zod';
import { useNutzaps } from '@/hooks/useNutzaps';
import { hexToBytes } from '@noble/hashes/utils';

/**
 * Hook to fetch and manage the user's Cashu wallet
 */
export function useCashuWallet() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const cashuStore = useCashuStore();
  const { createNutzapInfo } = useNutzaps();

  // Fetch wallet information (kind 17375)
  const walletQuery = useQuery({
    queryKey: ['cashu', 'wallet', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user) throw new Error('User not logged in');

      const events = await nostr.query([
        { kinds: [CASHU_EVENT_KINDS.WALLET], authors: [user.pubkey], limit: 1 }
      ], { signal });

      if (events.length === 0) {
        return null;
      }

      const event = events[0];

      // Decrypt wallet content
      if (!user.signer.nip44) {
        throw new Error('NIP-44 encryption not supported by your signer');
      }

      const decrypted = await user.signer.nip44.decrypt(user.pubkey, event.content);
      const data = n.json().pipe(z.string().array().array()).parse(decrypted);

      const privkey = data.find(([key]) => key === 'privkey')?.[1];

      if (!privkey) {
        throw new Error('Private key not found in wallet data');
      }

      const walletData: CashuWalletStruct = {
        privkey,
        mints: data
          .filter(([key]) => key === 'mint')
          .map(([, mint]) => mint)
      };

      // if the default mint is not in the wallet, add it
      for (const mint of defaultMints) {
        if (!walletData.mints.includes(mint)) {
          walletData.mints.push(mint);
        }
      }

      // remove trailing slashes from mints
      walletData.mints = walletData.mints.map(mint => mint.replace(/\/$/, ''));
      // reduce mints to unique values
      walletData.mints = [...new Set(walletData.mints)];


      // fetch the mint info and keysets for each mint
      await Promise.all(walletData.mints.map(async (mint) => {
        const { mintInfo, keysets } = await activateMint(mint);
        cashuStore.addMint(mint);
        cashuStore.setMintInfo(mint, mintInfo);
        cashuStore.setKeysets(mint, keysets);
        const { keys } = await updateMintKeys(mint, keysets);
        cashuStore.setKeys(mint, keys);
      }));

      cashuStore.setPrivkey(walletData.privkey);

      // if no active mint is set, set the first mint as active
      if (!cashuStore.getActiveMintUrl()) {
        cashuStore.setActiveMintUrl(walletData.mints[0]);
      }

      // log wallet data
      console.log('walletData', walletData);

      // call getNip60TokensQuery
      await getNip60TokensQuery.refetch();
      return {
        id: event.id,
        wallet: walletData,
        createdAt: event.created_at
      };
    },
    enabled: !!user
  });

  // Create or update wallet
  const createWalletMutation = useMutation({
    mutationFn: async (walletData: CashuWalletStruct) => {
      if (!user) throw new Error('User not logged in');
      if (!user.signer.nip44) {
        throw new Error('NIP-44 encryption not supported by your signer');
      }

      // remove trailing slashes from mints
      walletData.mints = walletData.mints.map(mint => mint.replace(/\/$/, ''));
      // reduce mints to unique values
      walletData.mints = [...new Set(walletData.mints)];

      const tags = [
        ['privkey', walletData.privkey],
        ...walletData.mints.map(mint => ['mint', mint])
      ]

      // Encrypt wallet data
      const content = await user.signer.nip44.encrypt(
        user.pubkey,
        JSON.stringify(tags)
      );

      // Create wallet event
      const event = await user.signer.signEvent({
        kind: CASHU_EVENT_KINDS.WALLET,
        content,
        tags: [],
        created_at: Math.floor(Date.now() / 1000)
      });

      // Publish event
      await nostr.event(event);

      // Also create or update the nutzap informational event
      try {
        await createNutzapInfo({
          mintOverrides: walletData.mints.map(mint => ({
            url: mint,
            units: ['sat']
          })),
          p2pkPubkey: "02" + getPublicKey(hexToBytes(walletData.privkey))
        });
      } catch (error) {
        console.error('Failed to create nutzap informational event:', error);
        // Continue even if nutzap info creation fails
      }

      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for event to be published

      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashu', 'wallet', user?.pubkey] });
      queryClient.invalidateQueries({ queryKey: ['nutzap', 'info', user?.pubkey] });
    }
  });

  // Fetch token events (kind 7375)
  const getNip60TokensQuery = useQuery({
    queryKey: ['cashu', 'tokens', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user) throw new Error('User not logged in');

      // Get the last stored timestamp for the TOKEN event kind
      const lastTimestamp = getLastEventTimestamp(user.pubkey, CASHU_EVENT_KINDS.TOKEN);

      // Create the filter with 'since' if a timestamp exists
      const filter = {
        kinds: [CASHU_EVENT_KINDS.TOKEN],
        authors: [user.pubkey],
        limit: 100
      };

      // Add the 'since' property if we have a previous timestamp
      if (lastTimestamp) {
        Object.assign(filter, { since: lastTimestamp + 1 });
      }

      const events = await nostr.query([filter], { signal });

      if (events.length === 0) {
        return [];
      }

      const nip60TokenEvents: Nip60TokenEvent[] = [];

      for (const event of events) {
        try {
          if (!user.signer.nip44) {
            throw new Error('NIP-44 encryption not supported by your signer');
          }

          const decrypted = await user.signer.nip44.decrypt(user.pubkey, event.content);
          const tokenData = JSON.parse(decrypted) as CashuToken;

          nip60TokenEvents.push({
            id: event.id,
            token: tokenData,
            createdAt: event.created_at
          });
          // add proofs to store
          cashuStore.addProofs(tokenData.proofs, event.id);

        } catch (error) {
          console.error('Failed to decrypt token data:', error);
        }
      }

      return nip60TokenEvents;
    },
    enabled: !!user
  });

  const updateProofsMutation = useMutation({
    mutationFn: async ({ mintUrl, proofsToAdd, proofsToRemove }: { mintUrl: string, proofsToAdd: Proof[], proofsToRemove: Proof[] }): Promise<NostrEvent | null> => {
      if (!user) throw new Error('User not logged in');
      if (!user.signer.nip44) {
        throw new Error('NIP-44 encryption not supported by your signer');
      }

      // get all event IDs of proofsToRemove 
      const eventIdsToRemoveUnfiltered = proofsToRemove.map(proof => cashuStore.getProofEventId(proof));
      const eventIdsToRemove = [...new Set(eventIdsToRemoveUnfiltered.filter(id => id !== undefined) as string[])];

      // get all proofs with eventIdsToRemove
      const allProofsWithEventIds = eventIdsToRemove.map(id => cashuStore.getProofsByEventId(id)).flat();

      // and filter out those that we want to keep to roll them over to a new event
      const proofsToKeepWithEventIds = allProofsWithEventIds.filter(proof => !proofsToRemove.includes(proof));

      // combine proofsToAdd and proofsToKeepWithEventIds
      const newProofs = [...proofsToAdd, ...proofsToKeepWithEventIds];

      let eventToReturn: NostrEvent | null = null;

      if (newProofs.length) {
        // generate a new token event
        const newToken: CashuToken = {
          mint: mintUrl,
          proofs: newProofs,
          del: eventIdsToRemove
        }

        // encrypt token event
        const newTokenEventContent = await user.signer.nip44.encrypt(
          user.pubkey,
          JSON.stringify(newToken)
        );

        // create token event
        const newTokenEvent = await user.signer.signEvent({
          kind: CASHU_EVENT_KINDS.TOKEN,
          content: newTokenEventContent,
          tags: [],
          created_at: Math.floor(Date.now() / 1000)
        });

        // add proofs to store
        cashuStore.addProofs(newProofs, newTokenEvent?.id || '');

        // publish token event
        try {
          await nostr.event(newTokenEvent);
        } catch (error) {
          console.error('Failed to publish token event:', error);
        }

        // update local event IDs on all newProofs
        newProofs.forEach(proof => {
          cashuStore.setProofEventId(proof, newTokenEvent.id);
        });

        eventToReturn = newTokenEvent;
      }

      // delete nostr events
      if (eventIdsToRemove.length) {
        // create deletion event
        const deletionEvent = await user.signer.signEvent({
          kind: 5,
          content: 'Deleted token event',
          tags: eventIdsToRemove.map(id => ['e', id]),
          created_at: Math.floor(Date.now() / 1000)
        });

        // remove proofs from store
        const proofsToRemoveFiltered = proofsToRemove.filter(proof => !newProofs.map(p => p.secret).includes(proof.secret));
        cashuStore.removeProofs(proofsToRemoveFiltered);

        // publish deletion event
        try {
          await nostr.event(deletionEvent);
        } catch (error) {
          console.error('Failed to publish deletion event:', error);
        }
      }

      return eventToReturn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashu', 'tokens', user?.pubkey] });
    }
  });

  return {
    wallet: walletQuery.data?.wallet,
    walletId: walletQuery.data?.id,
    tokens: getNip60TokensQuery.data || [],
    isLoading: walletQuery.isFetching || getNip60TokensQuery.isFetching,
    createWallet: createWalletMutation.mutate,
    updateProofs: updateProofsMutation.mutateAsync,
  };
}