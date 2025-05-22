import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCashuHistory } from "@/hooks/useCashuHistory";
import {
  useTransactionHistoryStore,
  PendingTransaction,
} from "@/stores/transactionHistoryStore";
import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Clock, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCashuStore } from "@/stores/cashuStore";
import { mintTokensFromPaidInvoice } from "@/lib/cashuLightning";
import { useCashuWallet } from "@/hooks/useCashuWallet";
import { SpendingHistoryEntry } from "@/lib/cashu";

export function CashuHistoryCard() {
  const { history: queryHistory, isLoading, createHistory } = useCashuHistory();
  const transactionHistoryStore = useTransactionHistoryStore();
  const cashuStore = useCashuStore();
  const { updateProofs } = useCashuWallet();
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Get combined history from the store for display
  const history = transactionHistoryStore.getCombinedHistory();

  // Sync the query data with the store whenever it changes
  useEffect(() => {
    if (queryHistory && queryHistory.length > 0) {
      // The store will handle duplicates internally
      queryHistory.forEach((entry) => {
        transactionHistoryStore.addHistoryEntry(entry);
      });
    }
  }, [queryHistory, transactionHistoryStore]);

  const handleWithdraw = async (transaction: PendingTransaction) => {
    try {
      setProcessingId(transaction.id);

      // Make sure the correct mint is activated
      cashuStore.setActiveMintUrl(transaction.mintUrl);

      // Try to mint tokens from the paid invoice
      const amount = parseInt(transaction.amount);
      const proofs = await mintTokensFromPaidInvoice(
        transaction.mintUrl,
        transaction.quoteId,
        amount,
        1
      );

      if (proofs.length > 0) {
        // Update proofs
        await updateProofs({
          mintUrl: transaction.mintUrl,
          proofsToAdd: proofs,
          proofsToRemove: [],
        });

        // Get token event ID
        const tokenEventId = cashuStore.getProofEventId(proofs[0]);

        // Create history event if we got a token ID
        if (tokenEventId) {
          await createHistory({
            direction: "in",
            amount: transaction.amount,
            createdTokens: [tokenEventId],
          });
        }

        // Remove pending transaction
        transactionHistoryStore.removePendingTransaction(transaction.id);
      }
    } catch (error) {
      console.error("Error minting tokens:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const isPending = (
    entry: (SpendingHistoryEntry & { id: string }) | PendingTransaction
  ): entry is PendingTransaction => {
    return "status" in entry && entry.status === "pending";
  };

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
                    isPending(entry)
                      ? "bg-yellow-100 text-yellow-700"
                      : entry.direction === "in"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {isPending(entry) ? (
                    <Clock className="h-4 w-4" />
                  ) : entry.direction === "in" ? (
                    <ArrowDownLeft className="h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h4 className="font-medium">
                      {isPending(entry)
                        ? "Pending"
                        : entry.direction === "in"
                        ? "Received"
                        : "Sent"}
                    </h4>
                    <span
                      className={
                        isPending(entry)
                          ? "text-yellow-600"
                          : entry.direction === "in"
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
                  {!isPending(entry) &&
                    entry.redeemedTokens &&
                    entry.redeemedTokens.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Redeemed from nutzap
                      </p>
                    )}
                  {isPending(entry) && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleWithdraw(entry)}
                        disabled={processingId === entry.id}
                      >
                        {processingId === entry.id ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          "Check Payment"
                        )}
                      </Button>
                    </div>
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
