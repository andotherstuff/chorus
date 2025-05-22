import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, Loader2 } from "lucide-react";
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
  const { fetchNutzapInfo, isFetching } = useFetchNutzapInfo();
  const { verifyMintCompatibility } = useVerifyMintCompatibility();
  const { showSats } = useCurrencyDisplayStore();
  const { data: btcPrice } = useBitcoinPrice();
  
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

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
      {/* Zap Form */}
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
                <DollarSign className="mr-1 h-3 w-3" />
                Send eCash
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Zap List */}
      <NutzapList postId={postId} />
    </div>
  );
}