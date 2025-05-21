import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCashuHistory } from "@/cashu/hooks/useCashuHistory";
import { useTransactionHistoryStore } from "@/stores/transactionHistoryStore";
import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useEffect } from "react";

export function CashuHistoryCard() {
  const { history: queryHistory, isLoading } = useCashuHistory();
  const transactionHistoryStore = useTransactionHistoryStore();

  // Get history from the store for display
  const history = transactionHistoryStore.getHistoryEntries();

  // Sync the query data with the store whenever it changes
  useEffect(() => {
    if (queryHistory && queryHistory.length > 0) {
      // The store will handle duplicates internally
      for (const entry of queryHistory) {
        transactionHistoryStore.addHistoryEntry(entry);
      }
    }
  }, [queryHistory, transactionHistoryStore]);

  if (isLoading && history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Loading history...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>Your Cashu transaction history</CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet</p>
        ) : (
          <div className="space-y-4">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-start gap-4">
                <div
                  className={`p-2 rounded-full ${
                    entry.direction === "in"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {entry.direction === "in" ? (
                    <ArrowDownLeft className="h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h4 className="font-medium">
                      {entry.direction === "in" ? "Received" : "Sent"}
                    </h4>
                    <span
                      className={
                        entry.direction === "in"
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      {entry.direction === "in" ? "+" : "-"}
                      {entry.amount} sats
                    </span>
                  </div>
                  {entry.timestamp && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(entry.timestamp * 1000), "PPpp")}
                    </p>
                  )}
                  {entry.redeemedTokens && entry.redeemedTokens.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Redeemed from nutzap
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
