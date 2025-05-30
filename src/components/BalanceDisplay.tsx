import { useState, useEffect, useRef } from 'react';
import { Bitcoin, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCashuStore } from '@/stores/cashuStore';
import { useCurrencyDisplayStore } from '@/stores/currencyDisplayStore';
import { calculateBalance, formatBalance } from '@/lib/cashu';
import { useBitcoinPrice, satsToUSD, formatUSD } from '@/hooks/useBitcoinPrice';
import { useWalletUiStore } from '@/stores/walletUiStore';
import { cn } from '@/lib/utils';

export function BalanceDisplay() {
  const cashuStore = useCashuStore();
  const { showSats, toggleCurrency } = useCurrencyDisplayStore();
  const { data: btcPrice } = useBitcoinPrice();
  const walletUiStore = useWalletUiStore();
  const [isFlashing, setIsFlashing] = useState(false);
  const prevBalance = useRef<string>('');

  // Calculate total balance across all mints
  const balances = calculateBalance(cashuStore.proofs);
  const totalBalance = Object.values(balances).reduce((sum, balance) => sum + balance, 0);

  // Format balance based on currency preference
  const displayBalance = showSats 
    ? formatBalance(totalBalance)
    : btcPrice 
      ? formatUSD(satsToUSD(totalBalance, btcPrice.USD))
      : formatBalance(totalBalance);

  // Track balance changes for flash effect
  useEffect(() => {
    if (prevBalance.current && prevBalance.current !== displayBalance) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 300);
    }
    prevBalance.current = displayBalance;
  }, [displayBalance]);

  // Handle animation from nutzap receipt
  useEffect(() => {
    if (walletUiStore.balanceAnimation) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 300);
    }
  }, [walletUiStore.balanceAnimation]);

  // Don't show balance if user has no wallet
  if (cashuStore.mints.length === 0) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleCurrency}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 font-medium transition-all",
        isFlashing && "flash-update animate-pulse scale-110"
      )}
    >
      {showSats ? (
        <Bitcoin className="w-3.5 h-3.5 text-orange-500" />
      ) : (
        <DollarSign className="w-3.5 h-3.5 text-green-600" />
      )}
      <span className="tabular-nums">{displayBalance}</span>
    </Button>
  );
}