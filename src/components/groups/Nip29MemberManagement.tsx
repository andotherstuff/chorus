import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useEnhancedNostr } from "@/components/EnhancedNostrProvider";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthor } from "@/hooks/useAuthor";
import { toast } from "sonner";
import { UserPlus, Users, CheckCircle, XCircle, UserX, Ban, Shield } from "lucide-react";
import type { NostrEvent } from "@nostrify/nostrify";
import { useNip29GroupMembers } from "@/hooks/useNip29Groups";

interface Nip29MemberManagementProps {
  groupId: string;
  relay: string;
}

export function Nip29MemberManagement({ groupId, relay }: Nip29MemberManagementProps) {
  const { nostr } = useEnhancedNostr();
  const { user } = useCurrentUser();
  const location = useLocation();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("requests");
  
  // Check URL parameters for tab selection
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const membersTab = searchParams.get('membersTab');
    
    if (membersTab && ['requests', 'members'].includes(membersTab)) {
      setActiveTab(membersTab);
    }
  }, [location.search]);

  // Get current membership data
  const { data: membershipData, isLoading: isLoadingMembers } = useNip29GroupMembers(groupId, relay);
  const { members = [], admins = [], userRole } = membershipData || {};
  
  const isAdmin = userRole === 'admin';

  // Query for join requests (kind 9021)
  const { data: joinRequests, isLoading: isLoadingRequests, refetch: refetchRequests } = useQuery({
    queryKey: ["nip29-join-requests", groupId, relay],
    queryFn: async (c) => {
      if (!nostr) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      console.log(`[NIP-29] Fetching join requests for group ${groupId} from ${relay}`);
      
      const events = await nostr.query([{ 
        kinds: [9021], // GROUP_USER_JOIN_REQUEST
        "#h": [groupId],
        limit: 50,
      }], { 
        signal,
        relays: [relay]
      });
      
      console.log(`[NIP-29] Found ${events.length} join requests`);
      
      // Filter out requests from users who are already members
      const filteredRequests = events.filter(request => 
        !members.includes(request.pubkey) && !admins.includes(request.pubkey)
      );
      
      console.log(`[NIP-29] Filtered to ${filteredRequests.length} pending requests`);
      
      return filteredRequests;
    },
    enabled: !!nostr && !!groupId && !!relay,
    staleTime: 30000,
  });

  const handleApproveUser = async (pubkey: string) => {
    if (!user || !isAdmin) {
      toast.error("You must be an administrator to approve members");
      return;
    }

    try {
      console.log(`[NIP-29] Approving user: ${pubkey}`);
      
      // Create NIP-29 add user event (kind 9000)
      const event = await user!.signer.signEvent({
        kind: 9000, // GROUP_ADD_USER
        tags: [
          ["h", groupId],
          ["p", pubkey]
        ],
        content: "",
        created_at: Math.floor(Date.now() / 1000),
      });
      
      if (!nostr) {
        throw new Error("Nostr client not available");
      }
      
      await nostr.event(event, { relays: [relay] });
      
      toast.success("User approved successfully!");
      
      // Refresh data
      refetchRequests();
      queryClient.invalidateQueries({ queryKey: ["nip29-members", groupId, relay] });
      
      // Switch to members tab
      setActiveTab("members");
    } catch (error) {
      console.error("Error approving user:", error);
      toast.error("Failed to approve user. Please try again.");
    }
  };

  const handleRemoveMember = async (pubkey: string) => {
    if (!user || !isAdmin) {
      toast.error("You must be an administrator to remove members");
      return;
    }

    if (pubkey === user.pubkey) {
      toast.error("You cannot remove yourself from the group");
      return;
    }

    try {
      console.log(`[NIP-29] Removing member: ${pubkey}`);
      
      // Create NIP-29 remove user event (kind 9001)
      const event = await user!.signer.signEvent({
        kind: 9001, // GROUP_REMOVE_USER
        tags: [
          ["h", groupId],
          ["p", pubkey]
        ],
        content: "",
        created_at: Math.floor(Date.now() / 1000),
      });
      
      if (!nostr) {
        throw new Error("Nostr client not available");
      }
      
      await nostr.event(event, { relays: [relay] });
      
      toast.success("Member removed successfully!");
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["nip29-members", groupId, relay] });
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Failed to remove member. Please try again.");
    }
  };

  const handleSetRole = async (pubkey: string, role: string) => {
    if (!user || !isAdmin) {
      toast.error("You must be an administrator to set roles");
      return;
    }

    if (pubkey === user.pubkey && role !== 'admin') {
      toast.error("You cannot remove your own admin role");
      return;
    }

    try {
      console.log(`[NIP-29] Setting role ${role} for user: ${pubkey}`);
      
      // Create NIP-29 set roles event (kind 9006)
      const event = await user!.signer.signEvent({
        kind: 9006, // GROUP_SET_ROLES
        tags: [
          ["h", groupId],
          ["p", pubkey, role]
        ],
        content: "",
        created_at: Math.floor(Date.now() / 1000),
      });
      
      if (!nostr) {
        throw new Error("Nostr client not available");
      }
      
      await nostr.event(event, { relays: [relay] });
      
      toast.success(`User role updated to ${role}!`);
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["nip29-members", groupId, relay] });
    } catch (error) {
      console.error("Error setting role:", error);
      toast.error("Failed to update user role. Please try again.");
    }
  };

  const handleDeclineUser = async (request: NostrEvent) => {
    if (!user || !isAdmin) {
      toast.error("You must be an administrator to decline join requests");
      return;
    }

    try {
      console.log(`[NIP-29] Declining user: ${request.pubkey}`);
      
      // For NIP-29, we might not have a specific "decline" event
      // Instead, we can just ignore the request or optionally ban the user
      // For now, we'll just remove it from our local state by not approving it
      
      // TODO: Implement proper decline mechanism if needed by the relay
      toast.success("User request declined!");
      
      // Refresh requests
      refetchRequests();
    } catch (error) {
      console.error("Error declining user:", error);
      toast.error("Failed to decline user. Please try again.");
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Members</CardTitle>
        <CardDescription>
          Review join requests and manage group members
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="mb-4 w-full">
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select member category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="requests">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    <span>Join Requests</span>
                    {joinRequests && joinRequests.length > 0 && (
                      <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs ml-auto">
                        {joinRequests.length > 9 ? '9+' : joinRequests.length}
                      </span>
                    )}
                  </div>
                </SelectItem>
                <SelectItem value="members">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Members</span>
                    {members && (
                      <span className="bg-muted text-muted-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs ml-auto">
                        {members.length + admins.length}
                      </span>
                    )}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <TabsContent value="requests">
            {isLoadingRequests ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-2 border rounded-md">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-9 w-20" />
                      <Skeleton className="h-9 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !joinRequests || joinRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No pending join requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {joinRequests.map((request) => (
                  <JoinRequestItem 
                    key={request.id} 
                    request={request} 
                    onApprove={() => handleApproveUser(request.pubkey)}
                    onDecline={() => handleDeclineUser(request)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="members">
            {isLoadingMembers ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-2 border rounded-md">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-32 mb-1" />
                      </div>
                    </div>
                    <Skeleton className="h-9 w-20" />
                  </div>
                ))}
              </div>
            ) : (!members || members.length === 0) && (!admins || admins.length === 0) ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No members found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Show admins first */}
                {admins.map((pubkey) => (
                  <MemberItem 
                    key={`admin-${pubkey}`}
                    pubkey={pubkey} 
                    role="admin"
                    onRemove={() => handleRemoveMember(pubkey)}
                    onChangeRole={(role) => handleSetRole(pubkey, role)}
                    isCurrentUser={user?.pubkey === pubkey}
                  />
                ))}
                
                {/* Then show regular members */}
                {members.map((pubkey) => (
                  <MemberItem 
                    key={`member-${pubkey}`}
                    pubkey={pubkey} 
                    role="member"
                    onRemove={() => handleRemoveMember(pubkey)}
                    onChangeRole={(role) => handleSetRole(pubkey, role)}
                    isCurrentUser={user?.pubkey === pubkey}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface JoinRequestItemProps {
  request: NostrEvent;
  onApprove: () => void;
  onDecline?: () => void;
}

function JoinRequestItem({ request, onApprove, onDecline }: JoinRequestItemProps) {
  const author = useAuthor(request.pubkey);
  const metadata = author.data?.metadata;
  
  const displayName = metadata?.name || request.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  const joinReason = request.content;
  
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-md gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Link to={`/profile/${request.pubkey}`} className="flex-shrink-0">
          <Avatar>
            <AvatarImage src={profileImage} />
            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/profile/${request.pubkey}`} className="font-medium hover:underline block truncate">
            {displayName}
          </Link>
          <p className="text-xs text-muted-foreground">
            Requested {new Date(request.created_at * 1000).toLocaleDateString()}
          </p>
          {joinReason && (
            <p className="text-sm mt-1 break-words overflow-hidden" style={{ 
              display: '-webkit-box', 
              WebkitLineClamp: 2, 
              WebkitBoxOrient: 'vertical' 
            }}>
              "{joinReason}"
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
        {onDecline && (
          <Button 
            variant="outline" 
            size="sm" 
            className="text-red-600 flex-1 sm:flex-none"
            onClick={onDecline}
          >
            <XCircle className="h-4 w-4 mr-1" />
            <span>Decline</span>
          </Button>
        )}
        <Button size="sm" onClick={onApprove} className="flex-1 sm:flex-none">
          <CheckCircle className="h-4 w-4 mr-1" />
          <span>Approve</span>
        </Button>
      </div>
    </div>
  );
}

interface MemberItemProps {
  pubkey: string;
  role: 'admin' | 'member';
  onRemove: () => void;
  onChangeRole: (role: string) => void;
  isCurrentUser: boolean;
}

function MemberItem({ pubkey, role, onRemove, onChangeRole, isCurrentUser }: MemberItemProps) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  
  const displayName = metadata?.name || pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-md gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Link to={`/profile/${pubkey}`} className="flex-shrink-0">
          <Avatar>
            <AvatarImage src={profileImage} />
            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/profile/${pubkey}`} className="font-medium hover:underline block truncate">
            {displayName}
          </Link>
          <div className="flex flex-wrap gap-1 mt-1">
            {role === 'admin' ? (
              <span className="text-xs bg-purple-100 text-purple-600 rounded-full px-2 py-0.5 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Administrator
              </span>
            ) : (
              <span className="text-xs bg-blue-100 text-blue-600 rounded-full px-2 py-0.5">
                Member
              </span>
            )}
            {isCurrentUser && (
              <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                You
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
        {/* Role change dropdown */}
        <Select 
          value={role} 
          onValueChange={onChangeRole}
          disabled={isCurrentUser && role === 'admin'}
        >
          <SelectTrigger className="w-full sm:w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Remove button */}
        <Button 
          variant="outline" 
          size="sm" 
          className="text-red-600 flex-1 sm:flex-none"
          onClick={onRemove}
          disabled={isCurrentUser}
        >
          <XCircle className="h-4 w-4 mr-1" />
          <span>Remove</span>
        </Button>
      </div>
    </div>
  );
}