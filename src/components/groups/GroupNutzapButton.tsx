import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Zap, DollarSign, Bitcoin, AlertCircle, Wallet, Loader2 } from "lucide-react";
import {
  useSendNutzap,
  useFetchNutzapInfo,
  useVerifyMintCompatibility,
} from "@/hooks/useSendNutzap";
import { useCashuWallet } from "@/hooks/useCashuWallet";
import { useCashuStore } from "@/stores/cashuStore";
import { useCashuToken } from "@/hooks/useCashuToken";
import { Proof } from "@cashu/cashu-ts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useBitcoinPrice, satsToUSD, formatUSD } from "@/hooks/useBitcoinPrice";
import { useCurrencyDisplayStore } from "@/stores/currencyDisplayStore";
import { formatBalance } from "@/lib/cashu";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GroupNutzapButtonProps {
  groupId: string;
  ownerPubkey: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function GroupNutzapButton({
  groupId,
  ownerPubkey,
  variant = "default",
  size = "default",
  className = "",
}: GroupNutzapButtonProps) {
  const { user } = useCurrentUser();
  const { wallet } = useCashuWallet();
  const cashuStore = useCashuStore();
  const { sendToken } = useCashuToken();
  const { sendNutzap, isSending } = useSendNutzap();
  const { fetchNutzapInfo, isFetching } = useFetchNutzapInfo();
  const { verifyMintCompatibility } = useVerifyMintCompatibility();
  const { showSats } = useCurrencyDisplayStore();
  const { data: btcPrice } = useBitcoinPrice();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [recipientWalletStatus, setRecipientWalletStatus] = useState<'loading' | 'no-wallet' | 'no-compatible-mint' | 'ready'>('loading');

  // Check recipient wallet status when dialog opens
  useEffect(() => {
    // Skip if dialog is not open or we don't have required dependencies
    if (!isDialogOpen || !user || !wallet || !cashuStore.activeMintUrl) {
      return;
    }

    let cancelled = false;

    const checkRecipientWallet = async () => {
      try {
        setRecipientWalletStatus('loading');
        const recipientInfo = await fetchNutzapInfo(ownerPubkey);
        
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
  }, [isDialogOpen, ownerPubkey, user?.pubkey, wallet, cashuStore.activeMintUrl]); // Only depend on stable values

  // Format amount based on user preference
  const formatAmount = (sats: number) => {
    if (showSats) {
      return formatBalance(sats);
    } else if (btcPrice) {
      return formatUSD(satsToUSD(sats, btcPrice.USD));
    }
    return formatBalance(sats);
  };

  const handleOpenDialog = () => {
    if (!user) {
      toast.error("You must be logged in to send eCash");
      return;
    }

    if (!wallet) {
      toast.error("You need to set up a Cashu wallet first");
      return;
    }

    if (!cashuStore.activeMintUrl) {
      toast.error(
        "No active mint selected. Please select a mint in your wallet settings."
      );
      return;
    }

    // Reset the status when opening the dialog
    setRecipientWalletStatus('loading');
    setIsDialogOpen(true);
  };

  const handleSendNutzap = async () => {
    if (!user || !wallet || !cashuStore.activeMintUrl) {
      return;
    }

    if (!amount || isNaN(parseFloat(amount))) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      setIsProcessing(true);

      // Fetch recipient's nutzap info (group owner)
      const recipientInfo = await fetchNutzapInfo(ownerPubkey);

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
        amountValue = Math.round((usdAmount / btcPrice.USD) * 100000000); // Convert USD to sats
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

      // Send nutzap using recipient info, but with the group's a-tag instead of an e-tag
      await sendNutzap({
        recipientInfo,
        comment,
        proofs,
        mintUrl: compatibleMintUrl,
        // Instead of eventId, we'll add the a-tag in the tags array
        // We're using the groupId which is in the format "34550:pubkey:identifier"
        tags: [["a", groupId]], // Add the group identifier as an a-tag
      });

      toast.success(
        `Successfully sent ${formatAmount(amountValue)} to group owner`
      );
      // Clear form on success
      setAmount("");
      setComment("");
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error sending nutzap to group:", error);
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn("justify-start pl-3 text-xs", className)}
        onClick={handleOpenDialog}
      >
        {showSats ? (
          <Bitcoin className="h-4 w-4 mr-1" />
        ) : (
          <DollarSign className="h-4 w-4 mr-1" />
        )}
        Send eCash
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Support this Group</DialogTitle>
            <DialogDescription>
              Send eCash to the group owner to show your support.
            </DialogDescription>
          </DialogHeader>

          {/* Check wallet status first */}
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
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Checking group owner's wallet...</span>
            </div>
          ) : recipientWalletStatus === 'no-wallet' ? (
            <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
              <Wallet className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertDescription className="text-red-900 dark:text-red-100">
                The group owner hasn't set up a Cashu wallet yet. They need to create a wallet before they can receive eCash.
              </AlertDescription>
            </Alert>
          ) : recipientWalletStatus === 'no-compatible-mint' ? (
            <Alert className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
              <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertDescription className="text-orange-900 dark:text-orange-100">
                You don't share any mints with the group owner. To send them eCash, you need to add one of their mints to your wallet, or they need to add one of yours.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="amount" className="text-right">
                    Amount {showSats ? "(sats)" : "(USD)"}
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder={showSats ? "100" : "0.10"}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="comment" className="text-right">
                    Comment
                  </Label>
                  <Input
                    id="comment"
                    placeholder="Thanks for creating this group!"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={handleSendNutzap}
                  disabled={isProcessing || isSending || isFetching || !amount}
                >
                  {isProcessing || isSending ? "Sending..." : "Send eCash"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
