import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Zap, DollarSign } from "lucide-react";
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
import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { CASHU_EVENT_KINDS } from "@/lib/cashu";
import { formatBalance } from "@/lib/cashu";
import { useBitcoinPrice, satsToUSD, formatUSD } from "@/hooks/useBitcoinPrice";
import { useCurrencyDisplayStore } from "@/stores/currencyDisplayStore";

interface NutzapButtonProps {
  postId: string;
  authorPubkey: string;
  relayHint?: string;
  showText?: boolean;
}

export function NutzapButton({ postId, authorPubkey, relayHint, showText = true }: NutzapButtonProps) {
  const { nostr } = useNostr();
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

  // Query to get all nutzaps for this post
  const { data: nutzapTotal } = useQuery({
    queryKey: ["nutzap-total", postId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      const events = await nostr.query([{
        kinds: [CASHU_EVENT_KINDS.ZAP],
        "#e": [postId],
        limit: 50,
      }], { signal });

      let totalAmount = 0;

      for (const event of events) {
        try {
          // Get proofs from tags
          const proofTags = event.tags.filter(tag => tag[0] === "proof");
          if (proofTags.length === 0) continue;

          const proofs = proofTags
            .map(tag => {
              try {
                return JSON.parse(tag[1]);
              } catch (e) {
                return null;
              }
            })
            .filter(Boolean);

          // Calculate amount and add to total
          for (const proof of proofs) {
            totalAmount += proof.amount;
          }
        } catch (error) {
          console.error("Error processing nutzap:", error);
        }
      }

      return totalAmount;
    },
    enabled: !!nostr && !!postId,
  });

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
      setAmount("");
      setComment("");
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error sending nutzap:", error);
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground flex items-center h-7 px-1.5"
        onClick={handleOpenDialog}
      >
        <DollarSign className={`h-3.5 w-3.5 ${nutzapTotal && nutzapTotal > 0 ? 'text-orange-500' : ''}`} />
        {nutzapTotal && nutzapTotal > 0 ? <span className="text-xs ml-0.5">{formatAmount(nutzapTotal)}</span> : null}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Send Cash</DialogTitle>
            <DialogDescription>
              Send Cash to the author of this post.
            </DialogDescription>
          </DialogHeader>
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
                placeholder="Thanks for the post!"
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
              {isProcessing ? "Sending..." : "Send Cash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
