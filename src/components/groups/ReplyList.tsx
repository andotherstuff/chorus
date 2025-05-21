import { useState } from "react";
import { NostrEvent } from "@nostrify/nostrify";
import { useReplies, useNestedReplies } from "@/hooks/useReplies";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useApprovedMembers } from "@/hooks/useApprovedMembers";
import { useReplyApprovals } from "@/hooks/useReplyApprovals";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NoteContent } from "../NoteContent";
import { ReplyForm } from "./ReplyForm";
import { Link } from "react-router-dom";
import { MessageSquare, CheckCircle, AlertTriangle, Shield } from "lucide-react";
import { EmojiReactionButton } from "@/components/EmojiReactionButton";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ReplyListProps {
  postId: string;
  communityId: string;
  postAuthorPubkey: string;
}

export function ReplyList({ postId, communityId, postAuthorPubkey }: ReplyListProps) {
  const { data: replies, isLoading, refetch } = useReplies(postId, communityId);
  const { user } = useCurrentUser();
  const { approvedMembers, moderators, isApprovedMember } = useApprovedMembers(communityId);
  const { replyApprovals, isReplyApproved } = useReplyApprovals(communityId);
  const [showOnlyApproved, setShowOnlyApproved] = useState(true);
  
  // Check if current user is a moderator
  const isUserModerator = user ? moderators.includes(user.pubkey) : false;
  
  if (isLoading) {
    return (
      <div className="space-y-4 mt-4">
        <div className="text-sm font-medium text-muted-foreground mb-2">Loading replies...</div>
        {[1, 2].map((i) => (
          <div key={i} className="pl-6 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div>
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    );
  }
  
  if (!replies || replies.length === 0) {
    return (
      <div className="mt-4">
        <div className="text-sm font-medium text-muted-foreground mb-4">No replies yet</div>
        <ReplyForm 
          postId={postId} 
          communityId={communityId} 
          postAuthorPubkey={postAuthorPubkey}
          onReplySubmitted={() => refetch()}
        />
      </div>
    );
  }
  
  // Process replies to mark which ones are approved
  const processedReplies = replies.map(reply => {
    // Check if reply is explicitly approved by a moderator
    const isExplicitlyApproved = isReplyApproved(reply.id);
    
    // Check if author is an approved member or moderator (auto-approval)
    const isAuthorApproved = isApprovedMember(reply.pubkey);
    
    // A reply is considered approved if it's either explicitly approved or from an approved author
    const isApproved = isExplicitlyApproved || isAuthorApproved;
    
    return {
      ...reply,
      isApproved,
      isAutoApproved: isAuthorApproved && !isExplicitlyApproved,
      isPendingApproval: !isApproved
    };
  });
  
  // Filter replies based on approval status if showOnlyApproved is true
  const filteredReplies = showOnlyApproved && !isUserModerator
    ? processedReplies.filter(reply => reply.isApproved)
    : processedReplies;
  
  // Count approved and pending replies
  const approvedCount = processedReplies.filter(reply => reply.isApproved).length;
  const pendingCount = processedReplies.length - approvedCount;
  
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-muted-foreground">
          {filteredReplies.length} {filteredReplies.length === 1 ? 'reply' : 'replies'}
          {pendingCount > 0 && isUserModerator && (
            <span className="ml-2 text-amber-600">({pendingCount} pending approval)</span>
          )}
        </div>
        
        {(pendingCount > 0 || !showOnlyApproved) && isUserModerator && (
          <div className="flex items-center space-x-2">
            <Switch
              id="show-pending"
              checked={!showOnlyApproved}
              onCheckedChange={(checked) => setShowOnlyApproved(!checked)}
            />
            <Label htmlFor="show-pending" className="text-xs">
              Show pending replies
            </Label>
          </div>
        )}
      </div>
      
      {filteredReplies.map((reply) => (
        <ReplyItem 
          key={reply.id} 
          reply={reply} 
          communityId={communityId}
          postId={postId}
          postAuthorPubkey={postAuthorPubkey}
          onReplySubmitted={() => refetch()}
          isUserModerator={isUserModerator}
        />
      ))}
      
      <div className="mt-4">
        <ReplyForm 
          postId={postId} 
          communityId={communityId} 
          postAuthorPubkey={postAuthorPubkey}
          onReplySubmitted={() => refetch()}
        />
      </div>
    </div>
  );
}

interface ReplyItemProps {
  reply: NostrEvent & {
    isApproved: boolean;
    isAutoApproved: boolean;
    isPendingApproval: boolean;
  };
  communityId: string;
  postId: string;
  postAuthorPubkey: string;
  onReplySubmitted: () => void;
  isUserModerator: boolean;
}

function ReplyItem({ reply, communityId, postId, postAuthorPubkey, onReplySubmitted, isUserModerator }: ReplyItemProps) {
  const author = useAuthor(reply.pubkey);
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const { data: nestedReplies, isLoading: isLoadingNested, refetch: refetchNested } = useNestedReplies(reply.id);
  const [showNestedReplies, setShowNestedReplies] = useState(true);
  const { approvedMembers, isApprovedMember } = useApprovedMembers(communityId);
  const { replyApprovals, isReplyApproved } = useReplyApprovals(communityId);
  
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || reply.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  
  const handleReplySubmitted = () => {
    setShowReplyForm(false);
    refetchNested();
    onReplySubmitted();
  };
  
  // Process nested replies to mark which ones are approved
  const processedNestedReplies = nestedReplies?.map(nestedReply => {
    // Check if reply is explicitly approved by a moderator
    const isExplicitlyApproved = isReplyApproved(nestedReply.id);
    
    // Check if author is an approved member or moderator (auto-approval)
    const isAuthorApproved = isApprovedMember(nestedReply.pubkey);
    
    // A reply is considered approved if it's either explicitly approved or from an approved author
    const isApproved = isExplicitlyApproved || isAuthorApproved;
    
    return {
      ...nestedReply,
      isApproved,
      isAutoApproved: isAuthorApproved && !isExplicitlyApproved,
      isPendingApproval: !isApproved
    };
  }) || [];
  
  // Filter nested replies based on approval status if not a moderator
  const filteredNestedReplies = !isUserModerator
    ? processedNestedReplies.filter(nestedReply => nestedReply.isApproved)
    : processedNestedReplies;
  
  const handleApproveReply = async () => {
    if (!user) {
      toast.error("You must be logged in to approve replies");
      return;
    }
    
    try {
      // Create approval event (kind 4550)
      await publishEvent({
        kind: 4550,
        tags: [
          ["a", communityId],
          ["e", reply.id],
          ["p", reply.pubkey],
          ["k", "1111"], // Reply kind
        ],
        content: JSON.stringify(reply),
      });
      
      toast.success("Reply approved successfully!");
      onReplySubmitted(); // Refresh the list
    } catch (error) {
      console.error("Error approving reply:", error);
      toast.error("Failed to approve reply. Please try again.");
    }
  };
  
  return (
    <div className="pl-6 border-l-2 border-muted">
      <div className="pt-2">
        <div className="flex items-start gap-3">
          <Link to={`/profile/${reply.pubkey}`}>
            <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
              <AvatarImage src={profileImage} />
              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>
          
          <div className="flex-1">
            <div className={`${reply.isPendingApproval ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-muted/50'} rounded-lg p-3`}>
              <div className="flex items-center justify-between mb-1">
                <Link to={`/profile/${reply.pubkey}`} className="hover:underline">
                  <span className="font-semibold text-sm block">{displayName}</span>
                </Link>
                <div className="flex items-center">
                  {reply.isApproved && (
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center mr-2">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {reply.isAutoApproved ? 'Auto-approved' : 'Approved'}
                    </span>
                  )}
                  {reply.isPendingApproval && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center mr-2">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Pending approval
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Date(reply.created_at * 1000).toLocaleString()}
                  </span>
                </div>
              </div>
              
              <div className="text-sm">
                <NoteContent event={reply} />
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-1 ml-1">
              <EmojiReactionButton postId={reply.id} />
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs text-muted-foreground h-6 px-2"
                onClick={() => setShowReplyForm(!showReplyForm)}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                Reply
              </Button>
              
              {isUserModerator && reply.isPendingApproval && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleApproveReply}
                  className="text-xs text-green-600 h-6 px-2 border-green-200"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Approve
                </Button>
              )}
              
              {filteredNestedReplies.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground h-6 px-2"
                  onClick={() => setShowNestedReplies(!showNestedReplies)}
                >
                  {showNestedReplies ? 'Hide replies' : `Show ${filteredNestedReplies.length} replies`}
                </Button>
              )}
            </div>
            
            {showReplyForm && (
              <div className="mt-2">
                <ReplyForm 
                  postId={postId}
                  communityId={communityId}
                  postAuthorPubkey={postAuthorPubkey}
                  parentId={reply.id}
                  parentAuthorPubkey={reply.pubkey}
                  onReplySubmitted={handleReplySubmitted}
                  isNested={true}
                />
              </div>
            )}
            
            {showNestedReplies && filteredNestedReplies.length > 0 && (
              <div className="mt-3 space-y-3">
                {filteredNestedReplies.map(nestedReply => (
                  <ReplyItem
                    key={nestedReply.id}
                    reply={nestedReply}
                    communityId={communityId}
                    postId={postId}
                    postAuthorPubkey={postAuthorPubkey}
                    onReplySubmitted={refetchNested}
                    isUserModerator={isUserModerator}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// LikeButton has been replaced with EmojiReactionButton