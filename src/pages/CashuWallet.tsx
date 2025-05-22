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
import { useToast } from "@/hooks/useToast";
import { Loader2 } from "lucide-react";
import { formatBalance } from "@/lib/cashu";

export function CashuWallet() {
  const { user } = useCurrentUser();
  const { wallet } = useCashuWallet();
  const { receiveToken } = useCashuToken();
  const { toast } = useToast();
  const [isProcessingToken, setIsProcessingToken] = useState(false);
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
          title: "Token Redeemed Successfully!",
          description: `You've received ${formatBalance(totalAmount)}`,
        });
      } catch (error) {
        console.error("Error receiving token from URL:", error);
        toast({
          title: "Failed to redeem token",
          description: error instanceof Error ? error.message : "Unknown error occurred",
          variant: "destructive",
        });
      } finally {
        setIsProcessingToken(false);
      }
    };

    processToken();
  }, [user, wallet]); // Depend on both user and wallet being loaded

  return (
    <div className="container mx-auto py-3 px-3 sm:px-4">
      <Header />
      <Separator className="my-4" />

      {isProcessingToken && (
        <div className="mb-6 p-4 bg-muted rounded-lg flex items-center space-x-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Processing Cashu token from URL...</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CashuWalletCard />
        <CashuWalletLightningCard />
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
