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
    // Only run once per user and when we have a user and wallet data hasn't been loaded yet
    if (user && !wallet && !isLoading && hasTriggeredForUser.current !== user.pubkey) {
      console.log(`[WalletAutoLoader] Triggering wallet load for user ${user.pubkey.slice(0, 8)}...`);
      hasTriggeredForUser.current = user.pubkey;
      
      // Invalidate the wallet query to force a refetch
      queryClient.invalidateQueries({ queryKey: ['cashu', 'wallet', user.pubkey] });
      queryClient.invalidateQueries({ queryKey: ['cashu', 'tokens', user.pubkey] });
    }
    
    // Reset when user changes
    if (!user) {
      hasTriggeredForUser.current = null;
    }
    
    // Reset if wallet successfully loads
    if (user && wallet && hasTriggeredForUser.current === user.pubkey) {
      console.log(`[WalletAutoLoader] Wallet loaded successfully for user ${user.pubkey.slice(0, 8)}`);
    }
  }, [user, wallet, isLoading, queryClient]);

  return { wallet, isLoading };
}