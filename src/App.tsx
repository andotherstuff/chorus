// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import NostrProvider from "@/components/NostrProvider";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Settings from "@/pages/Settings";
import { NostrLoginProvider } from "@nostrify/react/login";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppRouter from "./AppRouter";

// DO NOT MODIFY THIS LIST UNLESS YOU ARE ABSOLUTELY CERTAIN EACH RELAY URL YOU ARE ADDING IS VALID AND THE RELAY IS CURRENTLY ONLINE AND CONFIRMED TO BE FULLY FUNCTIONAL AND WORKING.
const defaultRelays = [
	"wss://relay.nostr.band", // DO NOT MODIFY THIS UNLESS EXPLICITLY REQUESTED
];

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			staleTime: 60000, // 1 minute
			gcTime: Number.POSITIVE_INFINITY,
		},
	},
});

export function App() {
	return (
		<NostrLoginProvider storageKey="nostr:login">
			<NostrProvider relays={defaultRelays}>
				<QueryClientProvider client={queryClient}>
					<TooltipProvider>
						<Toaster />
						<Sonner />
						<AppRouter />
					</TooltipProvider>
				</QueryClientProvider>
			</NostrProvider>
		</NostrLoginProvider>
	);
}

export default App;
