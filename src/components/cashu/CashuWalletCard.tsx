import { bytesToHex } from "@noble/hashes/utils";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useCashuWallet } from "@/hooks/useCashuWallet";
import { calculateBalance, formatBalance } from "@/lib/cashu";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash,
  Eraser,
} from "lucide-react";
import { useCashuStore } from "@/stores/cashuStore";
import { derivePrivkeyFromNostrSignature } from "@/lib/nip60";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useCashuToken } from "@/hooks/useCashuToken";

export function CashuWalletCard() {
  const { user } = useCurrentUser();
  const { wallet, isLoading, createWallet } = useCashuWallet();
  const cashuStore = useCashuStore();
  const { cleanSpentProofs } = useCashuToken();
  const [newMint, setNewMint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedMint, setExpandedMint] = useState<string | null>(null);

  // Calculate total balance across all mints
  const balances = calculateBalance(cashuStore.proofs);

  // Use useEffect to set active mint when wallet changes
  useEffect(() => {
    if (
      wallet &&
      wallet.mints &&
      wallet.mints.length > 0 &&
      !cashuStore.activeMintUrl
    ) {
      cashuStore.setActiveMintUrl(wallet.mints[0]);
    }
  }, [wallet, cashuStore]);

  const handleCreateWallet = async () => {
    if (!user) {
      setError("You must be logged in to create a wallet");
      return;
    }

    try {
      const privkey = await derivePrivkeyFromNostrSignature(
        user.signer,
        user.pubkey
      );
      cashuStore.setPrivkey(privkey);

      // Create a new wallet with the default mint
      createWallet({
        privkey,
        mints: cashuStore.mints.map((m) => m.url),
      });
    } catch (error) {
      console.error("Failed to derive private key:", error);
      setError("Failed to create wallet. Please try again.");
    }
  };

  const handleAddMint = () => {
    if (!wallet || !wallet.mints) return;

    try {
      // Validate URL
      new URL(newMint);

      // Add mint to wallet
      createWallet({
        ...wallet,
        mints: [...wallet.mints, newMint],
      });

      // Clear input
      setNewMint("");
      setError(null);
    } catch (e) {
      setError("Invalid mint URL");
    }
  };

  const handleRemoveMint = (mintUrl: string) => {
    if (!wallet || !wallet.mints) return;

    // Don't allow removing the last mint
    if (wallet.mints.length <= 1) {
      setError("Cannot remove the last mint");
      return;
    }

    // Remove mint from wallet
    createWallet({
      ...wallet,
      mints: wallet.mints.filter((m) => m !== mintUrl),
    });

    // If removing the active mint, set the first available mint as active
    if (cashuStore.activeMintUrl === mintUrl) {
      const remainingMints = wallet.mints.filter((m) => m !== mintUrl);
      if (remainingMints.length > 0) {
        cashuStore.setActiveMintUrl(remainingMints[0]);
      }
    }

    // Close expanded view if open
    if (expandedMint === mintUrl) {
      setExpandedMint(null);
    }
  };

  const handleCleanSpentProofs = async () => {
    if (!wallet || !wallet.mints) return;
    if (!cashuStore.activeMintUrl) return;
    const spentProofs = await cleanSpentProofs(cashuStore.activeMintUrl);
    console.log(spentProofs);
  };

  // Set active mint when clicking on a mint
  const handleSetActiveMint = (mintUrl: string) => {
    cashuStore.setActiveMintUrl(mintUrl);
  };

  const toggleExpandMint = (mintUrl: string) => {
    if (expandedMint === mintUrl) {
      setExpandedMint(null);
    } else {
      setExpandedMint(mintUrl);
    }
  };

  const cleanMintUrl = (mintUrl: string) => {
    return mintUrl.replace("https://", "");
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cashu Wallet</CardTitle>
          <CardDescription>Loading wallet...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!wallet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cashu Wallet</CardTitle>
          <CardDescription>You don't have a Cashu wallet yet</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleCreateWallet} disabled={!user}>
            Create Wallet
          </Button>
          {!user && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You need to log in to create a wallet
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cashu Wallet</CardTitle>
        <CardDescription>Manage your Cashu ecash</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Mints</h3>
            {wallet.mints && wallet.mints.length > 0 ? (
              <div className="mt-2 space-y-2">
                {wallet.mints.map((mint) => {
                  const amount = balances[mint] || 0;
                  const isActive = cashuStore.activeMintUrl === mint;
                  const isExpanded = expandedMint === mint;

                  return (
                    <div key={mint} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <button
                            className="text-sm hover:text-primary text-left truncate max-w-[160px]"
                            onClick={() => handleSetActiveMint(mint)}
                          >
                            {cleanMintUrl(mint)}
                          </button>
                          {isActive && (
                            <Badge
                              variant="secondary"
                              className="h-5 px-1.5 bg-green-100 text-green-700 hover:bg-green-200"
                            >
                              Active
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {formatBalance(amount)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => toggleExpandMint(mint)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="pl-4 flex justify-end gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCleanSpentProofs()}
                            className="border-muted-foreground/20 hover:bg-muted"
                          >
                            <Eraser className="h-4 w-4 mr-1 text-amber-500" />
                            Clean Spent
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveMint(mint)}
                            className="border-muted-foreground/20 hover:bg-destructive/10"
                          >
                            <Trash className="h-4 w-4 mr-1 text-destructive" />
                            Remove
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">
                No mints added yet
              </p>
            )}
          </div>

          <Separator />

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-end gap-2">
            <div className="grid w-full gap-1.5">
              <Label htmlFor="mint">Add Mint</Label>
              <Input
                id="mint"
                placeholder="https://mint.example.com"
                value={newMint}
                onChange={(e) => setNewMint(e.target.value)}
              />
            </div>
            <Button onClick={handleAddMint}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <p className="text-xs text-muted-foreground">NIP-60 Cashu Wallet</p>
      </CardFooter>
    </Card>
  );
}
