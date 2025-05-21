import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CASHU_EVENT_KINDS, CashuWalletStruct, CashuToken, activateMint, updateMintKeys } from '@/lib/cashu';
import { nip44, NostrEvent } from 'nostr-tools';
import { useCashuStore, Nip60TokenEvent } from '@/stores/cashuStore';
import { Proof } from '@cashu/cashu-ts';
import { getLastEventTimestamp } from '@/lib/nostrTimestamps';
import { NSchema as n } from '@nostrify/nostrify';
import { z } from 'zod';

/**
 * Hook to fetch and manage the user's Cashu wallet
 */
export function useCashuWallet() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const cashuStore = useCashuStore();

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

      try {
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

        for (const mint of walletData.mints) {
          const { mintInfo, keysets } = await activateMint(mint);
          cashuStore.addMint(mint);
          cashuStore.setMintInfo(mint, mintInfo);
          cashuStore.setKeysets(mint, keysets);
          const { keys } = await updateMintKeys(mint);
          cashuStore.setKeys(mint, keys);
        }

        cashuStore.setPrivkey(walletData.privkey);

        // call getNip60TokensQuery
        await getNip60TokensQuery.refetch();
        return {
          id: event.id,
          wallet: walletData,
          createdAt: event.created_at
        };
      } catch (error) {
        console.error('Failed to decrypt wallet data:', error);
        return null;
      }
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
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for event to be published

      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashu', 'wallet', user?.pubkey] });
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
        // publish token event
        await nostr.event(newTokenEvent);

        // update local event IDs on all newProofs
        for (const proof of newProofs) {
          cashuStore.setProofEventId(proof, newTokenEvent.id);
        }

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

        // publish deletion event
        try {
          await nostr.event(deletionEvent);
        } catch (error) {
          console.error('Failed to publish deletion event:', error);
        }
      }

      // remove proofs from store
      const proofsToRemoveFiltered = proofsToRemove.filter(proof => !newProofs.includes(proof));
      cashuStore.removeProofs(proofsToRemoveFiltered);

      // add proofs to store
      cashuStore.addProofs(newProofs, eventToReturn?.id || '');

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
    isLoading: walletQuery.isLoading || getNip60TokensQuery.isLoading,
    createWallet: createWalletMutation.mutate,
    updateProofs: updateProofsMutation.mutateAsync,
  };
}