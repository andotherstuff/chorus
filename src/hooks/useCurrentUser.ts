import { type NLoginType, NUser, useNostrLogin } from '@nostrify/react/login';
import { useNostr } from '@nostrify/react';
import { useCallback, useMemo } from 'react';
import type { NostrEvent } from '@nostrify/nostrify';

import { useAuthor } from './useAuthor.ts';
import { useLoggedInAccounts } from './useLoggedInAccounts.ts';

export function useCurrentUser() {
  const { nostr } = useNostr();
  const { logins } = useNostrLogin();
  const { currentUser: loggedInAccount } = useLoggedInAccounts();

  const loginToUser = useCallback((login: NLoginType): NUser  => {
    switch (login.type) {
      case 'nsec': // Nostr login with secret key
        return NUser.fromNsecLogin(login);
      case 'bunker': // Nostr login with NIP-46 "bunker://" URI
        return NUser.fromBunkerLogin(login, nostr);
      case 'extension': // Nostr login with NIP-07 browser extension
        return NUser.fromExtensionLogin(login);
      // Other login types can be defined here
      default:
        throw new Error(`Unsupported login type: ${login.type}`);
    }
  }, [nostr]);

  const users = useMemo(() => {
    const users: NUser[] = [];

    for (const login of logins) {
      try {
        const user = loginToUser(login);
        users.push(user);
      } catch (error) {
        console.warn('Skipped invalid login', login.id, error);
      }
    }

    return users;
  }, [logins, loginToUser]);

  const user = users[0] as NUser | undefined;
  
  // Fallback to useLoggedInAccounts if no user found through Nostrify
  const fallbackUser = useMemo(() => {
    if (user || !loggedInAccount) return null;
    
    // Define a type for the window object with nostr extension
    interface WindowWithNostr extends Window {
      nostr?: {
        getPublicKey: () => Promise<string>;
        signEvent: (event: NostrEvent) => Promise<NostrEvent>;
        nip44?: {
          encrypt: (pubkey: string, plaintext: string) => Promise<string>;
          decrypt: (pubkey: string, ciphertext: string) => Promise<string>;
        };
      };
    }
    
    const windowWithNostr = window as WindowWithNostr;
    
    // Create a compatible user object from loggedInAccount
    return {
      pubkey: loggedInAccount.pubkey,
      signer: typeof window !== 'undefined' && windowWithNostr.nostr ? windowWithNostr.nostr : null,
      method: 'extension' as const
    } as NUser;
  }, [user, loggedInAccount]);
  
  const finalUser = user || fallbackUser;
  const author = useAuthor(finalUser?.pubkey);

  return {
    user: finalUser,
    users: finalUser ? [finalUser] : [],
    ...author.data,
  };
}
