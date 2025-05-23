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
import { MessageSquare, CheckCircle, AlertTriangle, Shield, MoreVertical, Flag, Share2 } from "lucide-react";
import { EmojiReactionButton } from "@/components/EmojiReactionButton";
import { NutzapButton } from "@/components/groups/NutzapButton";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatRelativeTime } from "@/lib/utils";
import { nip19 } from 'nostr-tools';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
      <div className="mt-2">
        <div className="text-sm text-muted-foreground mb-3">No replies yet</div>
        <div className="pl-2">
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
    <div className="mt-2 space-y-0">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-muted-foreground">
          {filteredReplies.length} {filteredReplies.length === 1 ? 'reply' : 'replies'}
          {pendingCount > 0 && isUserModerator && (
            <span className="ml-2 text-amber-600">({pendingCount} pending)</span>
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
              Show pending
            </Label>
          </div>
        )}
      </div>
      
      <div>
        {filteredReplies.map((reply, index) => (
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
      </div>
      
      <div className="mt-3 pl-2">
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
  const { mutateAsync: publishEvent } = useNostrPublish({
    invalidateQueries: [
      { queryKey: ["reply-approvals", communityId] },
      { queryKey: ["replies", postId] },
      { queryKey: ["nested-replies", reply.id] },
      { queryKey: ["pending-replies", communityId] }
    ]
  });
  const [showReplyForm, setShowReplyForm] = useState(false);
  const { data: nestedReplies, isLoading: isLoadingNested, refetch: refetchNested } = useNestedReplies(reply.id);
  const [showNestedReplies, setShowNestedReplies] = useState(true);
  const { approvedMembers, isApprovedMember } = useApprovedMembers(communityId);
  const { replyApprovals, isReplyApproved } = useReplyApprovals(communityId);
  
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || reply.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  
  // Format the author identifier (NIP-05 or npub)
  const authorNip05 = metadata?.nip05;
  let authorIdentifier = authorNip05 || reply.pubkey;
  if (!authorNip05 && reply.pubkey.match(/^[0-9a-fA-F]{64}$/)) {
    try {
      const npub = nip19.npubEncode(reply.pubkey);
      authorIdentifier = `${npub.slice(0,10)}...${npub.slice(-4)}`;
    } catch (e) {
      authorIdentifier = `${reply.pubkey.slice(0,8)}...${reply.pubkey.slice(-4)}`;
    }
  } else if (!authorNip05) {
    authorIdentifier = `${reply.pubkey.slice(0,8)}...${reply.pubkey.slice(-4)}`;
  }
  
  // Format the timestamp as relative time
  const relativeTime = formatRelativeTime(reply.created_at);
  
  // Keep the absolute time for tooltip/title
  const replyDate = new Date(reply.created_at * 1000);
  const formattedAbsoluteTime = `${replyDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })} ${replyDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  })}`;
  
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
    <div className="pl-2">
      <div className="py-3">
        <div className="flex items-start gap-2.5">
          <Link to={`/profile/${reply.pubkey}`} className="flex-shrink-0">
            <Avatar className="h-9 w-9 cursor-pointer hover:opacity-80 transition-opacity rounded-md">
              <AvatarImage src={profileImage} />
              <AvatarFallback>{displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>
          
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <Link to={`/profile/${reply.pubkey}`} className="hover:underline">
                  <span className="font-semibold text-sm leading-tight block">{displayName}</span>
                </Link>
                <div className="flex items-center text-xs text-muted-foreground mt-0 flex-row">
                  <span
                    className="mr-1.5 hover:underline truncate max-w-[12rem] overflow-hidden whitespace-nowrap"
                    title={authorIdentifier}
                  >
                    {authorIdentifier}
                  </span>
                  <span className="mr-1.5">·</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="whitespace-nowrap hover:underline">{relativeTime}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{formattedAbsoluteTime}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {reply.isPendingApproval && (
                    <>
                      <span className="mr-1.5 ml-1.5">·</span>
                      <span className="text-amber-600 dark:text-amber-400 flex items-center inline-flex">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Pending
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-1 flex-shrink-0">
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" title="More options">
                      <MoreVertical className="h-3.5 w-3.5" />
                      <span className="sr-only">More options</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`${window.location.origin}/post/${reply.id}`)} className="text-xs">
                      <Share2 className="h-3.5 w-3.5 mr-1.5 md:h-3.5 md:w-3.5 h-4 w-4" /> Share Reply
                    </DropdownMenuItem>
                    {user && user.pubkey !== reply.pubkey && (
                      <DropdownMenuItem onClick={() => {
                        toast.info("Report functionality for replies coming soon");
                      }} className="text-xs">
                        <Flag className="h-3.5 w-3.5 mr-1.5 md:h-3.5 md:w-3.5 h-4 w-4" /> Report Reply
                      </DropdownMenuItem>
                    )}
                    {isUserModerator && reply.isPendingApproval && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleApproveReply} className="text-xs">
                          <CheckCircle className="h-3.5 w-3.5 mr-1.5 md:h-3.5 md:w-3.5 h-4 w-4" /> Approve Reply
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            <div className="whitespace-pre-wrap break-words text-sm mt-1">
              <NoteContent event={reply} />
            </div>
            
            <div className="flex items-center gap-12 mt-3 ml-1.5">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-foreground flex items-center h-7 px-1.5"
                onClick={() => setShowReplyForm(!showReplyForm)}
              >
                {/* Check for nested replies */}
                {(() => {
                  // We already have the nestedReplies from parent component
                  const nestedReplyCount = filteredNestedReplies.length || 0;
                  
                  return (
                    <>
                      <MessageSquare className={`h-3.5 w-3.5`} />
                      {nestedReplyCount > 0 && <span className="text-xs ml-0.5">{nestedReplyCount}</span>}
                    </>
                  );
                })()}
              </Button>
              
              <EmojiReactionButton postId={reply.id} showText={false} />
              
              <NutzapButton postId={reply.id} authorPubkey={reply.pubkey} showText={false} />
              
              {filteredNestedReplies.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground flex items-center h-7 px-1.5"
                  onClick={() => setShowNestedReplies(!showNestedReplies)}
                >
                  {showNestedReplies ? (
                    <>Hide replies</>
                  ) : (
                    <>{filteredNestedReplies.length} {filteredNestedReplies.length === 1 ? 'reply' : 'replies'}</>
                  )}
                </Button>
              )}
            </div>
            
            {showReplyForm && (
              <div className="mt-3">
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
              <div className="mt-3">
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