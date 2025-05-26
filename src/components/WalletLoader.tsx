import { useWalletAutoLoader } from '@/hooks/useWalletAutoLoader';
import { useAutoReceiveNutzaps } from '@/hooks/useAutoReceiveNutzaps';

/**
 * Component that ensures wallet is loaded for logged-in users
 * and automatically receives nutzaps
 * This component doesn't render anything visible
 */
export function WalletLoader() {
  // This hook will automatically trigger wallet loading when a user logs in
  useWalletAutoLoader();
  
  // Auto-receive nutzaps globally
  useAutoReceiveNutzaps();
  
  // This component doesn't render anything
  return null;
}