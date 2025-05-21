import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/ui/Header";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Navigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { nip19 } from 'nostr-tools';
import { useUnreadNotificationsCount } from '@/hooks/useNotifications';

export default function Settings() {
  const { user } = useCurrentUser();
  const { mutate: createEvent } = useNostrPublish();
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [postExpiration, setPostExpiration] = useState("off");
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [copyPrivateSuccess, setCopyPrivateSuccess] = useState(false);
  const [copyPublicSuccess, setCopyPublicSuccess] = useState(false);
  const checkedForKey = useRef(false);
  const unreadCount = useUnreadNotificationsCount();

  // Get pubkey in npub format
  const npub = user ? nip19.npubEncode(user.pubkey) : '';

  // Redirect to home if user is not logged in
  if (!user) {
    return <Navigate to="/" />;
  }

  // Load settings and private key from localStorage on component mount
  useEffect(() => {
    // Load settings
    const savedSettings = localStorage.getItem("settings");
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      if (settings.postExpiration) {
        setPostExpiration(settings.postExpiration);
      }
    }

    // Only check for private key once and if user is available
    if (!checkedForKey.current && user) {
      checkedForKey.current = true;

      // Check for private key in local storage under nostr:login
      try {
        const nostrLoginData = localStorage.getItem("nostr:login");
        if (nostrLoginData) {
          const loginArray = JSON.parse(nostrLoginData);
          // Check if it's an array and has at least one element
          if (Array.isArray(loginArray) && loginArray.length > 0) {
            const firstItem = loginArray[0];
            // Check if the first item has type "nsec"
            if (firstItem && firstItem.type === "nsec" && firstItem.data && firstItem.data.nsec) {
              setPrivateKey(firstItem.data.nsec);
            }
          }
        }
      } catch (error) {
        console.error("Error parsing nsec from localStorage:", error);
      }
    }
  }, [user]);

  // Copy private key to clipboard
  const copyPrivateKey = async () => {
    if (privateKey) {
      try {
        await navigator.clipboard.writeText(privateKey);
        setCopyPrivateSuccess(true);
        // Reset copy success after 2 seconds
        setTimeout(() => {
          setCopyPrivateSuccess(false);
        }, 2000);
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
    }
  };

  // Copy public key to clipboard
  const copyPublicKey = async () => {
    try {
      await navigator.clipboard.writeText(npub);
      setCopyPublicSuccess(true);
      // Reset copy success after 2 seconds
      setTimeout(() => {
        setCopyPublicSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Save settings to localStorage when they change
  useEffect(() => {
    const settings = {
      postExpiration
    };
    localStorage.setItem("settings", JSON.stringify(settings));
  }, [postExpiration]);

  // Function to handle deletion of all events
  const handleDeleteAll = async () => {
    // This would normally implement actual event deletion logic
    // For Nostr, you would typically publish delete events for all your previous events
    alert("Deletion functionality would be implemented here in a real application");

    // In a real implementation, you would:
    // 1. Query all events from this user
    // 2. For each event, create a deletion event (kind 5)
    // 3. Publish those deletion events
    // createEvent({ kind: 5, tags: [["e", eventId]], content: "Deleted by user" });
  };

  return (
    <div className="container mx-auto py-4 px-6"> {/* Changed padding */}
      <Header />
      <div className="space-y-6 my-6">
        {/* Keys Section */}
        <Card>
          <CardHeader>
            <CardTitle>Your Keys</CardTitle>
            <CardDescription>Your public and private keys for Nostr</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="public-key" className="text-sm font-medium">Public Key (npub)</label>
              <div className="flex mt-1">
                <Input id="public-key" value={npub} readOnly className="rounded-r-none" />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-l-none"
                  onClick={copyPublicKey}
                >
                  {copyPublicSuccess ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                </Button>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="private-key" className="text-sm font-medium">Private Key (nsec)</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                >
                  {showPrivateKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              <div className="flex mt-1">
                <Input
                  id="private-key"
                  type={showPrivateKey ? "text" : "password"}
                  value={privateKey || "***** Private key not accessible *****"}
                  readOnly
                  className="rounded-r-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-l-none"
                  onClick={copyPrivateKey}
                  disabled={!privateKey}
                >
                  {copyPrivateSuccess ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {!privateKey ?
                  "This app cannot access your private key directly if using an extension. This is for your security." :
                  "Your private key is stored locally. Keep it secure and never share it with anyone."
                }
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Disappearing posts Section */}
        <Card>
          <CardHeader>
            <CardTitle>Disappearing posts</CardTitle>
            <CardDescription>Set how long your posts should remain before expiring and not being served by relays</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={postExpiration} onValueChange={(value) => setPostExpiration(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select expiration period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">No expiration</SelectItem>
                <SelectItem value="1-week">1 week</SelectItem>
                <SelectItem value="1-month">1 month</SelectItem>
                <SelectItem value="3-months">3 months</SelectItem>
                <SelectItem value="12-months">12 months</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
