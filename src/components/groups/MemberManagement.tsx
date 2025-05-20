import { useState } from "react";
import { useNostr } from "@/hooks/useNostr";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthor } from "@/hooks/useAuthor";
import { toast } from "sonner";
import { UserPlus, Users, CheckCircle, XCircle } from "lucide-react";
import { NostrEvent } from "@nostrify/nostrify";
import { Link } from "react-router-dom";

interface MemberManagementProps {
  communityId: string;
  isModerator: boolean;
}

export function MemberManagement({ communityId, isModerator }: MemberManagementProps) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const [activeTab, setActiveTab] = useState("requests");

  // Query for join requests
  const { data: joinRequests, isLoading: isLoadingRequests, refetch: refetchRequests } = useQuery({
    queryKey: ["join-requests", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      const events = await nostr.query([{ 
        kinds: [4552],
        "#a": [communityId],
        limit: 50,
      }], { signal });
      
      return events;
    },
    enabled: !!nostr && !!communityId,
  });

  // Query for approved members
  const { data: approvedMembersEvents, isLoading: isLoadingMembers, refetch: refetchMembers } = useQuery({
    queryKey: ["approved-members", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      const events = await nostr.query([{ 
        kinds: [14550],
        "#a": [communityId],
        limit: 10,
      }], { signal });
      
      return events;
    },
    enabled: !!nostr && !!communityId,
  });

  // Extract all approved member pubkeys from the events
  const approvedMembers = approvedMembersEvents?.flatMap(event => 
    event.tags.filter(tag => tag[0] === "p").map(tag => tag[1])
  ) || [];

  // Remove duplicates
  const uniqueApprovedMembers = [...new Set(approvedMembers)];

  // Filter out join requests from users who are already approved
  const pendingRequests = joinRequests?.filter(request => 
    !uniqueApprovedMembers.includes(request.pubkey)
  ) || [];

  const handleApproveUser = async (pubkey: string) => {
    if (!user || !isModerator) {
      toast.error("You must be a moderator to approve members");
      return;
    }

    try {
      // Get the latest approved members list
      const latestList = approvedMembersEvents?.[0];
      
      // Create a new list or update the existing one
      const tags = [
        ["a", communityId],
        ...uniqueApprovedMembers.map(pk => ["p", pk]),
        ["p", pubkey] // Add the new member
      ];

      // Create approved members event (kind 14550)
      await publishEvent({
        kind: 14550,
        tags,
        content: "",
      });
      
      toast.success("User approved successfully!");
      
      // Refetch data
      refetchRequests();
      refetchMembers();
      
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
        ["a", communityId],
        ...updatedMembers.map(pk => ["p", pk])
      ];

      // Create updated approved members event (kind 14550)
      await publishEvent({
        kind: 14550,
        tags,
        content: "",
      });
      
      toast.success("Member removed successfully!");
      
      // Refetch data
      refetchMembers();
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Failed to remove member. Please try again.");
    }
  };

  if (!isModerator) {
    return null;
  }

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
          <TabsList className="mb-4">
            <TabsTrigger value="requests" className="flex items-center">
              <UserPlus className="h-4 w-4 mr-2" />
              Requests
              {pendingRequests.length > 0 && (
                <span className="ml-2 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="members" className="flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Members
              <span className="ml-2 bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                {uniqueApprovedMembers.length}
              </span>
            </TabsTrigger>
          </TabsList>
          
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
                {pendingRequests.map((request) => (
                  <JoinRequestItem 
                    key={request.id} 
                    request={request} 
                    onApprove={() => handleApproveUser(request.pubkey)} 
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
}

function JoinRequestItem({ request, onApprove }: JoinRequestItemProps) {
  const author = useAuthor(request.pubkey);
  const metadata = author.data?.metadata;
  
  const displayName = metadata?.name || request.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  const joinReason = request.content;
  
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-md gap-3">
      <div className="flex items-center gap-3">
        <Link to={`/profile/${request.pubkey}`}>
          <Avatar>
            <AvatarImage src={profileImage} />
            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <div>
          <Link to={`/profile/${request.pubkey}`} className="font-medium hover:underline">
            {displayName}
          </Link>
          <p className="text-xs text-muted-foreground">
            Requested {new Date(request.created_at * 1000).toLocaleString()}
          </p>
          {joinReason && (
            <p className="text-sm mt-1 max-w-md">
              "{joinReason}"
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2 ml-auto">
        <Button variant="outline" size="sm" className="text-red-600">
          <XCircle className="h-4 w-4 mr-1" />
          Decline
        </Button>
        <Button size="sm" onClick={onApprove}>
          <CheckCircle className="h-4 w-4 mr-1" />
          Approve
        </Button>
      </div>
    </div>
  );
}

interface MemberItemProps {
  pubkey: string;
  onRemove: () => void;
}

function MemberItem({ pubkey, onRemove }: MemberItemProps) {
  const author = useAuthor(pubkey);
  const { user } = useCurrentUser();
  const metadata = author.data?.metadata;
  
  const displayName = metadata?.name || pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  const isCurrentUser = user?.pubkey === pubkey;
  
  return (
    <div className="flex items-center justify-between p-3 border rounded-md">
      <div className="flex items-center gap-3">
        <Link to={`/profile/${pubkey}`}>
          <Avatar>
            <AvatarImage src={profileImage} />
            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <div>
          <Link to={`/profile/${pubkey}`} className="font-medium hover:underline">
            {displayName}
          </Link>
          {isCurrentUser && (
            <span className="ml-2 text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
              You
            </span>
          )}
        </div>
      </div>
      <Button 
        variant="outline" 
        size="sm" 
        className="text-red-600"
        onClick={onRemove}
        disabled={isCurrentUser}
      >
        <XCircle className="h-4 w-4 mr-1" />
        Remove
      </Button>
    </div>
  );
}