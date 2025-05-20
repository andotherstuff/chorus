import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { toast } from "sonner";
import { Heart, MessageSquare, Share2, CheckCircle, TrendingUp, Clock, Star } from "lucide-react";
import { NostrEvent } from "@nostrify/nostrify";
import { NoteContent } from "../NoteContent";
import { Link } from "react-router-dom";
import { parseNostrAddress } from "@/lib/nostr-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

type SortOption = "newest" | "oldest" | "popular" | "trending";
type FilterOption = "all" | "approved" | "pending";

interface PostListProps {
  communityId: string;
  showOnlyApproved?: boolean;
}

export function PostList({ communityId, showOnlyApproved = false }: PostListProps) {
  const { nostr } = useNostr();
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterBy, setFilterBy] = useState<FilterOption>(showOnlyApproved ? "approved" : "all");
  
  // Query for likes and reactions
  const { data: reactions, isLoading: isLoadingReactions } = useQuery({
    queryKey: ["post-reactions", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Get reaction events (likes = kind 7, comments = kind 1 with 'e' tag)
      const likes = await nostr.query([{ 
        kinds: [7], // Reaction events
        "#a": [communityId],
        limit: 500,
      }], { signal });
      
      const comments = await nostr.query([{ 
        kinds: [1], // Comment notes 
        "#a": [communityId],
        limit: 500,
      }], { signal });
      
      // Process and count reactions by post ID
      const reactionCounts: Record<string, { likes: number; comments: number; shares: number }> = {};
      
      // Count likes
      likes.forEach(like => {
        // Get the post ID from the 'e' tag
        const postTag = like.tags.find(tag => tag[0] === 'e');
        if (postTag) {
          const postId = postTag[1];
          reactionCounts[postId] = reactionCounts[postId] || { likes: 0, comments: 0, shares: 0 };
          reactionCounts[postId].likes++;
        }
      });
      
      // Count comments
      comments.forEach(comment => {
        // Get the post ID from the 'e' tag (direct reply)
        const replyTag = comment.tags.find(tag => tag[0] === 'e');
        if (replyTag) {
          const postId = replyTag[1];
          reactionCounts[postId] = reactionCounts[postId] || { likes: 0, comments: 0, shares: 0 };
          reactionCounts[postId].comments++;
        }
      });
      
      return reactionCounts;
    },
    enabled: !!nostr && !!communityId,
  });
  
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
          const postId = approvedPost.id;
          
          // Use actual reaction counts if available
          const postReactions = reactions?.[postId] || { 
            likes: 0, 
            comments: 0, 
            shares: 0 
          };
          
          // Add the approval information
          return {
            ...approvedPost,
            approval: {
              id: approval.id,
              pubkey: approval.pubkey,
              created_at: approval.created_at,
            },
            reactions: postReactions
          };
        } catch (error) {
          console.error("Error parsing approved post:", error);
          return null;
        }
      }).filter((post): post is NostrEvent & { 
        approval: { id: string; pubkey: string; created_at: number; autoApproved?: boolean };
        reactions: { likes: number; comments: number; shares: number };
      } => post !== null);
    },
    enabled: !!nostr && !!communityId && !!reactions,
  });
  
  // Query for pending posts
  const { data: pendingPosts, isLoading: isLoadingPending } = useQuery({
    queryKey: ["pending-posts", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Get posts that tag the community
      const posts = await nostr.query([{ 
        kinds: [1],
        "#a": [communityId],
        limit: 50,
      }], { signal });
      
      return posts.map(post => {
        const postId = post.id;
        
        // Use actual reaction counts if available
        const postReactions = reactions?.[postId] || { 
          likes: 0, 
          comments: 0, 
          shares: 0 
        };
        
        return {
          ...post,
          reactions: postReactions
        };
      });
    },
    enabled: !!nostr && !!communityId && !!reactions,
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
  
  // Combine and sort all posts
  const allPosts = [...(approvedPosts || []), ...(pendingPosts || [])];
  
  // Remove duplicates
  const uniquePosts = allPosts.filter((post, index, self) => 
    index === self.findIndex(p => p.id === post.id)
  );
  
  // Process posts to mark auto-approved ones
  const processedPosts = uniquePosts.map(post => {
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

  // Filter posts based on filterBy
  const filteredPosts = processedPosts.filter(post => {
    switch (filterBy) {
      case "approved":
        return 'approval' in post;
      case "pending":
        return !('approval' in post);
      default:
        return true;
    }
  });
  
  // Sort posts based on sortBy
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    switch (sortBy) {
      case "oldest":
        return a.created_at - b.created_at;
      case "popular":
        return (b.reactions?.likes || 0) - (a.reactions?.likes || 0);
      case "trending":
        // Simple trending algorithm: (likes + comments * 2) / hours since post
        const hoursA = (Date.now() / 1000 - a.created_at) / 3600;
        const hoursB = (Date.now() / 1000 - b.created_at) / 3600;
        const scoreA = ((a.reactions?.likes || 0) + (a.reactions?.comments || 0) * 2) / Math.max(hoursA, 1);
        const scoreB = ((b.reactions?.likes || 0) + (b.reactions?.comments || 0) * 2) / Math.max(hoursB, 1);
        return scoreB - scoreA;
      default: // "newest"
        return b.created_at - a.created_at;
    }
  });
  
  // Calculate statistics
  const stats = {
    total: uniquePosts.length,
    approved: processedPosts.filter(post => 'approval' in post).length,
    pending: processedPosts.filter(post => !('approval' in post)).length,
    totalLikes: uniquePosts.reduce((sum, post) => sum + (post.reactions?.likes || 0), 0),
    totalComments: uniquePosts.reduce((sum, post) => sum + (post.reactions?.comments || 0), 0),
    totalShares: uniquePosts.reduce((sum, post) => sum + (post.reactions?.shares || 0), 0),
  };
  
  if (isLoadingApproved || isLoadingPending || isLoadingReactions) {
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
          {filterBy === "approved" 
            ? "No approved posts in this community yet" 
            : filterBy === "pending"
            ? "No pending posts in this community"
            : "No posts in this community yet"}
        </p>
        <p className="text-sm">
          {filterBy === "approved" && stats.pending > 0
            ? `There are ${stats.pending} pending posts waiting for approval.`
            : "Be the first to post something!"}
        </p>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {stats.total} Posts
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1 bg-green-50 dark:bg-green-950">
              <CheckCircle className="h-3 w-3 text-green-600" />
              {stats.approved} Approved
            </Badge>
            {stats.pending > 0 && (
              <Badge variant="outline" className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950">
                <Clock className="h-3 w-3 text-amber-600" />
                {stats.pending} Pending
              </Badge>
            )}
            <Badge variant="outline" className="flex items-center gap-1">
              <Heart className="h-3 w-3 text-rose-600" />
              {stats.totalLikes} Likes
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-blue-600" />
              {stats.totalComments} Comments
            </Badge>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={filterBy} onValueChange={(value) => setFilterBy(value as FilterOption)}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue placeholder="Filter by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Posts</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Newest
                  </div>
                </SelectItem>
                <SelectItem value="oldest">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Oldest
                  </div>
                </SelectItem>
                <SelectItem value="popular">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Popular
                  </div>
                </SelectItem>
                <SelectItem value="trending">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Trending
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>
      
      <div className="space-y-4">
        {sortedPosts.map((post) => (
          <PostItem 
            key={post.id} 
            post={post} 
            communityId={communityId}
            isApproved={'approval' in post}
          />
        ))}
      </div>
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
    };
    reactions?: {
      likes: number;
      comments: number;
      shares: number;
    };
  };
  communityId: string;
  isApproved: boolean;
}

function PostItem({ post, communityId, isApproved }: PostItemProps) {
  const author = useAuthor(post.pubkey);
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || post.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  
  // Check if user is a moderator (for approving posts)
  const isModerator = user && post.tags
    .filter(tag => tag[0] === "p" && tag[3] === "moderator")
    .some(tag => tag[1] === user.pubkey);
  
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
            
            {user && isModerator && !isApproved && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleApprovePost}
              >
                Approve
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        <div className="whitespace-pre-wrap break-words">
          <NoteContent event={post} className="text-sm" />
        </div>
      </CardContent>
      
      <CardFooter>
        <div className="flex gap-4">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Heart className="h-4 w-4 mr-2" />
            Like {post.reactions && post.reactions.likes > 0 && `(${post.reactions.likes})`}
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <MessageSquare className="h-4 w-4 mr-2" />
            Comment {post.reactions && post.reactions.comments > 0 && `(${post.reactions.comments})`}
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Share2 className="h-4 w-4 mr-2" />
            Share {post.reactions && post.reactions.shares > 0 && `(${post.reactions.shares})`}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}