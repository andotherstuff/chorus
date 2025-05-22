import { useState } from "react";
import { useNostr } from "@/hooks/useNostr";
import { useAuthor } from "@/hooks/useAuthor";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Zap, DollarSign } from "lucide-react";
import { CASHU_EVENT_KINDS } from "@/lib/cashu";
import { formatBalance } from "@/lib/cashu";
import { Proof } from "@cashu/cashu-ts";
import { useBitcoinPrice, satsToUSD, formatUSD } from "@/hooks/useBitcoinPrice";
import { useCurrencyDisplayStore } from "@/stores/currencyDisplayStore";

// Define Nutzap interface
interface Nutzap {
  id: string;
  pubkey: string;
  createdAt: number;
  content: string;
  proofs: any[];
  mintUrl: string;
  amount: number;
}

interface NutzapListProps {
  postId: string;
}

export function NutzapList({ postId }: NutzapListProps) {
  const { nostr } = useNostr();
  const [showAll, setShowAll] = useState(false);
  const { showSats } = useCurrencyDisplayStore();
  const { data: btcPrice } = useBitcoinPrice();

  // Query for nutzaps for this post
  const { data: nutzaps, isLoading } = useQuery({
    queryKey: ["nutzaps", postId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      const events = await nostr.query(
        [
          {
            kinds: [CASHU_EVENT_KINDS.ZAP],
            "#e": [postId],
            limit: 50,
          },
        ],
        { signal }
      );

      const processedNutzaps: Nutzap[] = [];

      for (const event of events) {
        try {
          // Get the mint URL from tags
          const mintTag = event.tags.find((tag) => tag[0] === "u");
          if (!mintTag) continue;
          const mintUrl = mintTag[1];

          // Get proofs from tags
          const proofTags = event.tags.filter((tag) => tag[0] === "proof");
          if (proofTags.length === 0) continue;

          const proofs = proofTags
            .map((tag) => {
              try {
                return JSON.parse(tag[1]);
              } catch (e) {
                console.error("Failed to parse proof:", e);
                return null;
              }
            })
            .filter(Boolean);

          if (proofs.length === 0) continue;

          // Calculate total amount
          const amount = proofs.reduce((sum, proof) => sum + proof.amount, 0);

          // Create nutzap object
          const nutzap: Nutzap = {
            id: event.id,
            pubkey: event.pubkey,
            createdAt: event.created_at,
            content: event.content,
            proofs,
            mintUrl,
            amount,
          };

          processedNutzaps.push(nutzap);
        } catch (error) {
          console.error("Error processing nutzap:", error);
        }
      }

      // Sort by most recent first
      return processedNutzaps.sort((a, b) => b.createdAt - a.createdAt);
    },
    enabled: !!nostr && !!postId,
  });

  if (isLoading) {
    return (
      <div className="mt-2">
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }

  if (!nutzaps || nutzaps.length === 0) {
    return null;
  }

  // Calculate total amount
  const totalAmount = nutzaps.reduce((sum, nutzap) => sum + nutzap.amount, 0);

  // Format amount based on user preference
  const formatAmount = (sats: number) => {
    if (showSats) {
      return formatBalance(sats);
    } else if (btcPrice) {
      return formatUSD(satsToUSD(sats, btcPrice.USD));
    }
    return formatBalance(sats);
  };

  // Limit to 3 nutzaps unless showAll is true
  const displayNutzaps = showAll ? nutzaps : nutzaps.slice(0, 3);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <DollarSign className="h-3 w-3 text-amber-500" />
        <span className="text-xs text-muted-foreground">
          {formatAmount(totalAmount)} from {nutzaps.length} {nutzaps.length === 1 ? 'person' : 'people'}
        </span>
      </div>

      <div className="space-y-1.5">
        {displayNutzaps.map((nutzap) => (
          <NutzapItem key={nutzap.id} nutzap={nutzap} formatAmount={formatAmount} />
        ))}
      </div>

      {nutzaps.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs mt-1 h-6 px-2"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Show less" : `Show ${nutzaps.length - 3} more`}
        </Button>
      )}
    </div>
  );
}

interface NutzapItemProps {
  nutzap: Nutzap;
  formatAmount: (sats: number) => string;
}

function NutzapItem({ nutzap, formatAmount }: NutzapItemProps) {
  const author = useAuthor(nutzap.pubkey);

  const metadata = author.data?.metadata;
  const displayName = metadata?.name || nutzap.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;

  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-5 w-5">
        <AvatarImage src={profileImage} alt={displayName} />
        <AvatarFallback>{displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium">{displayName}</span>
        <span className="text-xs text-muted-foreground">
          {formatAmount(nutzap.amount)}
        </span>
        {nutzap.content && (
          <span className="text-xs text-muted-foreground">
            - "{nutzap.content}"
          </span>
        )}
      </div>
    </div>
  );
}
