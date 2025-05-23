import { useEffect } from 'react';
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

  useEffect(() => {
    // Only run when we have a user and wallet data hasn't been loaded yet
    if (user && !wallet && !isLoading) {
      // Invalidate the wallet query to force a refetch
      queryClient.invalidateQueries({ queryKey: ['cashu', 'wallet', user.pubkey] });
      queryClient.invalidateQueries({ queryKey: ['cashu', 'tokens', user.pubkey] });
    }
  }, [user, wallet, isLoading, queryClient]);

  return { wallet, isLoading };
}