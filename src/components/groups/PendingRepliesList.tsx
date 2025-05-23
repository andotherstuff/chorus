import { useState } from "react";
import { usePendingReplies } from "@/hooks/usePendingReplies";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { NoteContent } from "../NoteContent";
import { Link } from "react-router-dom";
import { CheckCircle, AlertCircle, MessageSquare, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { NostrEvent } from "@nostrify/nostrify";
import { KINDS } from "@/lib/nostr-kinds";

interface PendingRepliesListProps {
  communityId: string;
}

export function PendingRepliesList({ communityId }: PendingRepliesListProps) {
  const { data: pendingReplies, isLoading, refetch } = usePendingReplies(communityId);
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64 mb-4" />
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  if (!pendingReplies || pendingReplies.length === 0) {
    return (
      <Alert className="bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200">
        <CheckCircle className="h-4 w-4" />
        <AlertTitle>No pending replies</AlertTitle>
        <AlertDescription>
          All replies have been reviewed. There are currently no replies waiting for approval in this group.
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Pending Replies</h3>
        <div className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-3 py-1 rounded-full text-sm font-medium">
          {pendingReplies.length} pending
        </div>
      </div>
      
      <Alert className="bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Pending Reply Approval</AlertTitle>
        <AlertDescription>
          These replies are from users who are not approved members, moderators, or the group owner. 
          They need your approval before they will be visible to all group members.
        </AlertDescription>
      </Alert>
      
      <div className="space-y-4">
        {pendingReplies.map((reply) => (
          <PendingReplyItem 
            key={reply.id} 
            reply={reply} 
            communityId={communityId}
            onApproved={() => refetch()}
          />
        ))}
      </div>
    </div>
  );
}

interface PendingReplyItemProps {
  reply: NostrEvent & {
    parent: NostrEvent | null;
    parentId: string;
  };
  communityId: string;
  onApproved: () => void;
}

function PendingReplyItem({ reply, communityId, onApproved }: PendingReplyItemProps) {
  const author = useAuthor(reply.pubkey);
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const parentAuthor = useAuthor(reply.parent?.pubkey || "");
  
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || reply.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  
  const parentMetadata = parentAuthor.data?.metadata;
  const parentDisplayName = parentMetadata?.name || reply.parent?.pubkey?.slice(0, 8) || "Unknown";
  
  const handleApproveReply = async () => {
    if (!user) {
      toast.error("You must be logged in to approve replies");
      return;
    }
    
    try {
      // Create approval event (kind 4550)
      await publishEvent({
        kind: KINDS.GROUP_POST_APPROVAL,
        tags: [
          ["a", communityId],
          ["e", reply.id],
          ["p", reply.pubkey],
          ["k", "1111"], // Reply kind
        ],
        content: JSON.stringify(reply),
      });
      
      toast.success("Reply approved successfully!");
      onApproved(); // Refresh the list
    } catch (error) {
      console.error("Error approving reply:", error);
      toast.error("Failed to approve reply. Please try again.");
    }
  };
  
  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to={`/profile/${reply.pubkey}`}>
              <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
                <AvatarImage src={profileImage} />
                <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </Link>
            <div>
              <Link to={`/profile/${reply.pubkey}`} className="hover:underline">
                <p className="font-semibold text-sm">{displayName}</p>
              </Link>
              <div className="flex items-center text-xs text-muted-foreground">
                <span>{new Date(reply.created_at * 1000).toLocaleString()}</span>
                <span className="ml-2 text-amber-600 dark:text-amber-400 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Pending approval
                </span>
              </div>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleApproveReply}
            className="text-green-600"
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Approve
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {reply.parent && (
          <div className="mb-3 p-2 bg-muted/30 rounded-md text-xs text-muted-foreground">
            <div className="flex items-center gap-1 mb-1">
              <MessageSquare className="h-3 w-3" />
              <span>Replying to <span className="font-medium">{parentDisplayName}</span>:</span>
            </div>
            <div className="line-clamp-2">
              {reply.parent.content.length > 100 
                ? `${reply.parent.content.slice(0, 100)}...` 
                : reply.parent.content}
            </div>
            <Link 
              to={`/post/${reply.parentId}`} 
              className="text-primary flex items-center gap-1 mt-1 hover:underline"
            >
              View original post
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        )}
        
        <div className="whitespace-pre-wrap break-words">
          <NoteContent event={reply} className="text-sm" />
        </div>
      </CardContent>
    </Card>
  );
}