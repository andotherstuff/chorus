// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import NostrProvider from '@/components/NostrProvider'
import { EnhancedNostrProvider } from '@/components/EnhancedNostrProvider'
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NostrLoginProvider } from '@nostrify/react/login';
import AppRouter from './AppRouter';
import { useSystemTheme } from '@/hooks/useSystemTheme';
import { JoinDialogProvider } from '@/components/groups/JoinDialogProvider';
import { WalletLoader } from '@/components/WalletLoader';
import { ReactNode } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';

// Separate relay configurations for different protocols
const nip72Relays = [
  'wss://relay.chorus.community/', // Primary relay for NIP-72 public communities
  'wss://relay.damus.io/', // Popular relay that may have NIP-72 groups
  'wss://relay.nostr.band/', // Another relay that indexes content
  'wss://nos.lol/', // NOS relay
];

// const nip29Relays = [
//   'wss://groups.nip29.com/', // Default relay for NIP-29 groups
// ];

// Combined relay list for the base NostrProvider (primarily for NIP-72)
const defaultRelays = [...nip72Relays];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
      gcTime: 1000 * 60 * 30, // 30 minutes - prevent memory leaks while allowing reasonable caching
    },
  },
});

// Inner component that has access to user for signer
function AppWithEnhancedNostr({ children }: { children: ReactNode }) {
  const { user } = useCurrentUser();
  
  return (
    <EnhancedNostrProvider 
      relays={defaultRelays} 
      nip29DefaultRelay="wss://groups.nip29.com/"
      signer={user?.signer}
    >
      {children}
    </EnhancedNostrProvider>
  );
}

export function App() {
  // Use the enhanced theme hook
  useSystemTheme();

  return (
    <NostrLoginProvider storageKey='nostr:login'>
      <NostrProvider relays={defaultRelays}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <JoinDialogProvider>
              <AppWithEnhancedNostr>
                <WalletLoader />
                <Toaster />
                <Sonner />
                <AppRouter />
              </AppWithEnhancedNostr>
            </JoinDialogProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </NostrProvider>
    </NostrLoginProvider>
  );
}

export default App;
