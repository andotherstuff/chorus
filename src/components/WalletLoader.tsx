import { useWalletAutoLoader } from '@/hooks/useWalletAutoLoader';
import { useAutoReceiveNutzaps } from '@/hooks/useAutoReceiveNutzaps';
import { useAutoReceiveNip60Tokens } from '@/hooks/useAutoReceiveNip60Tokens';

/**
 * Component that ensures wallet is loaded for logged-in users
 * and automatically receives nutzaps and synchronizes NIP-60 tokens
 * This component doesn't render anything visible
 */
export function WalletLoader() {
  // This hook will automatically trigger wallet loading when a user logs in
  useWalletAutoLoader();
  
  // Auto-receive nutzaps globally
  useAutoReceiveNutzaps();
  
  // Auto-sync NIP-60 token events globally
  useAutoReceiveNip60Tokens();
  
  // This component doesn't render anything
  return null;
}