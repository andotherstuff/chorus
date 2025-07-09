// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import React, { useRef, useState } from "react";
import { Shield, Upload } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx";
import { useLoginActions } from "@/hooks/useLoginActions";
import { useProfileSync } from "@/hooks/useProfileSync";
import { NostrAvatar } from "../NostrAvatar";

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  expectedPubkey?: string; // Optional expected pubkey for specific login flows
  title?: string; // Optional title for the dialog
  description?: string; // Optional description for the dialog
}

const LoginDialog: React.FC<LoginDialogProps> = ({
  isOpen,
  onClose,
  onLogin,
  expectedPubkey,
  title,
  description,
}) => {
  // Fetch profile data for the expected pubkey
  const [isLoading, setIsLoading] = useState(false);
  const [nsec, setNsec] = useState("");
  const [bunkerUri, setBunkerUri] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const login = useLoginActions();
  const { syncProfile } = useProfileSync();

  const handleExtensionLogin = async () => {
    setIsLoading(true);
    try {
      if (!("nostr" in window)) {
        throw new Error(
          "Nostr extension not found. Please install a NIP-07 extension."
        );
      }
      const loginInfo = await login.extension();

      // Sync profile after successful login
      await syncProfile(loginInfo.pubkey);

      onLogin();
      onClose();
    } catch (error) {
      console.error("Extension login failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyLogin = async () => {
    if (!nsec.trim()) return;
    setIsLoading(true);

    try {
      const loginInfo = login.nsec(nsec);

      // Sync profile after successful login
      await syncProfile(loginInfo.pubkey);

      onLogin();
      onClose();
    } catch (error) {
      console.error("Nsec login failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBunkerLogin = async () => {
    if (!bunkerUri.trim() || !bunkerUri.startsWith("bunker://")) return;
    setIsLoading(true);

    try {
      const loginInfo = await login.bunker(bunkerUri);

      // Sync profile after successful login
      await syncProfile(loginInfo.pubkey);

      onLogin();
      onClose();
    } catch (error) {
      console.error("Bunker login failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setNsec(content.trim());
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-0 relative">
          <DialogTitle className="text-xl font-semibold text-center">
            {title || "Log in"}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground mt-2">
            {description || "Access your account securely with Nostr"}
            {expectedPubkey && (
              <NostrAvatar
                pubkey={expectedPubkey || ""}
                size={64}
                includeName
              />
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-8 space-y-6">
          <Tabs
            defaultValue={"nostr" in window ? "extension" : "key"}
            className="w-full"
          >
            <TabsList className="grid grid-cols-3 mb-6">
              <TabsTrigger value="extension">Extension</TabsTrigger>
              <TabsTrigger value="key">Nsec</TabsTrigger>
              <TabsTrigger value="bunker">Bunker</TabsTrigger>
            </TabsList>

            <TabsContent value="extension" className="space-y-4">
              <div className="text-center p-4 rounded-lg bg-muted">
                <Shield className="w-12 h-12 mx-auto mb-3 text-primary" />
                <div className="text-sm text-muted-foreground mb-4">
                  Login with one click using the browser extension
                </div>
                <Button
                  className="w-full rounded-full py-6"
                  onClick={handleExtensionLogin}
                  disabled={isLoading}
                >
                  {isLoading ? "Logging in..." : "Login with Extension"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="key" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="nsec"
                    className="text-sm font-medium text-foreground"
                  >
                    Enter your nsec
                  </label>
                  <Input
                    id="nsec"
                    value={nsec}
                    onChange={(e) => setNsec(e.target.value)}
                    className="rounded-lg focus-visible:ring-primary"
                    placeholder="nsec1..."
                  />
                </div>

                <div className="text-center">
                  <div className="text-sm mb-2 text-muted-foreground">
                    Or upload a key file
                  </div>
                  <input
                    type="file"
                    accept=".txt"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Nsec File
                  </Button>
                </div>

                <Button
                  className="w-full rounded-full py-6 mt-4"
                  onClick={handleKeyLogin}
                  disabled={isLoading || !nsec.trim()}
                >
                  {isLoading ? "Verifying..." : "Login with Nsec"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="bunker" className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="bunkerUri"
                  className="text-sm font-medium text-foreground"
                >
                  Bunker URI
                </label>
                <Input
                  id="bunkerUri"
                  value={bunkerUri}
                  onChange={(e) => setBunkerUri(e.target.value)}
                  className="rounded-lg focus-visible:ring-primary"
                  placeholder="bunker://"
                />
                {bunkerUri && !bunkerUri.startsWith("bunker://") && (
                  <div className="text-destructive text-xs">
                    URI must start with bunker://
                  </div>
                )}
              </div>

              <Button
                className="w-full rounded-full py-6"
                onClick={handleBunkerLogin}
                disabled={
                  isLoading ||
                  !bunkerUri.trim() ||
                  !bunkerUri.startsWith("bunker://")
                }
              >
                {isLoading ? "Connecting..." : "Login with Bunker"}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginDialog;
