import { useNostr } from "@/hooks/useNostr";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useBannedUsers } from "@/hooks/useBannedUsers";
import { toast } from "sonner";
import { Heart, MessageSquare, Share2, CheckCircle, XCircle, Shield, MoreHorizontal, Ban } from "lucide-react";
import { NostrEvent } from "@nostrify/nostrify";
import { NoteContent } from "../NoteContent";
import { Link } from "react-router-dom";
import { parseNostrAddress } from "@/lib/nostr-utils";
import { ReplyList } from "./ReplyList";
import { CreateReplyForm } from "./CreateReplyForm";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PostListProps {
  communityId: string;
  showOnlyApproved?: boolean;
}

export function PostList({ communityId, showOnlyApproved = false }: PostListProps) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { bannedUsers } = useBannedUsers(communityId);
  
  // Query for approved posts
  const { data: approvedPosts, isLoading: isLoadingApproved } = useQuery({
    queryKey: ["approved-posts", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Get approval events
      const approvals = await nostr.query([{ 
        kinds: [4550],
        "#a": [communityId],
        limit: 50,
      }], { signal });
      
      // Extract the approved posts from the content field
      return approvals.map(approval => {
        try {
          // Parse the approved post from the content
          const approvedPost = JSON.parse(approval.content) as NostrEvent;
          // Add the approval information
          return {
            ...approvedPost,
            approval: {
              id: approval.id,
              pubkey: approval.pubkey,
              created_at: approval.created_at,
            }
          };
        } catch (error) {
          console.error("Error parsing approved post:", error);
          return null;
        }
      }).filter((post): post is NostrEvent & { 
        approval: { id: string; pubkey: string; created_at: number } 
      } => post !== null);
    },
    enabled: !!nostr && !!communityId,
  });
  
  // Query for removed posts
  const { data: removedPosts } = useQuery({
    queryKey: ["removed-posts", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Get removal events
      const removals = await nostr.query([{ 
        kinds: [4551],
        "#a": [communityId],
        limit: 50,
      }], { signal });
      
      // Extract the post IDs that have been removed
      return removals.map(removal => {
        const eventTag = removal.tags.find(tag => tag[0] === "e");
        return eventTag ? eventTag[1] : null;
      }).filter((id): id is string => id !== null);
    },
    enabled: !!nostr && !!communityId,
  });
  
  // Query for pending posts (posts that tag the community but don't have approvals yet)
  const { data: pendingPosts, isLoading: isLoadingPending } = useQuery({
    queryKey: ["pending-posts", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Get posts that tag the community (both regular posts and replies)
      const posts = await nostr.query([{ 
        kinds: [1],
        "#a": [communityId],
        limit: 50,
      }], { signal });
      
      return posts;
    },
    enabled: !!nostr && !!communityId,
  });
  
  // Query for approved members list
  const { data: approvedMembersEvents } = useQuery({
    queryKey: ["approved-members-list", communityId],
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
  
  // Query for community details to get moderators
  const { data: communityEvent } = useQuery({
    queryKey: ["community-details", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Parse the community ID to get the pubkey and identifier
      const parsedId = communityId.includes(':') 
        ? parseNostrAddress(communityId)
        : null;
      
      if (!parsedId) return null;
      
      const events = await nostr.query([{ 
        kinds: [34550],
        authors: [parsedId.pubkey],
        "#d": [parsedId.identifier],
      }], { signal });
      
      return events[0] || null;
    },
    enabled: !!nostr && !!communityId,
  });
  
  // Extract approved members pubkeys
  const approvedMembers = approvedMembersEvents?.flatMap(event => 
    event.tags.filter(tag => tag[0] === "p").map(tag => tag[1])
  ) || [];
  
  // Extract moderator pubkeys
  const moderators = communityEvent?.tags
    .filter(tag => tag[0] === "p" && tag[3] === "moderator")
    .map(tag => tag[1]) || [];
    
  // Check if current user is a moderator
  const isUserModerator = Boolean(user && moderators.includes(user.pubkey));
  
  // Combine and sort all posts
  const allPosts = [...(approvedPosts || []), ...(pendingPosts || [])];
  
  // Remove duplicates (posts that are both in pending and approved)
  const uniquePosts = allPosts.filter((post, index, self) => 
    index === self.findIndex(p => p.id === post.id)
  );
  
  // Filter out removed posts and posts from banned users
  const removedPostIds = removedPosts || [];
  const postsWithoutRemoved = uniquePosts.filter(post => 
    !removedPostIds.includes(post.id) && 
    !bannedUsers.includes(post.pubkey) // Filter out posts from banned users
  );
  
  // Process posts to mark auto-approved ones
  const processedPosts = postsWithoutRemoved.map(post => {
    // If it's already approved, keep it as is
    if ('approval' in post) {
      return post;
    }
    
    // Auto-approve if author is an approved member or moderator
    const isApprovedMember = approvedMembers.includes(post.pubkey);
    const isModerator = moderators.includes(post.pubkey);
    
    if (isApprovedMember || isModerator) {
      return {
        ...post,
        approval: {
          id: `auto-approved-${post.id}`,
          pubkey: post.pubkey,
          created_at: post.created_at,
          autoApproved: true
        }
      };
    }
    
    return post;
  });
  
  // Count approved and pending posts
  const approvedCount = processedPosts.filter(post => 'approval' in post).length;
  const pendingCount = processedPosts.length - approvedCount;
  
  // Filter posts based on approval status if showOnlyApproved is true
  const filteredPosts = showOnlyApproved 
    ? processedPosts.filter(post => 'approval' in post)
    : processedPosts;
  
  // Sort by created_at (newest first)
  const sortedPosts = filteredPosts.sort((a, b) => b.created_at - a.created_at);
  
  if (isLoadingApproved || isLoadingPending) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </CardHeader>
            <CardContent className="pb-2">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
            <CardFooter>
              <div className="flex gap-4">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }
  
  if (sortedPosts.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground mb-2">
          {showOnlyApproved 
            ? "No approved posts in this community yet" 
            : "No posts in this community yet"}
        </p>
        <p className="text-sm">
          {showOnlyApproved && pendingCount > 0
            ? `There are ${pendingCount} pending posts waiting for approval.`
            : "Be the first to post something!"}
        </p>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-muted-foreground">
          Showing {sortedPosts.length} {showOnlyApproved ? "approved" : ""} posts
        </div>
        
        <div className="flex gap-3 text-sm">
          <span className="flex items-center">
            <span className="h-2 w-2 rounded-full bg-green-500 mr-1"></span>
            {approvedCount} approved
          </span>
          {!showOnlyApproved && pendingCount > 0 && (
            <span className="flex items-center">
              <span className="h-2 w-2 rounded-full bg-amber-500 mr-1"></span>
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>
      
      {sortedPosts.map((post) => (
        <PostItem 
          key={post.id} 
          post={post} 
          communityId={communityId}
          isApproved={'approval' in post}
          isModerator={isUserModerator}
        />
      ))}
    </div>
  );
}

interface PostItemProps {
  post: NostrEvent & { 
    approval?: { 
      id: string; 
      pubkey: string; 
      created_at: number;
      autoApproved?: boolean;
    } 
  };
  communityId: string;
  isApproved: boolean;
  isModerator: boolean;
}

function PostItem({ post, communityId, isApproved, isModerator }: PostItemProps) {
  const { nostr } = useNostr();
  const author = useAuthor(post.pubkey);
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { banUser } = useBannedUsers(communityId);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [isBanDialogOpen, setIsBanDialogOpen] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyCount, setReplyCount] = useState(0);
  
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || post.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  
  // Query for reply count
  const { data: replies, refetch: refetchReplies } = useQuery({
    queryKey: ["reply-count", post.id],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      // Get replies (kind 1111) that reference this post
      const replyEvents = await nostr.query([{ 
        kinds: [1111],
        "#e": [post.id],
        "#a": [communityId],
        limit: 100,
      }], { signal });
      
      setReplyCount(replyEvents.length);
      return replyEvents;
    },
    enabled: !!nostr && !!post.id,
  });
  
  const handleApprovePost = async () => {
    if (!user) {
      toast.error("You must be logged in to approve posts");
      return;
    }
    
    try {
      // Create approval event (kind 4550)
      await publishEvent({
        kind: 4550,
        tags: [
          ["a", communityId],
          ["e", post.id],
          ["p", post.pubkey],
          ["k", "1"], // Post kind
        ],
        content: JSON.stringify(post),
      });
      
      toast.success("Post approved successfully!");
    } catch (error) {
      console.error("Error approving post:", error);
      toast.error("Failed to approve post. Please try again.");
    }
  };
  
  const handleRemovePost = async () => {
    if (!user) {
      toast.error("You must be logged in to remove posts");
      return;
    }
    
    try {
      // Create removal event (kind 4551)
      await publishEvent({
        kind: 4551,
        tags: [
          ["a", communityId],
          ["e", post.id],
          ["p", post.pubkey],
          ["k", "1"], // Post kind
        ],
        content: JSON.stringify({
          reason: "Removed by moderator",
          timestamp: Date.now(),
          post: post // Include the original post for reference
        }),
      });
      
      toast.success("Post removed successfully!");
      setIsRemoveDialogOpen(false);
    } catch (error) {
      console.error("Error removing post:", error);
      toast.error("Failed to remove post. Please try again.");
    }
  };
  
  const handleBanUser = async () => {
    if (!user) {
      toast.error("You must be logged in to ban users");
      return;
    }
    
    try {
      // Ban the user
      await banUser(post.pubkey);
      
      toast.success("User banned successfully!");
      setIsBanDialogOpen(false);
    } catch (error) {
      console.error("Error banning user:", error);
      toast.error("Failed to ban user. Please try again.");
    }
  };
  
  const handleReplyCreated = () => {
    // Refetch replies to update the count and list
    refetchReplies();
  };
  
  const toggleReplyForm = () => {
    setShowReplyForm(prev => !prev);
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4 pb-2">
        <Link to={`/profile/${post.pubkey}`}>
          <Avatar className="cursor-pointer hover:opacity-80 transition-opacity">
            <AvatarImage src={profileImage} />
            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <Link to={`/profile/${post.pubkey}`} className="hover:underline">
                <p className="font-semibold">{displayName}</p>
              </Link>
              <div className="flex items-center text-xs text-muted-foreground">
                <span>{new Date(post.created_at * 1000).toLocaleString()}</span>
                {isApproved ? (
                  <span className="ml-2 text-green-600 dark:text-green-400 flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {post.approval?.autoApproved ? 'Auto-approved' : 'Approved'}
                  </span>
                ) : (
                  <span className="ml-2 text-amber-600 dark:text-amber-400 flex items-center">
                    <span className="h-2 w-2 rounded-full bg-amber-500 mr-1"></span>
                    Pending approval
                  </span>
                )}
              </div>
            </div>
            
            {isModerator && (
              <div className="flex items-center gap-2">
                {!isApproved && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleApprovePost}
                    className="text-green-600"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                )}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Shield className="h-4 w-4 mr-1" />
                      <span className="sr-only md:not-sr-only md:inline-block">Moderate</span>
                      <MoreHorizontal className="h-4 w-4 md:hidden" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!isApproved && (
                      <DropdownMenuItem onClick={handleApprovePost}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve Post
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      onClick={() => setIsRemoveDialogOpen(true)}
                      className="text-red-600"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Remove Post
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setIsBanDialogOpen(true)}
                      className="text-red-600"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Ban User
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Post</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove this post? This action will hide the post from the community.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleRemovePost}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Remove Post
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                <AlertDialog open={isBanDialogOpen} onOpenChange={setIsBanDialogOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Ban User</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to ban this user? They will no longer be able to post in this community, and all their existing posts will be hidden.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleBanUser}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Ban User
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        <div className="whitespace-pre-wrap break-words">
          <NoteContent event={post} className="text-sm" />
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col w-full">
        <div className="flex gap-4 w-full">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Heart className="h-4 w-4 mr-2" />
            Like
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`${showReplyForm ? 'bg-muted' : ''} text-muted-foreground`}
            onClick={toggleReplyForm}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            {replyCount > 0 ? `Comment (${replyCount})` : 'Comment'}
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
        
        {/* Show replies if they exist */}
        {replyCount > 0 && <ReplyList postId={post.id} communityId={communityId} />}
        
        {/* Show reply form if comment button was clicked */}
        {showReplyForm && (
          user ? (
            <CreateReplyForm 
              postId={post.id} 
              communityId={communityId} 
              postAuthorPubkey={post.pubkey}
              onReplyCreated={handleReplyCreated}
            />
          ) : (
            <div className="pl-6 border-l-2 border-muted mt-2 text-sm text-muted-foreground">
              You need to be logged in to comment.
            </div>
          )
        )}
      </CardFooter>
    </Card>
  );
}