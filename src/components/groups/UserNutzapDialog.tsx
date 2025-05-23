import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthor } from "@/hooks/useAuthor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSendNutzap, useFetchNutzapInfo, useVerifyMintCompatibility } from "@/hooks/useSendNutzap";
import { useCashuWallet } from "@/hooks/useCashuWallet";
import { useCashuStore } from "@/stores/cashuStore";
import { useCashuToken } from "@/hooks/useCashuToken";
import { Proof } from "@cashu/cashu-ts";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useBitcoinPrice, satsToUSD, formatUSD } from "@/hooks/useBitcoinPrice";
import { useCurrencyDisplayStore } from "@/stores/currencyDisplayStore";
import { formatBalance } from "@/lib/cashu";

interface UserNutzapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pubkey: string;
}

export function UserNutzapDialog({ open, onOpenChange, pubkey }: UserNutzapDialogProps) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const { user } = useCurrentUser();
  const { wallet } = useCashuWallet();
  const cashuStore = useCashuStore();
  const { sendToken } = useCashuToken();
  const { sendNutzap, isSending } = useSendNutzap();
  const { fetchNutzapInfo, isFetching } = useFetchNutzapInfo();
  const { verifyMintCompatibility } = useVerifyMintCompatibility();
  const { showSats } = useCurrencyDisplayStore();
  const { data: btcPrice } = useBitcoinPrice();
  
  const displayName = metadata?.name || pubkey.slice(0, 8);
  const profileImage = metadata?.picture;

  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Create a unique event ID for the zap
  const eventId = `user-zap-${pubkey.slice(0, 8)}-${Date.now()}`;

  // Format amount based on user preference
  const formatAmount = (sats: number) => {
    if (showSats) {
      return formatBalance(sats);
    } else if (btcPrice) {
      return formatUSD(satsToUSD(sats, btcPrice.USD));
    }
    return formatBalance(sats);
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

      // Fetch recipient's nutzap info
      const recipientInfo = await fetchNutzapInfo(pubkey);

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

      // Send nutzap using recipient info
      await sendNutzap({
        recipientInfo,
        comment,
        proofs,
        mintUrl: compatibleMintUrl,
        eventId: eventId,
      });

      toast.success(`Successfully sent ${formatAmount(amountValue)} to ${displayName}`);
      setAmount("");
      setComment("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending nutzap:", error);
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-10 w-10 mb-2">
              <AvatarImage src={profileImage} />
              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <DialogTitle>
              Send eCash to {displayName}
            </DialogTitle>
            <DialogDescription className="text-center mt-1">
              Send eCash directly to this user to show your support.
            </DialogDescription>
          </div>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="user-amount" className="text-right">
              Amount {showSats ? "(sats)" : "(USD)"}
            </Label>
            <Input
              id="user-amount"
              type="number"
              placeholder={showSats ? "100" : "0.10"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="user-comment" className="text-right">
              Comment
            </Label>
            <Input
              id="user-comment"
              placeholder="Thanks for your contributions!"
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
            {isProcessing ? "Sending..." : "Send eCash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}