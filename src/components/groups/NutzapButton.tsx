import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { useSendNutzap, useFetchNutzapInfo } from "@/hooks/useSendNutzap";
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

interface NutzapButtonProps {
  postId: string;
  authorPubkey: string;
  relayHint?: string;
}

export function NutzapButton({ postId, authorPubkey, relayHint }: NutzapButtonProps) {
  const { user } = useCurrentUser();
  const { wallet } = useCashuWallet();
  const cashuStore = useCashuStore();
  const { sendToken } = useCashuToken();
  const { sendNutzap, isSending } = useSendNutzap();
  const { fetchNutzapInfo, isFetching } = useFetchNutzapInfo();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleOpenDialog = () => {
    if (!user) {
      toast.error("You must be logged in to send nutzaps");
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
    
    setIsDialogOpen(true);
  };

  const handleSendNutzap = async () => {
    if (!user || !wallet || !cashuStore.activeMintUrl) {
      return;
    }

    if (!amount || isNaN(parseInt(amount))) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      setIsProcessing(true);

      // Fetch recipient's nutzap info
      const recipientInfo = await fetchNutzapInfo(authorPubkey);

      // Generate token with the specified amount and get proofs for the nutzap
      const amountValue = parseInt(amount);

      // Send token using p2pk pubkey from recipient info
      const proofs = (await sendToken(
        cashuStore.activeMintUrl,
        amountValue,
        recipientInfo.p2pkPubkey
      )) as Proof[];

      // Send nutzap using recipient info
      await sendNutzap({
        recipientInfo,
        comment,
        proofs,
        mintUrl: cashuStore.activeMintUrl,
        eventId: postId,
        relayHint
      });

      toast.success(`Successfully sent ${amountValue} sats`);
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
        <Zap className="h-3.5 w-3.5 mr-1" />
        <span className="text-xs">Nutzap</span>
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Send Nutzap</DialogTitle>
            <DialogDescription>
              Send a Cashu token to the author of this post.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount (sats)
              </Label>
              <Input
                id="amount"
                type="number"
                placeholder="100"
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
              {isProcessing ? "Sending..." : "Send Nutzap"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}