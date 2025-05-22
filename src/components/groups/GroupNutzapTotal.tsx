import { useGroupNutzapTotal } from "@/hooks/useGroupNutzaps";
import { useBitcoinPrice, satsToUSD, formatUSD } from "@/hooks/useBitcoinPrice";
import { formatBalance } from "@/lib/cashu";
import { Zap, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useRef } from "react";

interface GroupNutzapTotalProps {
  groupId: string;
  className?: string;
}

export function GroupNutzapTotal({ groupId, className = "" }: GroupNutzapTotalProps) {
  const { total, isLoading: isLoadingTotal } = useGroupNutzapTotal(groupId);
  const { data: btcPrice, isLoading: isLoadingPrice } = useBitcoinPrice();
  const [showSats, setShowSats] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const prevValueRef = useRef<string>("");

  const usdAmount = btcPrice ? satsToUSD(total, btcPrice.USD) : 0;
  const currentValue = showSats ? formatBalance(total) : formatUSD(usdAmount);

  useEffect(() => {
    if (prevValueRef.current && prevValueRef.current !== currentValue && !showSats) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 300);
      return () => clearTimeout(timer);
    }
    prevValueRef.current = currentValue;
  }, [currentValue, showSats]);

  if (isLoadingTotal || (isLoadingPrice && !btcPrice)) {
    return <Skeleton className={`h-6 w-24 ${className}`} />;
  }

  if (total === 0) {
    return null; // Don't show anything if there are no nutzaps
  }

  return (
    <button
      onClick={() => setShowSats(!showSats)}
      className={`flex items-center text-amber-500 hover:text-amber-600 transition-colors cursor-pointer ${className}`}
      title="Click to toggle between USD and sats"
    >
      <DollarSign className="h-4 w-4 mr-1" />
      <span className={`tabular-nums ${isFlashing ? 'flash-update' : ''}`}>
        {currentValue}
      </span>
    </button>
  );
}