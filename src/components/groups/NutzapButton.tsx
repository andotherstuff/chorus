import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DollarSign, Bitcoin } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { CASHU_EVENT_KINDS } from "@/lib/cashu";
import { formatBalance } from "@/lib/cashu";
import { useBitcoinPrice, satsToUSD, formatUSD } from "@/hooks/useBitcoinPrice";
import { useCurrencyDisplayStore } from "@/stores/currencyDisplayStore";
import { useCashuWallet } from "@/hooks/useCashuWallet";
import { useCashuStore } from "@/stores/cashuStore";

// Type augmentation for window object
declare global {
  interface Window {
    [key: `zapRefetch_${string}`]: () => void;
  }
}

interface NutzapButtonProps {
  postId: string;
  authorPubkey: string;
  relayHint?: string;
  showText?: boolean;
  onToggle?: (isOpen: boolean) => void;
  isOpen?: boolean;
  refetchZaps?: () => void;
}

export function NutzapButton({ postId, authorPubkey, relayHint, showText = true, onToggle, isOpen = false, refetchZaps }: NutzapButtonProps) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { wallet } = useCashuWallet();
  const cashuStore = useCashuStore();
  const { showSats } = useCurrencyDisplayStore();
  const { data: btcPrice } = useBitcoinPrice();

  // Query to get all nutzaps for this post
  const { data: nutzapData, refetch } = useQuery({
    queryKey: ["nutzap-total", postId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      const events = await nostr.query([{
        kinds: [CASHU_EVENT_KINDS.ZAP],
        "#e": [postId],
        limit: 50,
      }], { signal });

      let totalAmount = 0;
      let zapCount = 0;

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
          
          if (proofs.length > 0) {
            zapCount++;
          }
        } catch (error) {
          console.error("Error processing nutzap:", error);
        }
      }

      return { totalAmount, zapCount };
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

  const handleZapClick = () => {
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

    // Notify parent component if callback provided
    if (onToggle) {
      onToggle(!isOpen);
    }
  };

  const nutzapTotal = nutzapData?.totalAmount || 0;

  // Pass refetch to parent if needed
  if (refetchZaps && refetch) {
    // Store reference for parent to use
    window[`zapRefetch_${postId}`] = refetch;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-foreground flex items-center h-7 px-1.5"
      onClick={handleZapClick}
    >
      {showSats ? (
        <Bitcoin className={`h-3.5 w-3.5 ${nutzapTotal > 0 ? 'text-amber-500' : ''}`} />
      ) : (
        <DollarSign className={`h-3.5 w-3.5 ${nutzapTotal > 0 ? 'text-green-500' : ''}`} />
      )}
      {showText && nutzapTotal > 0 && <span className="text-xs ml-0.5">{formatAmount(nutzapTotal)}</span>}
    </Button>
  );
}
