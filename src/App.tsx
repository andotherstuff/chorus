// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import NostrProvider from '@/components/NostrProvider'
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NostrLoginProvider } from '@nostrify/react/login';
import AppRouter from './AppRouter';
import { useSystemTheme } from '@/hooks/useSystemTheme';
import { JoinDialogProvider } from '@/components/groups/JoinDialogProvider';
import { WalletLoader } from '@/components/WalletLoader';
import { AppProvider } from '@/components/AppProvider';
import { AppConfig } from '@/contexts/AppContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
      gcTime: Infinity,
    },
  },
});

const defaultConfig: AppConfig = {
  theme: "system",
  relayUrl: "wss://relay.chorus.community", // DO NOT MODIFY THIS UNLESS EXPLICITLY REQUESTED
};

const presetRelays = [
  { url: 'wss://relay.chorus.community', name: 'Chorus' },
  { url: 'wss://ditto.pub/relay', name: 'Ditto' },
  { url: 'wss://relay.nostr.band', name: 'Nostr.Band' },
  { url: 'wss://relay.damus.io', name: 'Damus' },
  { url: 'wss://relay.primal.net', name: 'Primal' },
];

export function App() {
  // Use the enhanced theme hook
  useSystemTheme();

  return (
    <AppProvider storageKey="nostr:app-config" defaultConfig={defaultConfig} presetRelays={presetRelays}>
      <QueryClientProvider client={queryClient}>
        <NostrLoginProvider storageKey='nostr:login'>
          <NostrProvider>
            <TooltipProvider>
              <JoinDialogProvider>
                <WalletLoader />
                <Toaster />
                <Sonner />
                <AppRouter />
              </JoinDialogProvider>
            </TooltipProvider>
          </NostrProvider>
        </NostrLoginProvider>
      </QueryClientProvider>
    </AppProvider>
  );
}

export default App;
