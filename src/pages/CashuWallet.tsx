import { useEffect, useState } from "react";
import { LoginArea } from "@/components/auth/LoginArea";
import { CashuHistoryCard } from "@/components/cashu/CashuHistoryCard";
import { CashuTokenCard } from "@/components/cashu/CashuTokenCard";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { CashuWalletLightningCard } from "@/components/cashu/CashuWalletLightningCard";
import { CashuWalletCard } from "@/components/cashu/CashuWalletCard";
import { NutzapCard } from "@/components/cashu/NutzapCard";
import Header from "@/components/ui/Header";
import { Separator } from "@/components/ui/separator";
import { useCashuToken } from "@/hooks/useCashuToken";
import { useCashuWallet } from "@/hooks/useCashuWallet";
import { useCashuStore } from "@/stores/cashuStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useToast } from "@/hooks/useToast";
import { Loader2 } from "lucide-react";
// import { formatUSD, satoshisToUSD } from "@/lib/bitcoinUtils";
import { formatBalance, calculateBalance } from "@/lib/cashu";
import { useBitcoinPrice, satsToUSD, formatUSD } from "@/hooks/useBitcoinPrice";
import { useCurrencyDisplayStore } from "@/stores/currencyDisplayStore";

export function CashuWallet() {
  const { user } = useCurrentUser();
  const { wallet } = useCashuWallet();
  const { receiveToken } = useCashuToken();
  const { toast } = useToast();
  const cashuStore = useCashuStore();
  const onboardingStore = useOnboardingStore();
  const [isProcessingToken, setIsProcessingToken] = useState(false);
  const { showSats, toggleCurrency } = useCurrencyDisplayStore();
  const { data: btcPrice, isLoading: btcPriceLoading } = useBitcoinPrice();
  // Calculate total balance across all mints
  const balances = calculateBalance(cashuStore.proofs);
  const totalBalance = Object.values(balances).reduce(
    (sum, balance) => sum + balance,
    0
  );

  // Helper function to format amount based on user preference
  const formatAmount = (sats: number): string => {
    if (showSats) {
      return `${sats.toLocaleString()} sats`;
    } else {
      const usd = satsToUSD(sats, btcPrice?.USD || null);
      return usd !== null ? formatUSD(usd) : `${sats.toLocaleString()} sats`;
    }
  };

  // Handle pending onboarding token
  useEffect(() => {
    // Only process if user is logged in, wallet is loaded, and not already processing
    if (!user || !wallet || isProcessingToken) return;

    // Check for pending onboarding token
    const pendingToken = cashuStore.getPendingOnboardingToken();
    if (pendingToken) {
      // Check if already claimed
      if (onboardingStore.isTokenClaimed()) {
        // Clear the pending token without processing
        cashuStore.setPendingOnboardingToken(undefined);
        return;
      }

      // If USD mode and price is still loading, wait
      if (!showSats && btcPriceLoading) {
        return;
      }

      const processPendingToken = async () => {
        setIsProcessingToken(true);

        try {
          // Clear the pending token immediately to prevent re-processing
          cashuStore.setPendingOnboardingToken(undefined);

          // Receive the token
          const proofs = await receiveToken(pendingToken);

          // Calculate total amount
          const totalAmount = proofs.reduce((sum, p) => sum + p.amount, 0);

          // Mark onboarding token as claimed
          onboardingStore.setTokenClaimed(true);

          // Show success toast
          toast({
            title: "✅ Ecash received!",
            description: `You've received ${formatAmount(
              totalAmount
            )} in your wallet`,
          });
        } catch (error) {
          console.error("Error receiving pending token:", error);
          toast({
            title: "Failed to redeem token",
            description:
              error instanceof Error ? error.message : "Unknown error occurred",
            variant: "destructive",
          });
        } finally {
          setIsProcessingToken(false);
        }
      };

      processPendingToken();
    }
  }, [
    user,
    wallet,
    cashuStore,
    onboardingStore,
    receiveToken,
    toast,
    showSats,
    btcPriceLoading,
    formatAmount,
  ]);

  useEffect(() => {
    // Only process if user is logged in, wallet is loaded, and not already processing
    if (!user || !wallet || isProcessingToken) return;

    // Check if there's a token in the URL hash
    const hash = window.location.hash;
    if (!hash || !hash.includes("token=")) return;

    // Extract the token from the hash
    const tokenMatch = hash.match(/token=([^&]+)/);
    if (!tokenMatch || !tokenMatch[1]) return;

    const token = tokenMatch[1];

    // Process the token
    const processToken = async () => {
      setIsProcessingToken(true);

      try {
        // Clean up the URL immediately to prevent re-processing
        window.history.replaceState(null, "", window.location.pathname);

        // Receive the token
        const proofs = await receiveToken(token);

        // Calculate total amount
        const totalAmount = proofs.reduce((sum, p) => sum + p.amount, 0);

        // Show success toast
        toast({
          title: "✅ eCash received!",
          description: `You've received ${formatAmount(
            totalAmount
          )} in your wallet`,
        });
      } catch (error) {
        console.error("Error receiving token from URL:", error);
        toast({
          title: "Failed to redeem token",
          description:
            error instanceof Error ? error.message : "Unknown error occurred",
          variant: "destructive",
        });
      } finally {
        setIsProcessingToken(false);
      }
    };

    processToken();
  }, [user, wallet]); // Depend on both user and wallet being loaded

  return (
    <div className="container mx-auto py-1 px-3 sm:px-4">
      <Header />
      <Separator className="my-2" />

      {/* Total Balance Display */}
      {user && wallet && (
        <div className="text-center py-6">
          <div className="text-5xl font-bold tabular-nums">
            {showSats
              ? formatBalance(totalBalance)
              : btcPrice
              ? formatUSD(satsToUSD(totalBalance, btcPrice.USD) || 0)
              : formatBalance(totalBalance)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Total Balance</p>
          <button
            onClick={() => toggleCurrency()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
          >
            Show in {showSats ? "USD" : "sats"}
          </button>
        </div>
      )}

      {isProcessingToken && (
        <div className="mb-6 p-4 bg-muted rounded-lg flex items-center space-x-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Processing Cashu token from URL...</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CashuWalletLightningCard />
        <CashuWalletCard />
        {/* <NutzapCard /> */}
        {/* <CashuTokenCard /> */}
        <CashuHistoryCard />
      </div>

      {!user && (
        <div className="mt-8 p-4 bg-muted rounded-lg text-center">
          <p className="text-lg font-medium">Log in to use your Cashu wallet</p>
          <p className="text-muted-foreground">
            Your wallet data is stored encrypted on Nostr relays and follows you
            across applications.
          </p>
        </div>
      )}
    </div>
  );
}

export default CashuWallet;
