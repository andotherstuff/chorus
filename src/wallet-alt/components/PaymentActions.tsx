import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import QRCodeSVG from "react-qr-code";
import { Loader2, Zap, SendHorizontal, QrCode } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { useCashuMint } from "../hooks/useCashuMint";
import { useNip60Wallet } from "../lib/nip60";
import { useWalletStore } from "../stores/walletStore";

export function PaymentActions() {
  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [sendAmount, setSendAmount] = useState("");
  const [receiveAmount, setReceiveAmount] = useState("");
  const [tokenUrl, setTokenUrl] = useState("");
  const [sendInvoice, setSendInvoice] = useState("");
  const [receiveInvoice, setReceiveInvoice] = useState("");
  const [receiveQuote, setReceiveQuote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();

  const { info, tokens } = useWalletStore();
  const { getMintClient, meltTokens, mintTokens, splitTokens, verifyToken } = useCashuMint();
  const { publishTokenEvent, publishHistoryEvent, fetchWalletData } = useNip60Wallet();

  const resetForm = () => {
    setSendAmount("");
    setReceiveAmount("");
    setTokenUrl("");
    setSendInvoice("");
    setReceiveInvoice("");
    setReceiveQuote("");
    setError(undefined);
    setSuccessMessage(undefined);
  };

  const handleSendToken = async () => {
    setIsProcessing(true);
    setError(undefined);
    setSuccessMessage(undefined);
    try {
      const amount = parseInt(sendAmount);
      if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount");

      if (!info?.defaultMint) throw new Error("Default mint not configured.");
      const mint = await getMintClient(info.defaultMint);

      // Find unspent tokens with enough balance from the default mint
      const mintTokens = tokens.filter(t => !t.spent && t.token.mint === info.defaultMint);
      const proofs = mintTokens.flatMap(t => t.token.proofs);

      const totalUnspent = proofs.reduce((sum, p) => sum + p.amount, 0);
      if (totalUnspent < amount) throw new Error("Insufficient funds from default mint.");

      // Split tokens
      const { send, keep } = await splitTokens(mint, proofs, amount);

      // Create and publish new token event for the recipient
      const newTokenEventContent = { mint: info.defaultMint, proofs: send };
      const relatedSpentTokenIds = mintTokens.map(t => t.id); // Mark input tokens as spent

      const publishedTokenEvent = await publishTokenEvent(newTokenEventContent, relatedSpentTokenIds);

      // Create and publish history event (Out)
      await publishHistoryEvent({
        direction: "out",
        amount,
        description: `Sent ${amount} sats`,
        relatedEvents: [publishedTokenEvent.id, ...relatedSpentTokenIds],
      });

      // The recipient needs the token data, not the Nostr event
      // We can encode the tokenEntry content in a cashu:// URL
      const tokenUrl = `cashu://${btoa(JSON.stringify(newTokenEventContent))}`;
      setTokenUrl(tokenUrl);
      setSuccessMessage("Token generated. Share the QR code or URL with the recipient.");

       // Re-fetch wallet data to update spent status locally
      await fetchWalletData();

    } catch (e: any) {
      console.error("Send token failed:", e);
      setError(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReceiveToken = async () => {
    setIsProcessing(true);
    setError(undefined);
    setSuccessMessage(undefined);
    try {
      if (!tokenUrl) throw new Error("Token URL is required.");

       // Decode and validate the token URL
       let tokenEntry;
       try {
         const tokenDataBase64 = tokenUrl.replace("cashu://", "");
         const tokenDataJson = atob(tokenDataBase64);
         tokenEntry = JSON.parse(tokenDataJson);
         if (!tokenEntry.mint || !Array.isArray(tokenEntry.proofs) || tokenEntry.proofs.length === 0) {
           throw new Error("Invalid token data format.");
         }
       } catch (e) {
         throw new Error("Invalid Cashu token URL.");
       }

      if (!tokenEntry.mint) throw new Error("Token is missing mint information.");
      const mint = await getMintClient(tokenEntry.mint);

       // Verify each proof in the token
      for(const proof of tokenEntry.proofs) {
         const isValid = await verifyToken(mint, proof);
         if (!isValid) {
            throw new Error("Token contains invalid proofs.");
         }
      }

      // Check if any of these proofs are already spent based on our local history
      const incomingProofSecrets = new Set(tokenEntry.proofs.map((p: any) => p.secret));
      const alreadySpentTokens = tokens.filter(t => t.token.mint === tokenEntry.mint && t.token.proofs.some((p: any) => incomingProofSecrets.has(p.secret) && t.spent));
      
      if (alreadySpentTokens.length > 0) {
         // Find the history event that spent the first already spent token found
         const spentById = alreadySpentTokens[0].spentBy;
         const historyEntry = spentById ? history.find(h => h.id === spentById) : undefined;
         const spentTime = historyEntry ? new Date(historyEntry.createdAt * 1000).toLocaleString() : 'an unknown time';
         const spentDesc = historyEntry?.description ? ` (${historyEntry.description})` : '';

         throw new Error(`This token or part of it has already been spent${spentById ? ` in transaction ${spentById.slice(0, 6)}... at ${spentTime}${spentDesc}.` : '.'}`);
      }


      // Add the new token event to our wallet store (as unspent)
       const publishedTokenEvent = await publishTokenEvent(tokenEntry);

      // Calculate received amount
      const receivedAmount = tokenEntry.proofs.reduce((sum: number, p: any) => sum + p.amount, 0);

      // Create and publish history event (In)
      await publishHistoryEvent({
        direction: "in",
        amount: receivedAmount,
        description: "Received token",
        relatedEvents: [publishedTokenEvent.id],
      });

      setSuccessMessage(`Successfully received ${receivedAmount} sats!`);
      resetForm();

      // Re-fetch wallet data to update spent status locally (might be needed if we receive a token that spends one of ours)
      await fetchWalletData();

    } catch (e: any) {
      console.error("Receive token failed:", e);
      setError(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendLightning = async () => {
     setIsProcessing(true);
     setError(undefined);
     setSuccessMessage(undefined);
    try {
       if (!sendInvoice) throw new Error("Lightning invoice is required.");

       if (!info?.defaultMint) throw new Error("Default mint not configured.");
       const mint = await getMintClient(info.defaultMint);

      // Find unspent tokens with enough balance from the default mint
      const mintTokens = tokens.filter(t => !t.spent && t.token.mint === info.defaultMint);
      const proofs = mintTokens.flatMap(t => t.token.proofs);

       // Melt tokens to pay the invoice
       // The meltTokens function should handle selecting sufficient proofs
       const { preimage, amount: paidAmount, tokenEventIds } = await meltTokens(mint, proofs, sendInvoice);

       // Create and publish history event (Out)
      await publishHistoryEvent({
        direction: "out",
        amount: paidAmount,
        description: `Paid invoice ${sendInvoice.slice(0, 10)}...`,
        relatedEvents: tokenEventIds, // IDs of the token events that were melted
      });

       setSuccessMessage(`Successfully paid invoice for ${paidAmount} sats!`);
       resetForm();

       // Re-fetch wallet data to update spent status locally
      await fetchWalletData();

    } catch (e: any) {
      console.error("Send lightning failed:", e);
      setError(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReceiveLightning = async () => {
     setIsProcessing(true);
     setError(undefined);
     setSuccessMessage(undefined);
    try {
       const amount = parseInt(receiveAmount);
       if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount");

       if (!info?.defaultMint) throw new Error("Default mint not configured.");
       const mint = await getMintClient(info.defaultMint);

       // Request a mint quote (Lightning invoice) from the mint
       const { quote, request, paid } = await mintTokens(mint, amount);
       setReceiveInvoice(request); // This is the bolt11 invoice
       setReceiveQuote(quote); // Store the quote ID to check payment status later

       setSuccessMessage("Invoice generated. Awaiting payment...");
       // In a real app, you would poll the mint or listen for webhooks to check payment status
       // and then call mintTokens with the quote and proofs once paid.

    } catch (e: any) {
      console.error("Receive lightning failed:", e);
      setError(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // TODO: Implement a mechanism to check lightning invoice status and call mintTokens when paid.
  // This might involve polling useCashuMint().checkPaymentStatus(mint, quoteId) or using websockets.

  return (
    <CardContent>
      <Tabs defaultValue="token" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="token">
            <SendHorizontal className="w-4 h-4 mr-2" />
            Token
          </TabsTrigger>
          <TabsTrigger value="lightning">
            <Zap className="w-4 h-4 mr-2" />
            Lightning
          </TabsTrigger>
        </TabsList>

        <TabsContent value="token" className="p-2">
          <div className="flex flex-col gap-4">
            <Label htmlFor="send-token-amount">Amount (sats)</Label>
            <Input
              id="send-token-amount"
              type="number"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              placeholder="Amount in sats"
            />

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {successMessage && (
               <Alert variant="default">
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}

            {tokenUrl && (
              <div className="flex flex-col items-center gap-4 p-4 border rounded-md bg-muted/50">
                <p className="text-sm font-medium">Share this token:</p>
                 <QRCodeSVG value={tokenUrl} size={200} />
                <Input value={tokenUrl} readOnly className="text-center" />
                 <Button 
                    onClick={() => navigator.clipboard.writeText(tokenUrl)}
                    size="sm"
                 >Copy Token URL</Button>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button onClick={handleSendToken} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Token
                </>
              ) : (
                'Generate Token'
              )}
            </Button>
          </DialogFooter>
        </TabsContent>

        <TabsContent value="lightning" className="p-2">
           <div className="flex flex-col gap-4">
              <Label htmlFor="send-invoice">Lightning Invoice</Label>
              <Input
                id="send-invoice"
                value={sendInvoice}
                onChange={(e) => setSendInvoice(e.target.value)}
                placeholder="paste invoice here"
              />

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {successMessage && (
               <Alert variant="default">
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}

           </div>
           <DialogFooter className="mt-4">
               <Button onClick={handleSendLightning} disabled={isProcessing || !sendInvoice}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Paying Invoice
                  </>
                ) : (
                  'Pay Invoice'
                )}
              </Button>
           </DialogFooter>
        </TabsContent>
      </Tabs>

       {/* Receive Dialog */}
      <Dialog open={showReceive} onOpenChange={setShowReceive}>
        <DialogTrigger asChild>
          <Button variant="outline" className="flex-1" onClick={resetForm}>Receive</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Receive Payment</DialogTitle>
            <DialogDescription>
              Receive via token or Lightning Network
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="token" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="token">
                <QrCode className="w-4 h-4 mr-2" />
                Token
              </TabsTrigger>
              <TabsTrigger value="lightning">
                <Zap className="w-4 h-4 mr-2" />
                Lightning
              </TabsTrigger>
            </TabsList>

            <TabsContent value="token" className="p-2">
              <div className="grid gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="receive-token">Cashu Token URL</Label>
                  <Input
                    id="receive-token"
                    className="col-span-3"
                    value={tokenUrl}
                    onChange={(e) => setTokenUrl(e.target.value)}
                    placeholder="Paste token URL"
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {successMessage && (
                 <Alert variant="default">
                  <AlertDescription>{successMessage}</AlertDescription>
                </Alert>
              )}
              </div>
              <DialogFooter>
                <Button onClick={handleReceiveToken} disabled={isProcessing || !tokenUrl}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Receiving Token
                    </>
                  ) : (
                    'Receive Token'
                  )}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="lightning" className="p-2">
              <div className="grid gap-4 py-4">
                 <div className="flex flex-col gap-2">
                    <Label htmlFor="receive-amount">Amount (sats)</Label>
                    <Input
                      id="receive-amount"
                      type="number"
                      className="col-span-3"
                      value={receiveAmount}
                      onChange={(e) => setReceiveAmount(e.target.value)}
                      placeholder="Amount in sats"
                    />
                  </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                 {successMessage && (
                   <Alert variant="default">
                    <AlertDescription>{successMessage}</AlertDescription>
                  </Alert>
                )}

                {receiveInvoice && (
                  <div className="flex flex-col items-center gap-4 p-4 border rounded-md bg-muted/50">
                     <p className="text-sm font-medium">Scan this invoice:</p>
                    <QRCodeSVG value={receiveInvoice} size={200} />
                    <Input value={receiveInvoice} readOnly className="text-center" />
                      <Button 
                        onClick={() => navigator.clipboard.writeText(receiveInvoice)}
                        size="sm"
                     >Copy Invoice</Button>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button onClick={handleReceiveLightning} disabled={isProcessing || !receiveAmount}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Invoice
                    </>
                  ) : (
                    'Generate Invoice'
                  )}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </CardContent>
  );
}