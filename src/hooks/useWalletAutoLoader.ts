import { useEffect, useRef } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCashuWallet } from '@/hooks/useCashuWallet';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook that automatically triggers wallet loading when a user logs in
 * This ensures existing accounts have their wallets loaded after login
 */
export function useWalletAutoLoader() {
  const { user } = useCurrentUser();
  const { wallet, isLoading } = useCashuWallet();
  const queryClient = useQueryClient();
  const hasTriggeredForUser = useRef<string | null>(null);

  useEffect(() => {
    // Only run once per user when they first log in
    if (user && hasTriggeredForUser.current !== user.pubkey) {
      console.log(`[WalletAutoLoader] First login detected for user ${user.pubkey.slice(0, 8)}`);
      hasTriggeredForUser.current = user.pubkey;
      
      // Only invalidate if no wallet data exists and not currently loading
      // This prevents endless invalidation loops
      if (!wallet && !isLoading) {
        console.log(`[WalletAutoLoader] Triggering initial wallet load...`);
        queryClient.invalidateQueries({ queryKey: ['cashu', 'wallet', user.pubkey] });
        queryClient.invalidateQueries({ queryKey: ['cashu', 'tokens', user.pubkey] });
      }
    }
    
    // Reset when user changes
    if (!user) {
      hasTriggeredForUser.current = null;
    }
    
    // Reset if wallet successfully loads
    if (user && wallet && hasTriggeredForUser.current === user.pubkey) {
      console.log(`[WalletAutoLoader] Wallet loaded successfully for user ${user.pubkey.slice(0, 8)}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.pubkey, queryClient]); // Removed wallet and isLoading from deps to prevent loops

  return { wallet, isLoading };
}