import { useWalletStore } from "../stores/walletStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function WalletBalance() {
  const { tokens, status } = useWalletStore();
  
  // Calculate total balance from unspent tokens
  const balance = tokens
    .filter(t => !t.spent)
    .reduce((sum, t) => sum + t.token.proofs.reduce((s, p) => s + p.amount, 0), 0);

  if (status.syncing && !status.initialized) {
    return <Skeleton className="h-20 w-full" />;
  }

  return (
    <CardContent className="p-0">
      <div className="flex flex-col items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Total Balance</div>
        <div className="text-4xl font-bold">
          {balance.toLocaleString()} sats
        </div>
        {status.syncing && (
          <div className="text-sm text-muted-foreground mt-2">Syncing...</div>
        )}
        {status.error && (
           <div className="text-sm text-destructive mt-2">Error: {status.error}</div>
        )}
      </div>
    </CardContent>
  );
}