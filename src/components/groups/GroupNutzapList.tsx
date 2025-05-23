import { useGroupNutzaps } from "@/hooks/useGroupNutzaps";
import { useAuthor } from "@/hooks/useAuthor";
import { formatBalance } from "@/lib/cashu";
import { useBitcoinPrice, satsToUSD, formatUSD } from "@/hooks/useBitcoinPrice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, DollarSign, Bitcoin, ArrowLeftRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useCurrencyDisplayStore } from "@/stores/currencyDisplayStore";
import { NostrEvent } from "@nostrify/nostrify";

interface GroupNutzapListProps {
  groupId: string;
}

export function GroupNutzapList({ groupId }: GroupNutzapListProps) {
  const { data: nutzaps, isLoading, error } = useGroupNutzaps(groupId);
  const { data: btcPrice } = useBitcoinPrice();
  const { showSats, toggleCurrency } = useCurrencyDisplayStore();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">Error loading nutzaps: {String(error)}</div>;
  }

  if (!nutzaps || nutzaps.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm">No eCash sent to this group yet.</p>
          <p className="text-xs mt-1">Be the first to support!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-right">
        <button
          onClick={() => toggleCurrency()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
        >
          {showSats ? (
            <>
              <DollarSign className="h-3.5 w-3.5" />
              <span>Show in USD</span>
              <ArrowLeftRight className="h-3 w-3" />
            </>
          ) : (
            <>
              <Bitcoin className="h-3.5 w-3.5" />
              <span>Show in sats</span>
              <ArrowLeftRight className="h-3 w-3" />
            </>
          )}
        </button>
      </div>
      <div className="space-y-2">
        {nutzaps.map((event) => (
          <NutzapItem key={event.id} event={event} btcPrice={btcPrice?.USD} showSats={showSats} />
        ))}
      </div>
    </div>
  );
}

function NutzapItem({ event, btcPrice, showSats }: { event: NostrEvent; btcPrice?: number; showSats: boolean }) {
  const author = useAuthor(event.pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || event.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  const [isFlashing, setIsFlashing] = useState(false);
  const prevValueRef = useRef<string>("");

  // Extract amount from proofs
  let totalAmount = 0;
  for (const tag of event.tags) {
    if (tag[0] === 'proof') {
      try {
        const proof = JSON.parse(tag[1]);
        totalAmount += proof.amount || 0;
      } catch (e) {
        console.error('Error parsing proof:', e);
      }
    }
  }

  // Format date
  const date = new Date(event.created_at * 1000);
  const formattedDate = date.toLocaleString();

  const usdAmount = btcPrice ? satsToUSD(totalAmount, btcPrice) : 0;
  const currentValue = showSats ? formatBalance(totalAmount) : formatUSD(usdAmount);

  useEffect(() => {
    if (prevValueRef.current && prevValueRef.current !== currentValue && !showSats) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 300);
      return () => clearTimeout(timer);
    }
    prevValueRef.current = currentValue;
  }, [currentValue, showSats]);

  return (
    <Card className="hover:bg-accent/50 transition-colors">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <Link to={`/profile/${event.pubkey}`} className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity">
            <Avatar className="h-9 w-9 flex-shrink-0">
              <AvatarImage src={profileImage} />
              <AvatarFallback className="text-xs">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{displayName}</div>
              <div className="text-xs text-muted-foreground">{formattedDate}</div>
            </div>
          </Link>
          <div className="flex items-center flex-shrink-0">
            {showSats ? (
              <Bitcoin className="h-4 w-4 mr-1 text-amber-500" />
            ) : (
              <DollarSign className="h-4 w-4 mr-1 text-green-500" />
            )}
            <span className={`font-semibold tabular-nums text-sm ${isFlashing ? 'flash-update' : ''}`}>
              {currentValue}
            </span>
          </div>
        </div>
        {event.content && (
          <div className="mt-2 pl-12">
            <p className="text-sm text-muted-foreground line-clamp-2">{event.content}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}