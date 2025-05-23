import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, Loader2, Bitcoin, AlertCircle, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCashuWallet } from "@/hooks/useCashuWallet";
import { useCashuStore } from "@/stores/cashuStore";
import { useCashuToken } from "@/hooks/useCashuToken";
import { useSendNutzap, useFetchNutzapInfo, useVerifyMintCompatibility } from "@/hooks/useSendNutzap";
import { Proof } from "@cashu/cashu-ts";
import { formatBalance } from "@/lib/cashu";
import { useBitcoinPrice, satsToUSD, formatUSD } from "@/hooks/useBitcoinPrice";
import { useCurrencyDisplayStore } from "@/stores/currencyDisplayStore";
import { NutzapList } from "./NutzapList";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface NutzapInterfaceProps {
  postId: string;
  authorPubkey: string;
  relayHint?: string;
  onSuccess?: () => void;
}

export function NutzapInterface({ postId, authorPubkey, relayHint, onSuccess }: NutzapInterfaceProps) {
  const { user } = useCurrentUser();
  const { wallet } = useCashuWallet();
  const cashuStore = useCashuStore();
  const { sendToken } = useCashuToken();
  const { sendNutzap, isSending } = useSendNutzap();
  const { fetchNutzapInfo, isFetching, error: fetchError } = useFetchNutzapInfo();
  const { verifyMintCompatibility } = useVerifyMintCompatibility();
  const { showSats } = useCurrencyDisplayStore();
  const { data: btcPrice } = useBitcoinPrice();
  
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [recipientWalletStatus, setRecipientWalletStatus] = useState<'loading' | 'no-wallet' | 'no-compatible-mint' | 'ready'>('loading');

  // Check recipient wallet status when component mounts
  useEffect(() => {
    // Skip if we don't have the required dependencies
    if (!user || !wallet || !cashuStore.activeMintUrl) {
      return;
    }

    let cancelled = false;

    const checkRecipientWallet = async () => {
      try {
        setRecipientWalletStatus('loading');
        const recipientInfo = await fetchNutzapInfo(authorPubkey);
        
        // Check if the effect was cancelled before updating state
        if (cancelled) return;
        
        // Try to verify mint compatibility
        try {
          verifyMintCompatibility(recipientInfo);
          if (!cancelled) {
            setRecipientWalletStatus('ready');
          }
        } catch {
          if (!cancelled) {
            setRecipientWalletStatus('no-compatible-mint');
          }
        }
      } catch (error) {
        // If we can't fetch nutzap info, recipient doesn't have a wallet
        if (!cancelled) {
          setRecipientWalletStatus('no-wallet');
        }
      }
    };

    checkRecipientWallet();

    // Cleanup function to prevent state updates after unmount
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorPubkey, user?.pubkey, wallet, cashuStore.activeMintUrl]); // Only depend on stable values

  // Format amount based on user preference
  const formatAmount = (sats: number) => {
    if (showSats) {
      return formatBalance(sats);
    } else if (btcPrice) {
      return formatUSD(satsToUSD(sats, btcPrice.USD));
    }
    return formatBalance(sats);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("You must be logged in to send eCash");
      return;
    }

    if (!wallet) {
      toast.error("You need to set up a Cashu wallet first");
      return;
    }

    if (!cashuStore.activeMintUrl) {
      toast.error("No active mint selected. Please select a mint in your wallet settings.");
      return;
    }

    if (!amount || isNaN(parseFloat(amount))) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      setIsProcessing(true);

      // Fetch recipient's nutzap info
      const recipientInfo = await fetchNutzapInfo(authorPubkey);

      // Convert amount based on currency preference
      let amountValue: number;
      
      if (showSats) {
        amountValue = parseInt(amount);
      } else {
        // Convert USD to sats
        if (!btcPrice) {
          toast.error("Bitcoin price not available");
          return;
        }
        const usdAmount = parseFloat(amount);
        amountValue = Math.round(usdAmount / btcPrice.USD * 100000000); // Convert USD to sats
      }

      if (amountValue < 1) {
        toast.error("Amount must be at least 1 sat");
        return;
      }

      // Verify mint compatibility and get a compatible mint URL
      const compatibleMintUrl = verifyMintCompatibility(recipientInfo);

      // Send token using p2pk pubkey from recipient info
      const proofs = (await sendToken(
        compatibleMintUrl,
        amountValue,
        recipientInfo.p2pkPubkey
      )) as Proof[];

      // Send nutzap using recipient info
      await sendNutzap({
        recipientInfo,
        comment,
        proofs,
        mintUrl: compatibleMintUrl,
        eventId: postId,
        relayHint,
      });

      toast.success(`Successfully sent ${formatAmount(amountValue)}`);
      
      // Clear form
      setAmount("");
      setComment("");
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error sending nutzap:", error);
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsProcessing(false);
    }
  };

  const isLoading = isProcessing || isSending || isFetching;

  return (
    <div className="mt-3 space-y-3">
      {/* Check if user has their own wallet first */}
      {!user ? (
        <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-900 dark:text-amber-100">
            You must be logged in to send eCash.
          </AlertDescription>
        </Alert>
      ) : !wallet ? (
        <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-900 dark:text-amber-100">
            You need to set up a Cashu wallet first to send eCash.
          </AlertDescription>
        </Alert>
      ) : !cashuStore.activeMintUrl ? (
        <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-900 dark:text-amber-100">
            No active mint selected. Please select a mint in your wallet settings.
          </AlertDescription>
        </Alert>
      ) : recipientWalletStatus === 'loading' ? (
        <div className="bg-muted/30 rounded-md p-3 border border-border/50 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Checking recipient wallet...</span>
        </div>
      ) : recipientWalletStatus === 'no-wallet' ? (
        <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <Wallet className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-900 dark:text-red-100">
            This user hasn't set up a Cashu wallet yet. They need to create a wallet before they can receive eCash.
          </AlertDescription>
        </Alert>
      ) : recipientWalletStatus === 'no-compatible-mint' ? (
        <Alert className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
          <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertDescription className="text-orange-900 dark:text-orange-100">
            You don't share any mints with this user. To send them eCash, you need to add one of their mints to your wallet, or they need to add one of yours.
          </AlertDescription>
        </Alert>
      ) : (
        /* Show form only when everything is ready */
        <form onSubmit={handleSubmit} className="bg-muted/30 rounded-md p-3 border border-border/50 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="sr-only" htmlFor="amount">
                Amount {showSats ? "(sats)" : "(USD)"}
              </Label>
              <Input
                id="amount"
                type="number"
                step={showSats ? "1" : "0.01"}
                min={showSats ? "1" : "0.01"}
                placeholder={showSats ? "100 sats" : "$0.10"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-sm h-8"
                disabled={isLoading}
                autoFocus
              />
            </div>
            <div className="flex-1">
              <Label className="sr-only" htmlFor="comment">
                Comment (optional)
              </Label>
              <Input
                id="comment"
                type="text"
                placeholder="Thanks! (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="text-sm h-8"
                disabled={isLoading}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !amount}
              className="text-xs h-7"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  {showSats ? (
                    <Bitcoin className="mr-1 h-3 w-3" />
                  ) : (
                    <DollarSign className="mr-1 h-3 w-3" />
                  )}
                  Send eCash
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Always show Zap List */}
      <NutzapList postId={postId} />
    </div>
  );
}