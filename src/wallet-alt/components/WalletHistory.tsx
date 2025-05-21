import { useWalletStore } from "../stores/walletStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function WalletHistory() {
  const { history, status } = useWalletStore();

  // Sort history by timestamp, newest first
  const sortedHistory = [...history].sort((a, b) => b.createdAt - a.createdAt);

  if (status.syncing && !status.initialized) {
    return (
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </CardContent>
    );
  }

  return (
    <CardContent>
      <ScrollArea className="h-[300px]">
        <div className="space-y-4">
          {sortedHistory.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex flex-col">
                <div className="font-medium">
                  {entry.direction === "in" ? "Received" : "Sent"}
                  {entry.description && `: ${entry.description}`}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDistanceToNow(entry.createdAt * 1000, { addSuffix: true })}
                </div>
              </div>
              <div className={entry.direction === "in" ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                {entry.direction === "in" ? "+" : "-"}
                {entry.amount.toLocaleString()} sats
              </div>
            </div>
          ))}
          {history.length === 0 && !status.syncing && (
            <div className="text-center text-muted-foreground p-4">
              No transaction history yet.
            </div>
          )}
           {status.error && (
              <div className="text-sm text-destructive mt-2 text-center">Error loading history: {status.error}</div>
           )}
        </div>
      </ScrollArea>
    </CardContent>
  );
}