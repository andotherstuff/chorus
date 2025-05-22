import { useGroupNutzaps } from "@/hooks/useGroupNutzaps";
import { useAuthor } from "@/hooks/useAuthor";
import { formatBalance } from "@/lib/cashu";
import { useBitcoinPrice, satsToUSD, formatUSD } from "@/hooks/useBitcoinPrice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useCurrencyDisplayStore } from "@/stores/currencyDisplayStore";

interface GroupNutzapListProps {
  groupId: string;
}

export function GroupNutzapList({ groupId }: GroupNutzapListProps) {
  const { data: nutzaps, isLoading, error } = useGroupNutzaps(groupId);
  const { data: btcPrice } = useBitcoinPrice();
  const { showSats, toggleCurrency } = useCurrencyDisplayStore();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
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
        <CardContent className="pt-6 text-center text-muted-foreground">
          No eCash for this group yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-right">
        <button
          onClick={() => toggleCurrency()}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Show in {showSats ? 'USD' : 'sats'}
        </button>
      </div>
      {nutzaps.map((event) => (
        <NutzapItem key={event.id} event={event} btcPrice={btcPrice?.USD} showSats={showSats} />
      ))}
    </div>
  );
}

function NutzapItem({ event, btcPrice, showSats }: { event: any; btcPrice?: number; showSats: boolean }) {
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
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Link to={`/profile/${event.pubkey}`} className="flex items-center gap-2 hover:underline">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profileImage} />
              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{displayName}</div>
              <div className="text-xs text-muted-foreground">{formattedDate}</div>
            </div>
          </Link>
          <div className="flex items-center text-amber-500">
            <DollarSign className="h-4 w-4 mr-1" />
            <span className={`font-medium tabular-nums ${isFlashing ? 'flash-update' : ''}`}>
              {currentValue}
            </span>
          </div>
        </div>
      </CardHeader>
      {event.content && (
        <CardContent>
          <p className="text-sm">{event.content}</p>
        </CardContent>
      )}
    </Card>
  );
}