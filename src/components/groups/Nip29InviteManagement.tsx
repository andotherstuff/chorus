import { useState, useCallback } from "react";
import { useEnhancedNostr } from "@/components/EnhancedNostrProvider";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Key, Clock, Users, RefreshCw, QrCode } from "lucide-react";
import type { NostrEvent } from "@nostrify/nostrify";
import QRCode from 'qrcode';

interface Nip29InviteManagementProps {
  groupId: string;
  relay: string;
}

interface InviteCode {
  code: string;
  created_at: number;
  created_by: string;
  uses: number;
  max_uses?: number;
  expires_at?: number;
  event_id?: string;
}

export function Nip29InviteManagement({ groupId, relay }: Nip29InviteManagementProps) {
  const { nostr } = useEnhancedNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // Generate invite codes using the relay's capabilities
  const { data: inviteCodes, isLoading: isLoadingInvites, refetch: refetchInvites } = useQuery({
    queryKey: ["nip29-invites", groupId, relay],
    queryFn: async (c) => {
      if (!nostr) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      console.log(`[NIP-29] Fetching invite codes for group ${groupId} from ${relay}`);
      
      // Query for invite creation events (we'll track these locally since NIP-29 doesn't specify)
      // We can use a custom event kind or track in our own system
      const events = await nostr.query([{ 
        kinds: [9009], // GROUP_CREATE_INVITE
        "#h": [groupId],
        limit: 50,
      }], { 
        signal,
        relays: [relay]
      });
      
      console.log(`[NIP-29] Found ${events.length} invite events`);
      
      // Parse invite codes from events
      const invites: InviteCode[] = events.map(event => {
        const codeTag = event.tags.find(tag => tag[0] === 'code');
        const maxUsesTag = event.tags.find(tag => tag[0] === 'max_uses');
        const expiresTag = event.tags.find(tag => tag[0] === 'expires_at');
        
        return {
          code: codeTag?.[1] || generateInviteCode(),
          created_at: event.created_at,
          created_by: event.pubkey,
          uses: 0, // We'd need to track usage separately
          max_uses: maxUsesTag?.[1] ? parseInt(maxUsesTag[1]) : undefined,
          expires_at: expiresTag?.[1] ? parseInt(expiresTag[1]) : undefined,
          event_id: event.id
        };
      });
      
      return invites.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!nostr && !!groupId && !!relay,
    staleTime: 30000,
  });

  const generateInviteCode = () => {
    // Generate a random 8-character invite code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const createInviteCode = async () => {
    if (!user) {
      toast.error("You must be logged in to create invite codes");
      return;
    }

    setIsCreatingInvite(true);
    try {
      const inviteCode = generateInviteCode();
      
      console.log(`[NIP-29] Creating invite code: ${inviteCode}`);
      
      // Create NIP-29 create invite event (kind 9009)
      const event = await user!.signer.signEvent({
        kind: 9009, // GROUP_CREATE_INVITE
        tags: [
          ["h", groupId],
          ["code", inviteCode],
          // Optional: add expiry and usage limits
          // ["expires_at", String(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60)], // 7 days
          // ["max_uses", "10"]
        ],
        content: `Invite code for group: ${inviteCode}`,
        created_at: Math.floor(Date.now() / 1000),
      });
      
      if (!nostr) {
        throw new Error("Nostr client not available");
      }
      
      await nostr.event(event, { relays: [relay] });
      
      toast.success("Invite code created successfully!");
      
      // Refresh invite codes
      refetchInvites();
    } catch (error) {
      console.error("Error creating invite code:", error);
      toast.error("Failed to create invite code. Please try again.");
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const copyInviteCode = useCallback((code: string) => {
    // Create a shareable invite URL
    const inviteUrl = `${window.location.origin}/group/nip29/${encodeURIComponent(relay)}/${encodeURIComponent(groupId)}?invite=${code}`;
    
    navigator.clipboard.writeText(inviteUrl).then(() => {
      toast.success("Invite link copied to clipboard!");
    }).catch(() => {
      // Fallback for browsers without clipboard API
      toast.success("Invite code: " + code);
    });
  }, [groupId, relay]);

  const generateQrCode = useCallback(async (code: string) => {
    try {
      const inviteUrl = `${window.location.origin}/group/nip29/${encodeURIComponent(relay)}/${encodeURIComponent(groupId)}?invite=${code}`;
      const qrDataUrl = await QRCode.toDataURL(inviteUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeDataUrl(qrDataUrl);
      setShowQrModal(true);
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast.error("Failed to generate QR code");
    }
  }, [groupId, relay]);

  const deactivateInvite = async (eventId: string) => {
    if (!user) {
      toast.error("You must be logged in to deactivate invite codes");
      return;
    }

    try {
      console.log(`[NIP-29] Deactivating invite code: ${eventId}`);
      
      // For NIP-29, we can create a deletion event to deactivate the invite
      const event = await user!.signer.signEvent({
        kind: 5, // Deletion event
        tags: [
          ["e", eventId]
        ],
        content: "Invite code deactivated",
        created_at: Math.floor(Date.now() / 1000),
      });
      
      if (!nostr) {
        throw new Error("Nostr client not available");
      }
      
      await nostr.event(event, { relays: [relay] });
      
      toast.success("Invite code deactivated successfully!");
      
      // Refresh invite codes
      refetchInvites();
    } catch (error) {
      console.error("Error deactivating invite code:", error);
      toast.error("Failed to deactivate invite code. Please try again.");
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const getInviteStatus = (invite: InviteCode) => {
    const now = Math.floor(Date.now() / 1000);
    
    if (invite.expires_at && now > invite.expires_at) {
      return { status: 'expired', color: 'bg-red-100 text-red-600' };
    }
    
    if (invite.max_uses && invite.uses >= invite.max_uses) {
      return { status: 'used up', color: 'bg-gray-100 text-gray-600' };
    }
    
    return { status: 'active', color: 'bg-green-100 text-green-600' };
  };

  return (
    <div className="space-y-6">
      {/* Create new invite section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Create Invite Code
          </CardTitle>
          <CardDescription>
            Generate invite codes to allow new members to join your group
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button onClick={createInviteCode} disabled={isCreatingInvite}>
              {isCreatingInvite ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create New Invite Code
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Share invite codes with people you want to add to the group. They can use the code to join directly.
          </p>
        </CardContent>
      </Card>

      {/* Active invite codes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Active Invite Codes
          </CardTitle>
          <CardDescription>
            Manage existing invite codes for your group
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingInvites ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-20" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : !inviteCodes || inviteCodes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No invite codes created yet</p>
              <p className="text-sm">Create your first invite code to share with others</p>
            </div>
          ) : (
            <div className="space-y-4">
              {inviteCodes.map((invite) => {
                const { status, color } = getInviteStatus(invite);
                
                return (
                  <div key={invite.code} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-lg bg-muted px-3 py-1 rounded">
                        {invite.code}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${color} text-xs`}>
                            {status}
                          </Badge>
                          {invite.uses > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {invite.uses} uses
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created {formatDate(invite.created_at)}
                          {invite.expires_at && (
                            <span> • Expires {formatDate(invite.expires_at)}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateQrCode(invite.code)}
                        title="Generate QR Code"
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyInviteCode(invite.code)}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy Link
                      </Button>
                      {invite.event_id && status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600"
                          onClick={() => deactivateInvite(invite.event_id!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Modal */}
      {showQrModal && qrCodeDataUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-4">Invite QR Code</h3>
              <img 
                src={qrCodeDataUrl} 
                alt="Invite QR Code" 
                className="mx-auto mb-4"
              />
              <p className="text-sm text-muted-foreground mb-4">
                Scan this QR code to join the group
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowQrModal(false)}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    // Download QR code
                    const link = document.createElement('a');
                    link.download = `invite-${groupId}.png`;
                    link.href = qrCodeDataUrl;
                    link.click();
                  }}
                  className="flex-1"
                >
                  Download
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}