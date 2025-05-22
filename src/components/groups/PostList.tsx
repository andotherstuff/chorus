import { useNostr } from "@/hooks/useNostr";
import { useState, useEffect } from "react"; // Added useEffect
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
import { MessageSquare, Share2, CheckCircle, XCircle, Shield, MoreHorizontal, Ban, ChevronDown, ChevronUp } from "lucide-react";
import { EmojiReactionButton } from "@/components/EmojiReactionButton";
import { NutzapButton } from "@/components/groups/NutzapButton";
import { NutzapList } from "@/components/groups/NutzapList";
import { NostrEvent } from "@nostrify/nostrify";
import { nip19 } from 'nostr-tools';
import { NoteContent } from "../NoteContent";
import { Link } from "react-router-dom";
import { parseNostrAddress } from "@/lib/nostr-utils";
import { ReplyList } from "./ReplyList";
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
  pendingOnly?: boolean;
  onPostCountChange?: (count: number) => void; // New prop for tracking post count
}

export function PostList({ communityId, showOnlyApproved = false, pendingOnly = false, onPostCountChange }: PostListProps) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { bannedUsers } = useBannedUsers(communityId);
  
  // Query for approved posts
  const { data: approvedPosts, isLoading: isLoadingApproved } = useQuery({
    queryKey: ["approved-posts", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      const approvals = await nostr.query([{ 
        kinds: [4550],
        "#a": [communityId],
        limit: 50,
      }], { signal });
      
      // Extract the approved posts from the content field and filter out replies
      return approvals.map(approval => {
        try {
          // Get the kind tag to check if it's a reply
          const kindTag = approval.tags.find(tag => tag[0] === "k");
          const kind = kindTag ? parseInt(kindTag[1]) : null;
          
          // Skip this approval if it's for a reply (kind 1111)
          if (kind === 1111) {
            return null;
          }
          
          const approvedPost = JSON.parse(approval.content) as NostrEvent;
          
          // Skip if the post itself is a reply
          if (approvedPost.kind === 1111) {
            return null;
          }
          
          // Add the approval information
          return {
            ...approvedPost,
            approval: {
              id: approval.id,
              pubkey: approval.pubkey,
              created_at: approval.created_at,
              kind: kind || approvedPost.kind
            }
          };
        } catch (error) {
          console.error("Error parsing approved post:", error);
          return null;
        }
      }).filter((post): post is NostrEvent & { 
        approval: { id: string; pubkey: string; created_at: number; kind: number } 
      } => post !== null);
      
      // Debug logging
      console.log("Filtered approved posts:", {
        totalApprovedPosts: approvedPosts.length
      });
      
      return approvedPosts;
    },
    enabled: !!nostr && !!communityId,
  });
  
  // Query for removed posts
  const { data: removedPosts } = useQuery({
    queryKey: ["removed-posts", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      const removals = await nostr.query([{ 
        kinds: [4551],
        "#a": [communityId],
        limit: 50,
      }], { signal });
      
      return removals.map(removal => {
        const eventTag = removal.tags.find(tag => tag[0] === "e");
        return eventTag ? eventTag[1] : null;
      }).filter((id): id is string => id !== null);
    },
    enabled: !!nostr && !!communityId,
  });
  
  // Query for pending posts
  const { data: pendingPosts, isLoading: isLoadingPending } = useQuery({
    queryKey: ["pending-posts", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const posts = await nostr.query([{ 
        kinds: [11],
        "#a": [communityId],
        limit: 50,
      }], { signal });
      
      // Filter out replies (kind 1111) and any posts with a parent reference
      const filteredPosts = posts.filter(post => {
        // Exclude posts with kind 1111 (replies)
        if (post.kind === 1111) {
          return false;
        }
        
        // Exclude posts that have an 'e' tag with a 'reply' marker
        // This checks for posts that are replies to other posts
        const replyTags = post.tags.filter(tag => 
          tag[0] === 'e' && (tag[3] === 'reply' || tag[3] === 'root')
        );
        
        return replyTags.length === 0;
      });
      
      // Debug logging
      console.log("Filtered posts:", {
        totalPosts: posts.length,
        filteredPosts: filteredPosts.length,
        removedReplies: posts.length - filteredPosts.length
      });
      
      return filteredPosts;
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
  
  const approvedMembers = approvedMembersEvents?.flatMap(event => 
    event.tags.filter(tag => tag[0] === "p").map(tag => tag[1])
  ) || [];
  
  const moderators = communityEvent?.tags
    .filter(tag => tag[0] === "p" && tag[3] === "moderator")
    .map(tag => tag[1]) || [];
    
  const isUserModerator = Boolean(user && moderators.includes(user.pubkey));
  
  const allPosts = [...(approvedPosts || []), ...(pendingPosts || [])];
  
  const uniquePosts = allPosts.filter((post, index, self) => 
    index === self.findIndex(p => p.id === post.id)
  );
  
  const removedPostIds = removedPosts || [];
  const postsWithoutRemoved = uniquePosts.filter(post => 
    !removedPostIds.includes(post.id) && 
    !bannedUsers.includes(post.pubkey) 
  );
  
  const processedPosts = postsWithoutRemoved.map(post => {
    // If post already has approval info, return it as is
    if ('approval' in post) return post;
    
    // Check if this is a reply by looking at the kind or tags
    const isReply = post.kind === 1111 || post.tags.some(tag => 
      tag[0] === 'e' && (tag[3] === 'reply' || tag[3] === 'root')
    );
    
    // If it's a reply, don't auto-approve it as a top-level post
    if (isReply) return post;
    
    // Auto-approve for approved members and moderators
    const isApprovedMember = approvedMembers.includes(post.pubkey);
    const isModerator = moderators.includes(post.pubkey);
    if (isApprovedMember || isModerator) {
      return {
        ...post,
        approval: {
          id: `auto-approved-${post.id}`,
          pubkey: post.pubkey,
          created_at: post.created_at,
          autoApproved: true,
          kind: post.kind
        }
      };
    }
    return post;
  });
  
  // Count approved and pending posts
  const pendingCount = processedPosts.filter(post => !('approval' in post)).length;
  const approvedCount = processedPosts.length - pendingCount;
  
  // Filter posts based on approval status
  let filteredPosts = processedPosts;
  
  if (showOnlyApproved) {
    // Show only approved posts
    filteredPosts = processedPosts.filter(post => 'approval' in post);
  } else if (pendingOnly) {
    // Show only pending posts (not auto-approved and not manually approved)
    filteredPosts = processedPosts.filter(post => {
      // If it has an approval property, it's either manually approved or auto-approved
      if ('approval' in post) {
        return false;
      }
      return true;
    });
  }
  
  const sortedPosts = filteredPosts.sort((a, b) => b.created_at - a.created_at);

  useEffect(() => {
    if (onPostCountChange) {
      onPostCountChange(sortedPosts.length);
    }
  }, [sortedPosts, onPostCountChange]);

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
            ? "No approved posts in this group yet" 
            : pendingOnly
              ? "No pending posts in this group"
              : "No posts in this group yet"}
        </p>
        <p className="text-sm">
          {showOnlyApproved && pendingCount > 0
            ? `There are ${pendingCount} pending posts waiting for approval.`
            : pendingOnly
              ? "All posts have been approved or removed."
              : "Be the first to post something!"}
        </p>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
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

// LikeButton has been replaced with EmojiReactionButton

interface PostItemProps {
  post: NostrEvent & {
    approval?: {
      id: string;
      pubkey: string;
      created_at: number;
      autoApproved?: boolean;
      kind: number;
    }
  };
  communityId: string;
  isApproved: boolean;
  isModerator: boolean;
}

function PostItem({ post, communityId, isApproved, isModerator }: PostItemProps) {
  const author = useAuthor(post.pubkey);
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish({
    invalidateQueries: [
      { queryKey: ["approved-posts", communityId] },
      { queryKey: ["pending-posts", communityId] },
      { queryKey: ["pending-posts-count", communityId] }
    ]
  });
  const { banUser } = useBannedUsers(communityId);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [isBanDialogOpen, setIsBanDialogOpen] = useState(false);
  const [showReplies, setShowReplies] = useState(false);

  const metadata = author.data?.metadata;
  const displayName = metadata?.name || post.pubkey.slice(0, 12);
  const profileImage = metadata?.picture;

  const authorNip05 = metadata?.nip05;
  let authorIdentifier = authorNip05 || post.pubkey;
  if (!authorNip05 && post.pubkey.match(/^[0-9a-fA-F]{64}$/)) {
      try {
          const npub = nip19.npubEncode(post.pubkey);
          authorIdentifier = `${npub.slice(0,10)}...${npub.slice(-4)}`;
      } catch (e) {
          authorIdentifier = `${post.pubkey.slice(0,8)}...${post.pubkey.slice(-4)}`;
      }
  } else if (!authorNip05) {
    authorIdentifier = `${post.pubkey.slice(0,8)}...${post.pubkey.slice(-4)}`;
  }

  const postDate = new Date(post.created_at * 1000);
  const formattedTimestamp = postDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  }) + ', ' + postDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });

  const handleApprovePost = async () => {
    if (!user) {
      toast.error("You must be logged in to approve posts");
      return;
    }
    try {
      await publishEvent({
        kind: 4550,
        tags: [["a", communityId], ["e", post.id], ["p", post.pubkey], ["k", String(post.kind)]],
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
      await publishEvent({
        kind: 4551,
        tags: [["a", communityId], ["e", post.id], ["p", post.pubkey], ["k", String(post.kind)]],
        content: JSON.stringify({ reason: "Removed by moderator", timestamp: Date.now(), post: post }),
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
      await banUser(post.pubkey);
      toast.success("User banned successfully!");
      setIsBanDialogOpen(false);
    } catch (error) {
      console.error("Error banning user:", error);
      toast.error("Failed to ban user. Please try again.");
    }
  };

  return (
    <div className="py-2.5 px-3 hover:bg-muted/10 transition-colors rounded-md border border-transparent hover:border-border/30">
      <div className="flex flex-row items-start gap-2.5"> 
        <Link to={`/profile/${post.pubkey}`} className="flex-shrink-0">
          <Avatar className="h-9 w-9 cursor-pointer hover:opacity-80 transition-opacity rounded-md">
            <AvatarImage src={profileImage} alt={displayName} />
            <AvatarFallback>{displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <Link to={`/profile/${post.pubkey}`} className="hover:underline">
                <span className="font-semibold text-sm leading-tight block">{displayName}</span> 
              </Link>
              <div className="flex items-center text-xs text-muted-foreground mt-0 flex-wrap">
                <span className="mr-1.5 hover:underline cursor-help" title={post.pubkey}>@{authorIdentifier}</span>
                <span className="mr-1.5">·</span>
                <span className="mr-1.5 whitespace-nowrap">{formattedTimestamp}</span>
                {isApproved ? (
                  <span className="text-green-600 dark:text-green-400 flex items-center whitespace-nowrap">
                    <CheckCircle className="h-3 w-3 mr-0.5 flex-shrink-0" />
                    {post.approval?.autoApproved ? 'Auto-ok' : 'Ok'} 
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center whitespace-nowrap">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mr-1 flex-shrink-0"></span>
                    Pending
                  </span>
                )}
              </div>
            </div>
            
            {isModerator && (
              <div className="flex items-center gap-0.5 ml-1 flex-shrink-0">
                {!isApproved && (
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={handleApprovePost}
                    className="text-green-600 h-6 w-6"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> 
                    <span className="sr-only">Approve</span>
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                      <Shield className="h-3.5 w-3.5" />
                      <span className="sr-only">Moderate</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!isApproved && (
                      <DropdownMenuItem onClick={handleApprovePost} className="text-xs">
                        <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Approve Post
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setIsRemoveDialogOpen(true)} className="text-red-600 text-xs">
                      <XCircle className="h-3.5 w-3.5 mr-1.5" /> Remove Post
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsBanDialogOpen(true)} className="text-red-600 text-xs">
                      <Ban className="h-3.5 w-3.5 mr-1.5" /> Ban User
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
                  <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove Post</AlertDialogTitle><AlertDialogDescription>Are you sure you want to remove this post? This action will hide the post from the group.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleRemovePost} className="bg-red-600 hover:bg-red-700">Remove Post</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                </AlertDialog>
                <AlertDialog open={isBanDialogOpen} onOpenChange={setIsBanDialogOpen}>
                  <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Ban User</AlertDialogTitle><AlertDialogDescription>Are you sure you want to ban this user? They will no longer be able to post in this group, and all their existing posts will be hidden.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleBanUser} className="bg-red-600 hover:bg-red-700">Ban User</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Section - indented to align with text below author name */}
      <div className="pt-1 pb-1.5 pl-[calc(2.25rem+0.625rem)]">
        <div className="whitespace-pre-wrap break-words text-sm">
          <NoteContent event={post} />
        </div>
      </div>

      {/* Footer Section - indented similarly */}
      <div className="flex-col pt-1.5 pl-[calc(2.25rem+0.625rem)]">
        <div className="flex items-center gap-1 w-full">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground hover:text-foreground flex items-center h-7 px-1.5"
            onClick={() => setShowReplies(!showReplies)}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            <span className="text-xs">{showReplies ? "Hide" : "Reply"}</span>
            {showReplies ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
          </Button>
          <EmojiReactionButton postId={post.id} /> 
          <NutzapButton postId={post.id} authorPubkey={post.pubkey} />
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground flex items-center h-7 px-1.5">
            <Share2 className="h-3.5 w-3.5 mr-1" />
            <span className="text-xs">Share</span>
          </Button>
        </div>
        
        {/* Display nutzaps for this post */}
        <NutzapList postId={post.id} />
        
        {showReplies && (
          <div className="w-full mt-2.5">
            <ReplyList 
              postId={post.id} 
              communityId={communityId} 
              postAuthorPubkey={post.pubkey} 
            />
          </div>
        )}
      </div>
    </div>
  );
}
