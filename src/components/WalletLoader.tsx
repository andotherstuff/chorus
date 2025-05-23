import { useWalletAutoLoader } from '@/hooks/useWalletAutoLoader';

/**
 * Component that ensures wallet is loaded for logged-in users
 * This component doesn't render anything visible
 */
export function WalletLoader() {
  // This hook will automatically trigger wallet loading when a user logs in
  useWalletAutoLoader();
  
  // This component doesn't render anything
  return null;
}