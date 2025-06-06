import { useState, useEffect } from "react";
import { useNostr } from "@/hooks/useNostr";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useBannedUsers } from "@/hooks/useBannedUsers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthor } from "@/hooks/useAuthor";
import { toast } from "sonner";
import { UserPlus, Users, CheckCircle, XCircle, UserX, Ban } from "lucide-react";
import { NostrEvent } from "@jsr/nostrify__nostrify";
import { Link, useLocation } from "react-router-dom";
import { KINDS } from "@/lib/nostr-kinds";
import { useApprovedMembers } from "@/hooks/useApprovedMembers";

interface MemberManagementProps {
  communityId: string;
  isModerator: boolean;
}

export function MemberManagement({ communityId, isModerator }: MemberManagementProps) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const location = useLocation();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { 
    bannedUsers: uniqueBannedUsers, 
    isLoading: isLoadingBanned, 
    banUser, 
    unbanUser 
  } = useBannedUsers(communityId);
  const [activeTab, setActiveTab] = useState("requests");
  
  // Check URL parameters for tab selection
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const membersTab = searchParams.get('membersTab');
    
    if (membersTab && ['requests', 'members', 'declined', 'banned'].includes(membersTab)) {
      setActiveTab(membersTab);
    }
  }, [location.search]);

  // Query for join requests
  const { data: joinRequests, isLoading: isLoadingRequests, refetch: refetchRequests } = useQuery({
    queryKey: ["join-requests", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      const events = await nostr.query([{ 
        kinds: [KINDS.GROUP_JOIN_REQUEST],
        "#a": [communityId],
        limit: 50,
      }], { signal });
      
      return events;
    },
    enabled: !!nostr && !!communityId,
  });

  // Get approved members using the centralized hook
  const { approvedMembers, isLoading: isLoadingMembers } = useApprovedMembers(communityId);

  // Query for declined users
  const { data: declinedUsersEvents, isLoading: isLoadingDeclined, refetch: refetchDeclined } = useQuery({
    queryKey: ["declined-users", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      const events = await nostr.query([{ 
        kinds: [KINDS.GROUP_DECLINED_MEMBERS_LIST],
        "#d": [communityId],
        limit: 50,
      }], { signal });
      
      return events;
    },
    enabled: !!nostr && !!communityId,
  });

  // Remove duplicates
  const uniqueApprovedMembers = [...new Set(approvedMembers)];

  // Extract all declined user pubkeys from the events
  const declinedUsers = declinedUsersEvents?.flatMap(event => 
    event.tags.filter(tag => tag[0] === "p").map(tag => tag[1])
  ) || [];

  // Remove duplicates
  const uniqueDeclinedUsers = [...new Set(declinedUsers)];

  // Filter out join requests from users who are already approved, declined, or banned
  const pendingRequests = joinRequests?.filter(request => 
    !uniqueApprovedMembers.includes(request.pubkey) && 
    !uniqueDeclinedUsers.includes(request.pubkey) &&
    !uniqueBannedUsers.includes(request.pubkey)
  ) || [];

  const handleApproveUser = async (pubkey: string) => {
    if (!user || !isModerator) {
      toast.error("You must be a moderator to approve members");
      return;
    }

    try {
      // Check if the user is in the declined list
      const isDeclined = uniqueDeclinedUsers.includes(pubkey);
      
      // Create a new list or update the existing one for approved members
      const tags = [
        ["d", communityId],
        ...uniqueApprovedMembers.map(pk => ["p", pk]),
        ["p", pubkey] // Add the new member
      ];

      // Create approved members event
      await publishEvent({
        kind: KINDS.GROUP_APPROVED_MEMBERS_LIST,
        tags,
        content: "",
      });
      
      // If the user was in the declined list, remove them by creating a new kind 4551 event
      // that excludes this pubkey
      if (isDeclined) {
        // Find all declined events that include this pubkey
        const declinedEventsForUser = declinedUsersEvents?.filter(event => 
          event.tags.some(tag => tag[0] === "p" && tag[1] === pubkey)
        ) || [];
        
        // For each declined event, create a new event that removes this user
        for (const declinedEvent of declinedEventsForUser) {
          // Get the original request event ID and kind from the declined event
          const eventIdTag = declinedEvent.tags.find(tag => tag[0] === "e");
          const kindTag = declinedEvent.tags.find(tag => tag[0] === "k");
          
          if (eventIdTag && kindTag) {
            // Create a new declined event that doesn't include this pubkey
            // This effectively "removes" the user from the declined list
            await publishEvent({
              kind: KINDS.GROUP_DECLINED_MEMBERS_LIST,
              tags: [
                ["d", communityId],
                ["e", eventIdTag[1]],
                // Deliberately omitting the pubkey tag to remove the user
                ["k", kindTag[1]]
              ],
              content: "", // Empty content to indicate removal
            });
          }
        }
      }
      
      toast.success("User approved successfully!");
      
      // Refetch data
      refetchRequests();
      refetchDeclined();
      
      // Invalidate pending requests count cache
      queryClient.invalidateQueries({ queryKey: ["join-requests-count", communityId] });
      queryClient.invalidateQueries({ queryKey: ["approved-members-count", communityId] });
      queryClient.invalidateQueries({ queryKey: ["declined-users-count", communityId] });
      queryClient.invalidateQueries({ queryKey: ["approved-members-list", communityId] });
      
      // Switch to members tab
      setActiveTab("members");
    } catch (error) {
      console.error("Error approving user:", error);
      toast.error("Failed to approve user. Please try again.");
    }
  };

  const handleRemoveMember = async (pubkey: string) => {
    if (!user || !isModerator) {
      toast.error("You must be a moderator to remove members");
      return;
    }

    try {
      // Filter out the member to remove
      const updatedMembers = uniqueApprovedMembers.filter(pk => pk !== pubkey);
      
      // Create a new list with the member removed
      const tags = [
        ["d", communityId],
        ...updatedMembers.map(pk => ["p", pk])
      ];

      // Create updated approved members event
      await publishEvent({
        kind: KINDS.GROUP_APPROVED_MEMBERS_LIST,
        tags,
        content: "",
      });
      
      // Add the removed user to the declined list 
      // We'll create a generic event ID since we don't have a specific request event
      const removalEventId = `removal:${pubkey}:${Date.now()}`;
      
      await publishEvent({
        kind: KINDS.GROUP_DECLINED_MEMBERS_LIST,
        tags: [
          ["d", communityId],
          ["e", removalEventId], // Using a generated event ID
          ["p", pubkey], // The pubkey of the removed user
          ["k", String(KINDS.GROUP_APPROVED_MEMBERS_LIST)] // Indicating this was a removal from the approved list
        ],
        content: JSON.stringify({
          reason: "Removed from group by moderator",
          timestamp: Date.now()
        }),
      });
      
      toast.success("Member removed successfully!");
      
      // Refetch data
      refetchDeclined();
      
      // Invalidate pending requests count cache
      queryClient.invalidateQueries({ queryKey: ["approved-members-count", communityId] });
      queryClient.invalidateQueries({ queryKey: ["declined-users-count", communityId] });
      queryClient.invalidateQueries({ queryKey: ["approved-members-list", communityId] });
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Failed to remove member. Please try again.");
    }
  };
  
  const handleBanUser = async (pubkey: string) => {
    if (!user || !isModerator) {
      toast.error("You must be a moderator to ban users");
      return;
    }

    try {
      // First remove the user from approved members if they are in that list
      if (uniqueApprovedMembers.includes(pubkey)) {
        await handleRemoveMember(pubkey);
      }
      
      // Then ban the user
      await banUser(pubkey);
      
      toast.success("User banned successfully!");
      
      // Invalidate pending requests count cache
      queryClient.invalidateQueries({ queryKey: ["join-requests-count", communityId] });
      queryClient.invalidateQueries({ queryKey: ["approved-members-count", communityId] });
      queryClient.invalidateQueries({ queryKey: ["banned-users-count", communityId] });
      
      // Switch to banned tab
      setActiveTab("banned");
    } catch (error) {
      console.error("Error banning user:", error);
      toast.error("Failed to ban user. Please try again.");
    }
  };

  const handleDeclineUser = async (request: NostrEvent) => {
    if (!user || !isModerator) {
      toast.error("You must be a moderator to decline join requests");
      return;
    }

    try {
      // Create decline event (kind 14551)
      await publishEvent({
        kind: KINDS.GROUP_DECLINED_MEMBERS_LIST,
        tags: [
          ["d", communityId],
          ["e", request.id],
          ["p", request.pubkey],
          ["k", String(KINDS.GROUP_JOIN_REQUEST)] // The kind of the request event
        ],
        content: JSON.stringify(request), // Store the full request event
      });
      
      toast.success("User declined successfully!");
      
      // Refetch data
      refetchRequests();
      refetchDeclined();
      
      // Invalidate pending requests count cache
      queryClient.invalidateQueries({ queryKey: ["join-requests-count", communityId] });
      queryClient.invalidateQueries({ queryKey: ["declined-users-count", communityId] });
    } catch (error) {
      console.error("Error declining user:", error);
      toast.error("Failed to decline user. Please try again.");
    }
  };

  const handleApproveDeclinedUser = async (pubkey: string) => {
    if (!user || !isModerator) {
      toast.error("You must be a moderator to approve users");
      return;
    }

    try {
      // 1. Find all declined events that include this pubkey
      const declinedEventsForUser = declinedUsersEvents?.filter(event => 
        event.tags.some(tag => tag[0] === "p" && tag[1] === pubkey)
      ) || [];
      
      // 2. For each declined event, create a new event that removes this user
      for (const declinedEvent of declinedEventsForUser) {
        // Get the original request event ID and kind from the declined event
        const eventIdTag = declinedEvent.tags.find(tag => tag[0] === "e");
        const kindTag = declinedEvent.tags.find(tag => tag[0] === "k");
        
        if (eventIdTag && kindTag) {
          // Create a new declined event that doesn't include this pubkey
          // This effectively "removes" the user from the declined list
          await publishEvent({
            kind: KINDS.GROUP_DECLINED_MEMBERS_LIST,
            tags: [
              ["d", communityId],
              ["e", eventIdTag[1]],
              // Deliberately omitting the pubkey tag to remove the user
              ["k", kindTag[1]]
            ],
            content: "", // Empty content to indicate removal
          });
        }
      }

      // 3. Add to approved members list
      const tags = [
        ["d", communityId],
        ...uniqueApprovedMembers.map(pk => ["p", pk]),
        ["p", pubkey] // Add the new member
      ];

      // Create approved members event
      await publishEvent({
        kind: KINDS.GROUP_APPROVED_MEMBERS_LIST,
        tags,
        content: "",
      });
      
      toast.success("User approved successfully!");
      
      // Refetch data
      refetchDeclined();
      
      // Invalidate pending requests count cache
      queryClient.invalidateQueries({ queryKey: ["approved-members-count", communityId] });
      queryClient.invalidateQueries({ queryKey: ["declined-users-count", communityId] });
      queryClient.invalidateQueries({ queryKey: ["approved-members-list", communityId] });
      
      // Switch to members tab
      setActiveTab("members");
    } catch (error) {
      console.error("Error approving declined user:", error);
      toast.error("Failed to approve user. Please try again.");
    }
  };

  const handleApproveAllRequests = async () => {
    if (!user || !isModerator) {
      toast.error("You must be a moderator to approve members");
      return;
    }

    if (pendingRequests.length === 0) {
      toast.info("No pending requests to approve");
      return;
    }
    
    try {
      // Get all the pubkeys from pending requests
      const pendingPubkeys = pendingRequests.map(request => request.pubkey);
      
      // Create a new list of all existing approved members plus all pending requests
      const tags = [
        ["d", communityId],
        ...uniqueApprovedMembers.map(pk => ["p", pk]),
        ...pendingPubkeys.map(pk => ["p", pk]) // Add all pending members
      ];

      // Create approved members event
      await publishEvent({
        kind: KINDS.GROUP_APPROVED_MEMBERS_LIST,
        tags,
        content: "",
      });
      
      // Handle any declined users in the pending list
      const declinedPubkeysInPendingList = pendingPubkeys.filter(pk => 
        uniqueDeclinedUsers.includes(pk)
      );
      
      if (declinedPubkeysInPendingList.length > 0) {
        // For each previously declined user, find their events and remove them from declined list
        for (const pubkey of declinedPubkeysInPendingList) {
          const declinedEventsForUser = declinedUsersEvents?.filter(event => 
            event.tags.some(tag => tag[0] === "p" && tag[1] === pubkey)
          ) || [];
          
          for (const declinedEvent of declinedEventsForUser) {
            // Get the original request event ID and kind from the declined event
            const eventIdTag = declinedEvent.tags.find(tag => tag[0] === "e");
            const kindTag = declinedEvent.tags.find(tag => tag[0] === "k");
            
            if (eventIdTag && kindTag) {
              // Create a new declined event that doesn't include this pubkey
              await publishEvent({
                kind: KINDS.GROUP_DECLINED_MEMBERS_LIST,
                tags: [
                  ["d", communityId],
                  ["e", eventIdTag[1]],
                  // Deliberately omitting the pubkey tag to remove the user
                  ["k", kindTag[1]]
                ],
                content: "", // Empty content to indicate removal
              });
            }
          }
        }
      }
      
      const approvedCount = pendingRequests.length;
      toast.success(`${approvedCount} ${approvedCount === 1 ? 'user' : 'users'} approved successfully!`);
      
      // Refetch data
      refetchRequests();
      refetchDeclined();
      
      // Invalidate pending requests count cache
      queryClient.invalidateQueries({ queryKey: ["join-requests-count", communityId] });
      queryClient.invalidateQueries({ queryKey: ["approved-members-count", communityId] });
      queryClient.invalidateQueries({ queryKey: ["declined-users-count", communityId] });
      queryClient.invalidateQueries({ queryKey: ["approved-members-list", communityId] });
    } catch (error) {
      console.error("Error approving all users:", error);
      toast.error("Failed to approve all users. Please try again.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Members</CardTitle>
        <CardDescription>
          Review join requests and manage approved members
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
                    <span>Requests</span>
                    {pendingRequests.length > 0 && (
                      <span className="bg-primary text-primary-foreground rounded-full min-w-5 h-5 px-1 flex items-center justify-center text-xs ml-auto">
                        {pendingRequests.length > 99 ? '99' : pendingRequests.length}
                      </span>
                    )}
                  </div>
                </SelectItem>
                <SelectItem value="members">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Members</span>
                  </div>
                </SelectItem>
                <SelectItem value="declined">
                  <div className="flex items-center gap-2">
                    <UserX className="h-4 w-4" />
                    <span>Declined</span>
                  </div>
                </SelectItem>
                <SelectItem value="banned">
                  <div className="flex items-center gap-2">
                    <Ban className="h-4 w-4" />
                    <span>Banned</span>
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
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No pending join requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.length > 1 && (
                  <div className="flex justify-end mb-4">
                    <Button 
                      size="sm" 
                      onClick={handleApproveAllRequests}
                      className="gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve All ({pendingRequests.length})
                    </Button>
                  </div>
                )}
                {pendingRequests.map((request) => (
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
            ) : uniqueApprovedMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No approved members yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {uniqueApprovedMembers.map((pubkey) => (
                  <MemberItem 
                    key={pubkey} 
                    pubkey={pubkey} 
                    onRemove={() => handleRemoveMember(pubkey)}
                    onBan={() => handleBanUser(pubkey)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="declined">
            {isLoadingDeclined ? (
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
            ) : uniqueDeclinedUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserX className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No declined users</p>
              </div>
            ) : (
              <div className="space-y-4">
                {uniqueDeclinedUsers.map((pubkey) => (
                  <DeclinedUserItem 
                    key={pubkey} 
                    pubkey={pubkey} 
                    onApprove={() => handleApproveDeclinedUser(pubkey)} 
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="banned">
            {isLoadingBanned ? (
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
            ) : uniqueBannedUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Ban className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No banned users</p>
              </div>
            ) : (
              <div className="space-y-4">
                {uniqueBannedUsers.map((pubkey) => (
                  <MemberItem 
                    key={pubkey} 
                    pubkey={pubkey} 
                    onRemove={() => unbanUser(pubkey)}
                    isBanned={true}
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
          <Avatar className="rounded-md">
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
        <Button 
          variant="outline" 
          size="sm" 
          className="text-red-600 flex-1 sm:flex-none"
          onClick={onDecline}
        >
          <XCircle className="h-4 w-4 mr-1" />
          <span>Decline</span>
        </Button>
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
  onRemove: () => void;
  onBan?: () => void;
  isBanned?: boolean;
}

function MemberItem({ pubkey, onRemove, onBan, isBanned = false }: MemberItemProps) {
  const author = useAuthor(pubkey);
  const { user } = useCurrentUser();
  const metadata = author.data?.metadata;
  
  const displayName = metadata?.name || pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  const isCurrentUser = user?.pubkey === pubkey;
  
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-md gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Link to={`/profile/${pubkey}`} className="flex-shrink-0">
          <Avatar className="rounded-md">
            <AvatarImage src={profileImage} />
            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/profile/${pubkey}`} className="font-medium hover:underline block truncate">
            {displayName}
          </Link>
          <div className="flex flex-wrap gap-1 mt-1">
            {isCurrentUser && (
              <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                You
              </span>
            )}
            {isBanned && (
              <span className="text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5">
                Banned
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
        {onBan && !isBanned && (
          <Button 
            variant="outline" 
            size="sm" 
            className="text-red-600 flex-1 sm:flex-none"
            onClick={onBan}
            disabled={isCurrentUser}
          >
            <Ban className="h-4 w-4 mr-1" />
            <span>Ban</span>
          </Button>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          className="text-red-600 flex-1 sm:flex-none"
          onClick={onRemove}
          disabled={isCurrentUser}
        >
          <XCircle className="h-4 w-4 mr-1" />
          <span>{isBanned ? "Unban" : "Remove"}</span>
        </Button>
      </div>
    </div>
  );
}

interface DeclinedUserItemProps {
  pubkey: string;
  onApprove: () => void;
}

function DeclinedUserItem({ pubkey, onApprove }: DeclinedUserItemProps) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  
  const displayName = metadata?.name || pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-md gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Link to={`/profile/${pubkey}`} className="flex-shrink-0">
          <Avatar className="rounded-md">
            <AvatarImage src={profileImage} />
            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/profile/${pubkey}`} className="font-medium hover:underline block truncate">
            {displayName}
          </Link>
          <span className="inline-block mt-1 text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5">
            Declined
          </span>
        </div>
      </div>
      <Button 
        size="sm"
        onClick={onApprove}
        className="w-full sm:w-auto flex-shrink-0"
      >
        <CheckCircle className="h-4 w-4 mr-1" />
        <span>Approve</span>
      </Button>
    </div>
  );
}