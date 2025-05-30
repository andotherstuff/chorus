import { useNostr } from "@/hooks/useNostr";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/ui/Header";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { NoteContent } from "@/components/NoteContent";
import { EmojiReactionButton } from "@/components/EmojiReactionButton";
import { formatRelativeTime } from "@/lib/utils";
import { ArrowLeft, Hash, MessageSquare, MoreVertical, Flag, Share2, Users, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import type { NostrEvent } from "@nostrify/nostrify";
import { nip19 } from "nostr-tools";
import { shareContent } from "@/lib/share";
import { ReplyList } from "@/components/groups/ReplyList";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KINDS } from "@/lib/nostr-kinds";
import { useIsGroupDeleted } from "@/hooks/useGroupDeletionRequests";

export default function Hashtag() {
  const { hashtag } = useParams<{ hashtag: string }>();
  const navigate = useNavigate();
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  // Query for posts containing this hashtag
  const { data: posts, isLoading: isLoadingPosts, error } = useQuery({
    queryKey: ["hashtag-posts", hashtag],
    queryFn: async (c) => {
      if (!hashtag) return [];
      
      try {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);
        
        // Search for posts with the hashtag in multiple ways:
        // 1. As a 't' tag (standardized way per NIP-12)
        // 2. In the content text itself (for compatibility with older posts)
        const [taggedPosts, contentPosts] = await Promise.all([
          // Query for posts with hashtag as a 't' tag
          nostr.query([{
            kinds: [KINDS.TEXT_NOTE, KINDS.GROUP_POST], // text notes and community posts
            "#t": [hashtag.toLowerCase()], 
            limit: 50
          }], { signal }),
          
          // Query for posts containing hashtag in content
          // Note: This is less efficient but catches posts without proper tagging
          nostr.query([{
            kinds: [KINDS.TEXT_NOTE, KINDS.GROUP_POST],
            search: `#${hashtag}`,
            limit: 30
          }], { signal }).catch(() => []) // Some relays may not support search
        ]);

        // Combine results and deduplicate
        const allPosts = [...taggedPosts, ...contentPosts];
        const uniquePosts = allPosts.filter((post, index, self) =>
          index === self.findIndex(p => p.id === post.id)
        );

        // Further filter posts that actually contain the hashtag in content
        const filteredPosts = uniquePosts.filter(post => {
          const content = post.content.toLowerCase();
          const hashtagPattern = new RegExp(`#${hashtag.toLowerCase()}\\b`, 'i');
          return hashtagPattern.test(content) || 
                 post.tags.some(tag => tag[0] === 't' && tag[1] && tag[1].toLowerCase() === hashtag.toLowerCase());
        });

        return filteredPosts;
      } catch (error) {
        console.error("Error fetching hashtag posts:", error);
        return [];
      }
    },
    enabled: !!hashtag && !!nostr,
    retry: 2,
    retryDelay: 1000,
    staleTime: 60000, // 1 minute
  });

  // Sort posts by creation time (newest first)
  const sortedPosts = useMemo(() => {
    if (!posts) return [];
    return [...posts].sort((a, b) => b.created_at - a.created_at);
  }, [posts]);

  // Loading skeleton
  const renderSkeletons = () => (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="border-b border-border/70 py-4">
          <div className="flex items-start gap-3 px-3">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full mt-3 mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-4 mt-4">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-6 w-12" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  if (!hashtag) {
    return (
      <div className="container mx-auto py-4 px-4">
        <Header />
        <div className="text-center py-8">
          <h1 className="text-2xl font-bold text-red-500">Invalid hashtag</h1>
          <p className="text-muted-foreground mt-2">The hashtag parameter is missing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 px-4">
      <Header />
      
      {/* Header Section - Removed duplicate hashtag icon */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6 mt-2">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Go back</span>
          </Button>
          
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold flex items-center">
              <Hash className="h-6 w-6 text-blue-500 mr-1" />
              {hashtag}
            </h1>
          </div>
        </div>

        <div className="flex justify-end">
          <a 
            href="/trending" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Trending Hashtags
          </a>
        </div>
      </div>

      {/* Stats Section */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-sm">
            {isLoadingPosts ? "Loading..." : `${sortedPosts.length} post${sortedPosts.length !== 1 ? 's' : ''}`}
          </Badge>
        </div>
      </div>

      {/* Posts Section */}
      <div>
        {isLoadingPosts ? (
          renderSkeletons()
        ) : error ? (
          <Card className="p-8 text-center">
            <h2 className="text-xl font-semibold text-red-500 mb-2">Error loading posts</h2>
            <p className="text-muted-foreground">
              There was an error fetching posts for this hashtag. Please try again later.
            </p>
          </Card>
        ) : sortedPosts.length === 0 ? (
          <Card className="p-8 text-center">
            <Hash className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No posts found</h2>
            <p className="text-muted-foreground mb-4">
              No posts containing <span className="font-semibold">#{hashtag}</span> were found.
            </p>
            <p className="text-sm text-muted-foreground">
              Be the first to post something with this hashtag!
            </p>
          </Card>
        ) : (
          sortedPosts.map((post) => (
            <HashtagPostItem key={post.id} post={post} hashtag={hashtag} />
          ))
        )}
      </div>
    </div>
  );
}

// Individual post component for hashtag feed
interface HashtagPostItemProps {
  post: NostrEvent;
  hashtag: string;
}

function HashtagPostItem({ post, hashtag }: HashtagPostItemProps) {
  const author = useAuthor(post.pubkey);
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || post.pubkey.slice(0, 12);
  const profileImage = metadata?.picture;
  const [showReplies, setShowReplies] = useState(false);

  // Format author identifier
  const authorIdentifier = useMemo(() => {
    const authorNip05 = metadata?.nip05;
    if (authorNip05) return authorNip05;
    
    if (post.pubkey.match(/^[0-9a-fA-F]{64}$/)) {
      try {
        const npub = nip19.npubEncode(post.pubkey);
        return `${npub.slice(0, 10)}...${npub.slice(-4)}`;
      } catch (e) {
        return `${post.pubkey.slice(0, 8)}...${post.pubkey.slice(-4)}`;
      }
    }
    return `${post.pubkey.slice(0, 8)}...${post.pubkey.slice(-4)}`;
  }, [post.pubkey, metadata?.nip05]);

  // Format timestamps
  const relativeTime = formatRelativeTime(post.created_at);
  const postDate = new Date(post.created_at * 1000);
  const formattedAbsoluteTime = `${postDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })} ${postDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  })}`;

  // Extract community information if available (NIP-72 format)
  const communityInfo = useMemo(() => {
    // Find community information from post tags (NIP-72 format)
    const communityTag = post.tags.find(tag => tag[0] === 'a' && tag.length >= 2);
    if (!communityTag) return null;

    const communityId = communityTag[1];
    
    return { id: communityId };
  }, [post.tags]);

  // Query for community details to get the name
  const { data: community } = useQuery({
    queryKey: ["community-for-hashtag", communityInfo?.id],
    queryFn: async (c) => {
      if (!communityInfo?.id) return null;
      
      // Parse the community ID (format: "34550:pubkey:identifier")
      const parts = communityInfo.id.split(':');
      if (parts.length !== 3 || parts[0] !== '34550') return null;
      
      const [, pubkey, identifier] = parts;
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      const events = await nostr.query([{
        kinds: [KINDS.GROUP],
        authors: [pubkey],
        "#d": [identifier]
      }], { signal });

      return events[0] || null;
    },
    enabled: !!nostr && !!communityInfo?.id,
    staleTime: 300000, // 5 minutes
  });

  // Check if the community has been deleted
  const { isDeleted: isCommunityDeleted } = useIsGroupDeleted(communityInfo?.id);

  // Extract community name from the community event
  const communityName = useMemo(() => {
    if (!community) return null;
    
    // If the community has been deleted, return "Deleted"
    if (isCommunityDeleted) return "Deleted";
    
    const nameTag = community.tags.find(tag => tag[0] === "name");
    return nameTag ? nameTag[1] : null;
  }, [community, isCommunityDeleted]);

  // Handle sharing the post
  const handleSharePost = async (postId: string) => {
    try {
      // Create nevent identifier for the post with relay hint
      const nevent = nip19.neventEncode({
        id: post.id,
        author: post.pubkey,
        kind: post.kind,
        relays: ["wss://relay.chorus.community"],
      });
      
      // Create njump.me URL
      const shareUrl = `https://njump.me/${nevent}`;
      
      await shareContent({
        title: "Check out this post",
        text: post.content.slice(0, 100) + (post.content.length > 100 ? "..." : ""),
        url: shareUrl
      });
      
      toast.success("Post link copied to clipboard");
    } catch (error) {
      console.error("Error creating share URL:", error);
      // Fallback to the original URL format
      const shareUrl = `${window.location.origin}/e/${post.id}`;
      
      await shareContent({
        title: "Check out this post",
        text: post.content.slice(0, 100) + (post.content.length > 100 ? "..." : ""),
        url: shareUrl
      });
      
      toast.success("Post link copied to clipboard");
    }
  };

  return (
    <div className="py-4 hover:bg-muted/5 transition-colors border-b border-border/70">
      <div className="flex flex-row items-start px-3">
        <Link to={`/profile/${post.pubkey}`} className="flex-shrink-0 mr-2.5">
          <Avatar className="h-9 w-9 cursor-pointer hover:opacity-80 transition-opacity rounded-md">
            <AvatarImage src={profileImage} alt={displayName} />
            <AvatarFallback>{displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <Link to={`/profile/${post.pubkey}`} className="hover:underline">
                  <span className="font-semibold text-sm leading-tight block">{displayName}</span>
                </Link>
              </div>
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
                      <span className="mr-1.5 whitespace-nowrap hover:underline">{relativeTime}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{formattedAbsoluteTime}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" title="More options">
                  <MoreVertical className="h-3.5 w-3.5" />
                  <span className="sr-only">More options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSharePost(post.id)} className="text-xs">
                  <Share2 className="h-3.5 w-3.5 mr-1.5" /> Share Post
                </DropdownMenuItem>
                {user && user.pubkey !== post.pubkey && (
                  <DropdownMenuItem className="text-xs">
                    <Flag className="h-3.5 w-3.5 mr-1.5" /> Report Post
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="pt-1 pb-1.5 pl-3 pr-3">
        <div className="whitespace-pre-wrap break-words text-sm mt-1">
          <NoteContent event={post} />
        </div>
      </div>

      {/* Footer Section */}
      <div className="flex-col pt-1.5 pl-3 pr-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-12">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground flex items-center h-7 px-1.5"
              onClick={() => setShowReplies(!showReplies)}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="text-xs ml-0.5">
                {/* Placeholder for reply count - could be dynamically loaded */}
                {post.tags.find(tag => tag[0] === 'reply_count') ? 
                  post.tags.find(tag => tag[0] === 'reply_count')?.[1] : 
                  ''}
              </span>
            </Button>
            <EmojiReactionButton postId={post.id} showText={false} />
          </div>
          
          {/* Group button on the right side */}
          {communityInfo && communityName && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {isCommunityDeleted ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground flex items-center h-7 px-2 cursor-not-allowed"
                      disabled
                    >
                      <Users className="h-3.5 w-3.5 mr-1" />
                      <span className="text-xs">{communityName}</span>
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground flex items-center h-7 px-2"
                      asChild
                    >
                      <Link to={`/group/${encodeURIComponent(communityInfo.id)}`}>
                        <Users className="h-3.5 w-3.5 mr-1" />
                        <span className="text-xs">{communityName}</span>
                      </Link>
                    </Button>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isCommunityDeleted ? "This group has been deleted" : `View in community: ${communityName}`}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {showReplies && (
          <div className="w-full mt-2.5">
            <ReplyList
              postId={post.id}
              communityId={communityInfo?.id || ''}
              postAuthorPubkey={post.pubkey}
            />
          </div>
        )}
      </div>
    </div>
  );
}