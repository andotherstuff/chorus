import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  QrCode,
  Zap,
} from "lucide-react";
import { useCashuWallet } from "@/hooks/useCashuWallet";
import { useCashuStore } from "@/stores/cashuStore";
import { useCashuHistory } from "@/hooks/useCashuHistory";
import {
  createLightningInvoice,
  mintTokensFromPaidInvoice,
  payMeltQuote,
  parseInvoiceAmount,
  createMeltQuote,
} from "@/lib/cashuLightning";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { MeltQuoteResponse, MintQuoteResponse, Proof } from "@cashu/cashu-ts";
import { CashuToken, formatBalance } from "@/lib/cashu";
import { NostrEvent } from "nostr-tools";
import QRCode from "react-qr-code";
import {
  useTransactionHistoryStore,
  PendingTransaction,
} from "@/stores/transactionHistoryStore";
import { v4 as uuidv4 } from "uuid";
import { useWalletUiStore } from "@/stores/walletUiStore";
import { QRScanner } from "@/components/QRScanner";

interface TokenEvent {
  id: string;
  token: CashuToken;
  createdAt: number;
}

export function CashuWalletLightningCard() {
  const { user } = useCurrentUser();
  const { wallet, isLoading, updateProofs, tokens = [] } = useCashuWallet();
  const { createHistory } = useCashuHistory();
  const cashuStore = useCashuStore();
  const transactionHistoryStore = useTransactionHistoryStore();
  const walletUiStore = useWalletUiStore();
  const isExpanded = walletUiStore.expandedCards.lightning;
  const [activeTab, setActiveTab] = useState("receive");

  const [receiveAmount, setReceiveAmount] = useState("");
  const [invoice, setInvoice] = useState("");
  const [currentMeltQuoteId, setcurrentMeltQuoteId] = useState("");
  const [paymentRequest, setPaymentRequest] = useState("");
  const [sendInvoice, setSendInvoice] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState<number | null>(null);
  const [invoiceFeeReserve, setInvoiceFeeReserve] = useState<number | null>(
    null
  );
  const [mintQuote, setMintQuote] = useState<MintQuoteResponse | null>(null);
  const [meltQuote, setMeltQuote] = useState<MeltQuoteResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [pendingTransactionId, setPendingTransactionId] = useState<
    string | null
  >(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const processingInvoiceRef = useRef<string | null>(null);

  // Handle receive tab
  const handleCreateInvoice = async () => {
    if (!cashuStore.activeMintUrl) {
      setError(
        "No active mint selected. Please select a mint in your wallet settings."
      );
      return;
    }

    if (!receiveAmount || isNaN(parseInt(receiveAmount))) {
      setError("Please enter a valid amount");
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      const amount = parseInt(receiveAmount);
      const invoiceData = await createLightningInvoice(
        cashuStore.activeMintUrl,
        amount
      );

      setInvoice(invoiceData.paymentRequest);
      setcurrentMeltQuoteId(invoiceData.quoteId);
      setPaymentRequest(invoiceData.paymentRequest);

      // Create pending transaction
      const pendingTxId = uuidv4();
      const pendingTransaction: PendingTransaction = {
        id: pendingTxId,
        direction: "in",
        amount: amount.toString(),
        timestamp: Math.floor(Date.now() / 1000),
        status: "pending",
        mintUrl: cashuStore.activeMintUrl,
        quoteId: invoiceData.quoteId,
        paymentRequest: invoiceData.paymentRequest,
      };

      // Store the pending transaction
      transactionHistoryStore.addPendingTransaction(pendingTransaction);
      setPendingTransactionId(pendingTxId);

      // Start polling for payment status
      checkPaymentStatus(
        cashuStore.activeMintUrl,
        invoiceData.quoteId,
        amount,
        pendingTxId
      );
    } catch (error) {
      console.error("Error creating invoice:", error);
      setError(
        "Failed to create Lightning invoice: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Poll for payment status
  const checkPaymentStatus = async (
    mintUrl: string,
    quoteId: string,
    amount: number,
    pendingTxId: string
  ) => {
    try {
      // Check if payment has been received
      const proofs = await mintTokensFromPaidInvoice(mintUrl, quoteId, amount);

      if (proofs.length > 0) {
        // update proofs
        await updateProofs({
          mintUrl,
          proofsToAdd: proofs,
          proofsToRemove: [],
        });

        // get token event
        const tokenEventId = cashuStore.getProofEventId(proofs[0]);

        // Create token in Nostr
        try {
          // Create history event if we got a token ID
          if (tokenEventId) {
            await createHistory({
              direction: "in",
              amount: amount.toString(),
              createdTokens: [tokenEventId],
            });
          }
        } catch (err) {
          console.error("Error creating token:", err);
        }

        // Remove the pending transaction
        transactionHistoryStore.removePendingTransaction(pendingTxId);
        setPendingTransactionId(null);

        setSuccess(`Received ${formatBalance(amount)}!`);
        setInvoice("");
        setcurrentMeltQuoteId("");
        setTimeout(() => setSuccess(null), 5000);
      } else {
        // If payment not received yet, check again in 5 seconds
        setTimeout(() => {
          if (currentMeltQuoteId === quoteId) {
            // Only continue if we're still waiting for this payment
            checkPaymentStatus(mintUrl, quoteId, amount, pendingTxId);
          }
        }, 5000);
      }
    } catch (error) {
      // If it's not a "not paid yet" error, show the error
      if (
        !(error instanceof Error && error.message.includes("not been paid"))
      ) {
        console.error("Error checking payment status:", error);
        setError(
          "Failed to check payment status: " +
            (error instanceof Error ? error.message : String(error))
        );
      } else {
        // Keep polling if it's just not paid yet
        setTimeout(() => {
          if (currentMeltQuoteId === quoteId) {
            // Only continue if we're still waiting for this payment
            checkPaymentStatus(mintUrl, quoteId, amount, pendingTxId);
          }
        }, 5000);
      }
    }
  };

  // Copy invoice to clipboard
  const copyInvoiceToClipboard = () => {
    navigator.clipboard.writeText(invoice);
    setSuccess("Invoice copied to clipboard");
    setTimeout(() => setSuccess(null), 3000);
  };

  // Handle send tab
  const handleInvoiceInput = async (value: string) => {
    if (!cashuStore.activeMintUrl) {
      setError(
        "No active mint selected. Please select a mint in your wallet settings."
      );
      return;
    }

    // Prevent duplicate processing of the same invoice
    if (processingInvoiceRef.current === value || currentMeltQuoteId) {
      return;
    }

    setSendInvoice(value);
    processingInvoiceRef.current = value;

    // Create melt quote
    const mintUrl = cashuStore.activeMintUrl;
    try {
      setIsLoadingInvoice(true);
      const meltQuote = await createMeltQuote(mintUrl, value);
      setcurrentMeltQuoteId(meltQuote.quote);
      console.log(meltQuote);

      // Parse amount from invoice
      setInvoiceAmount(meltQuote.amount);
      setInvoiceFeeReserve(meltQuote.fee_reserve);
    } catch (error) {
      console.error("Error creating melt quote:", error);
      setError(
        "Failed to create melt quote: " +
          (error instanceof Error ? error.message : String(error))
      );
      setcurrentMeltQuoteId(""); // Reset quote ID on error
      handleCancel();
    } finally {
      setIsLoadingInvoice(false);
      processingInvoiceRef.current = null;
    }
  };

  // Start QR scanner
  const startQrScanner = () => {
    setIsScannerOpen(true);
  };

  // Handle QR scan result
  const handleQRScan = async (data: string) => {
    // Check if it's a Lightning invoice (starts with 'lightning:' or 'lnbc')
    let cleanedData = data.replace(/^lightning:/i, "");

    // Basic validation for Lightning invoice format
    if (
      cleanedData.toLowerCase().startsWith("lnbc") ||
      cleanedData.toLowerCase().startsWith("lntb") ||
      cleanedData.toLowerCase().startsWith("lnbcrt")
    ) {
      cleanedData = cleanedData.toLowerCase();

      // Check if we're already processing this invoice
      if (sendInvoice === cleanedData || isLoadingInvoice) {
        return; // Prevent duplicate processing
      }

      await handleInvoiceInput(cleanedData);
      setIsScannerOpen(false);
    } else {
      setError(
        "Invalid Lightning invoice. Please scan a valid Lightning invoice QR code."
      );
      setTimeout(() => setError(null), 3000);
    }
  };

  // Pay Lightning invoice
  const handlePayInvoice = async () => {
    if (!sendInvoice) {
      setError("Please enter a Lightning invoice");
      return;
    }

    if (error && sendInvoice) {
      await handleInvoiceInput(sendInvoice);
    }

    if (!cashuStore.activeMintUrl) {
      setError(
        "No active mint selected. Please select a mint in your wallet settings."
      );
      return;
    }

    if (!invoiceAmount) {
      setError("Could not parse invoice amount");
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // Get active mint
      const mintUrl = cashuStore.activeMintUrl;

      // Select proofs to spend
      const selectedProofs = await cashuStore.getMintProofs(mintUrl);
      const totalProofsAmount = selectedProofs.reduce(
        (sum, p) => sum + p.amount,
        0
      );

      if (totalProofsAmount < invoiceAmount + (invoiceFeeReserve || 0)) {
        setError(
          `Insufficient balance: have ${formatBalance(
            totalProofsAmount
          )}, need ${formatBalance(invoiceAmount + (invoiceFeeReserve || 0))}`
        );
        setIsProcessing(false);
        return;
      }

      // Pay the invoice
      const result = await payMeltQuote(
        mintUrl,
        currentMeltQuoteId,
        selectedProofs
      );

      if (result.success) {
        // Store the ids of proofs that were spent
        const spentProofIds = selectedProofs
          .map((p) => p.id || "")
          .filter((id) => !!id);

        // Remove spent proofs from the store
        await updateProofs({
          mintUrl,
          proofsToAdd: [...result.keep, ...result.change],
          proofsToRemove: selectedProofs,
        });

        // Create history event
        await createHistory({
          direction: "out",
          amount: invoiceAmount.toString(),
        });

        setSuccess(`Paid ${formatBalance(invoiceAmount)}!`);
        setSendInvoice("");
        setInvoiceAmount(null);
        setInvoiceFeeReserve(null);
        setcurrentMeltQuoteId("");
        processingInvoiceRef.current = null;
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (error) {
      console.error("Error paying invoice:", error);
      setError(
        "Failed to pay Lightning invoice: " +
          (error instanceof Error ? error.message : String(error))
      );
      setcurrentMeltQuoteId(""); // Reset quote ID on error
    } finally {
      setIsProcessing(false);
    }
  };

  // If the component unmounts or the user cancels, make sure we don't remove the pending transaction
  const handleCancel = () => {
    setInvoice("");
    setcurrentMeltQuoteId("");
    setSendInvoice("");
    setInvoiceAmount(null);
    setInvoiceFeeReserve(null);
    processingInvoiceRef.current = null;
    // Don't remove the pending transaction, leave it in the history
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lightning</CardTitle>
          <CardDescription>Loading wallet...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!wallet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lightning</CardTitle>
          <CardDescription>Create a wallet to use Lightning</CardDescription>
        </CardHeader>
        <CardContent>
          {!user && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You need to log in to use Lightning
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Lightning</CardTitle>
          <CardDescription>Withdraw or deposit Bitcoin</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => walletUiStore.toggleCardExpansion("lightning")}
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="receive">
                <ArrowDownLeft className="h-4 w-4 mr-2" />
                Receive
              </TabsTrigger>
              <TabsTrigger value="send">
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Send
              </TabsTrigger>
            </TabsList>

            <TabsContent value="receive" className="space-y-4">
              {!invoice ? (
                // Show form to create invoice
                <>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (sats)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="100"
                      value={receiveAmount}
                      onChange={(e) => setReceiveAmount(e.target.value)}
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleCreateInvoice}
                    disabled={
                      isProcessing ||
                      !cashuStore.activeMintUrl ||
                      !receiveAmount
                    }
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {isProcessing
                      ? "Creating Invoice..."
                      : "Create Lightning Invoice"}
                  </Button>
                </>
              ) : (
                // Show generated invoice
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-md flex items-center justify-center">
                    <div className="border border-border w-48 h-48 flex items-center justify-center bg-white p-2 rounded-md">
                      <QRCode value={invoice} size={180} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Lightning Invoice</Label>
                    <div className="relative">
                      <Input
                        readOnly
                        value={invoice}
                        className="pr-10 font-mono text-xs break-all"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0"
                        onClick={copyInvoiceToClipboard}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Waiting for payment...
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="send" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Invoice</Label>
                <div className="relative">
                  <Input
                    id="invoice"
                    placeholder="Lightning invoice"
                    value={sendInvoice}
                    onChange={(e) => handleInvoiceInput(e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0"
                    onClick={startQrScanner}
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {invoiceAmount && (
                <div className="rounded-md border p-4">
                  <p className="text-sm font-medium">Invoice Amount</p>
                  <p className="text-2xl font-bold">
                    {formatBalance(invoiceAmount)}
                    {invoiceFeeReserve && (
                      <>
                        <span className="text-xs font-bold pl-2 text-muted-foreground">
                          + max {formatBalance(invoiceFeeReserve)} fee
                        </span>
                      </>
                    )}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSendInvoice("");
                    setInvoiceAmount(null);
                    setInvoiceFeeReserve(null);
                    setcurrentMeltQuoteId("");
                    processingInvoiceRef.current = null;
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handlePayInvoice}
                  disabled={
                    isProcessing ||
                    isLoadingInvoice ||
                    !sendInvoice ||
                    !invoiceAmount
                  }
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : isLoadingInvoice ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Pay Invoice"
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mt-4">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      )}

      {/* QR Code Scanner Modal */}
      <QRScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleQRScan}
        title="Scan Lightning Invoice"
        description="Position the Lightning invoice QR code within the frame"
      />
    </Card>
  );
}
