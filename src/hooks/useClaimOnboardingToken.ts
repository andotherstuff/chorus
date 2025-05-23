import { useState, useCallback } from "react";
import { useCashuToken } from "@/hooks/useCashuToken";
import { useCashuStore } from "@/stores/cashuStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useToast } from "@/hooks/useToast";
import { useBitcoinPrice, satsToUSD, formatUSD } from "@/hooks/useBitcoinPrice";
import { useCurrencyDisplayStore } from "@/stores/currencyDisplayStore";

export interface UseClaimOnboardingTokenResult {
  claimOnboardingToken: (token?: string) => Promise<void>;
  isProcessing: boolean;
  error: Error | null;
}

export function useClaimOnboardingToken(): UseClaimOnboardingTokenResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const { receiveToken } = useCashuToken();
  const { toast } = useToast();
  const cashuStore = useCashuStore();
  const onboardingStore = useOnboardingStore();
  const { showSats } = useCurrencyDisplayStore();
  const { data: btcPrice } = useBitcoinPrice();

  // Helper function to format amount based on user preference
  const formatAmount = useCallback((sats: number): string => {
    if (showSats) {
      return `${sats.toLocaleString()} sats`;
    } else {
      const usd = satsToUSD(sats, btcPrice?.USD || null);
      return usd !== null ? formatUSD(usd) : `${sats.toLocaleString()} sats`;
    }
  }, [showSats, btcPrice]);

  const claimOnboardingToken = useCallback(async (token?: string) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Use provided token or get from store
      const tokenToClaim = token || cashuStore.getPendingOnboardingToken();
      
      if (!tokenToClaim) {
        console.log("No onboarding token to claim");
        return;
      }

      // Check if already claimed (only if using store token)
      if (!token && onboardingStore.isTokenClaimed()) {
        console.log("Onboarding token already claimed");
        cashuStore.setPendingOnboardingToken(undefined);
        return;
      }

      // Clear the pending token immediately to prevent re-processing
      if (!token) {
        cashuStore.setPendingOnboardingToken(undefined);
      }

      // Receive the token
      const proofs = await receiveToken(tokenToClaim);

      // Calculate total amount
      const totalAmount = proofs.reduce((sum, p) => sum + p.amount, 0);

      // Mark onboarding token as claimed
      onboardingStore.setTokenClaimed(true);

      // Show success toast
      toast({
        title: "✅ Ecash received!",
        description: `You've received ${formatAmount(totalAmount)} in your wallet`,
      });

    } catch (err) {
      console.error("Error claiming onboarding token:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(err instanceof Error ? err : new Error(errorMessage));
      
      toast({
        title: "Failed to redeem token",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [cashuStore, onboardingStore, receiveToken, toast, formatAmount]);

  return {
    claimOnboardingToken,
    isProcessing,
    error,
  };
}