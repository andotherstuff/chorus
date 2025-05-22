import { useNostr } from "@/hooks/useNostr";
import { useState, useEffect } from "react";
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
import { MessageSquare, Share2, CheckCircle, XCircle, MoreVertical, Ban, ChevronDown, ChevronUp, Flag, Timer } from "lucide-react";
import { EmojiReactionButton } from "@/components/EmojiReactionButton";
import { NutzapButton } from "@/components/groups/NutzapButton";
import { NutzapList } from "@/components/groups/NutzapList";
import { NostrEvent } from "@nostrify/nostrify";
import { nip19 } from 'nostr-tools';
import { NoteContent } from "../NoteContent";
import { Link } from "react-router-dom";
import { parseNostrAddress } from "@/lib/nostr-utils";
import { formatRelativeTime } from "@/lib/utils";
import { ReplyList } from "./ReplyList";
import { ReportDialog } from "./ReportDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Reply Count Component
function ReplyCount({ postId }: { postId: string }) {
  const { nostr } = useNostr();

  const { data: replyCount } = useQuery({
    queryKey: ["reply-count", postId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);

      // Get all kind 1111 replies that reference this post
      const events = await nostr.query([{
        kinds: [1111],
        "#e": [postId],
        limit: 100,
      }], { signal });

      return events?.length || 0;
    },
    enabled: !!nostr && !!postId,
  });

  if (!replyCount || replyCount === 0) {
    return null;
  }

  return <span className="text-xs ml-0.5">{replyCount}</span>;
}

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
          const kind = kindTag ? Number.parseInt(kindTag[1]) : null;

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
      <div className="space-y-0">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`py-4 ${i < 3 ? 'border-b-2 border-border/70' : ''}`}>
            <div className="px-3">
              <div className="flex flex-row items-center pb-2">
                <Skeleton className="h-9 w-9 rounded-md mr-2.5" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="pt-1 pb-2 pl-[2.875rem]">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="pt-1.5 pl-[2.875rem]">
                <div className="flex gap-4">
                  <Skeleton className="h-7 w-7" />
                  <Skeleton className="h-7 w-7" />
                  <Skeleton className="h-7 w-7" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (sortedPosts.length === 0) {
    return (
      <div className="p-8 text-center border border-border/30 rounded-md bg-card">
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
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {sortedPosts.map((post, index) => (
        <PostItem
          key={post.id}
          post={post}
          communityId={communityId}
          isApproved={'approval' in post}
          isModerator={isUserModerator}
          isLastItem={index === sortedPosts.length - 1}
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
  isLastItem?: boolean;
}

function PostItem({ post, communityId, isApproved, isModerator, isLastItem = false }: PostItemProps) {
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
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  // Extract expiration timestamp from post tags
  const expirationTag = post.tags.find(tag => tag[0] === "expiration");
  const expirationTimestamp = expirationTag ? Number.parseInt(expirationTag[1]) : null;

  // Update time remaining every minute
  useEffect(() => {
    if (!expirationTimestamp) return;

    const calculateTimeRemaining = () => {
      const now = Math.floor(Date.now() / 1000);
      const secondsRemaining = expirationTimestamp - now;

      if (secondsRemaining <= 0) {
        setTimeRemaining("Expired");
        return;
      }

      // Format the expiration time
      setTimeRemaining(formatRelativeTime(expirationTimestamp));
    };

    // Calculate immediately
    calculateTimeRemaining();

    // Then update every minute
    const interval = setInterval(calculateTimeRemaining, 60000);
    return () => clearInterval(interval);
  }, [expirationTimestamp]);

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

  // Format the timestamp as relative time
  const relativeTime = formatRelativeTime(post.created_at);

  // Keep the absolute time as a tooltip
  const postDate = new Date(post.created_at * 1000);
  const formattedAbsoluteTime = `${postDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })} ${postDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  })}`;

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
    <div className={`py-4 hover:bg-muted/5 transition-colors ${!isLastItem ? 'border-b-2 border-border/70' : ''}`}>
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
              <Link to={`/profile/${post.pubkey}`} className="hover:underline">
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
                      <span className="mr-1.5 whitespace-nowrap hover:underline">{relativeTime}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{formattedAbsoluteTime}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {/* Expiration time moved to bottom right */}
              </div>
            </div>

            {isModerator ? (
              <div className="flex items-center gap-2 ml-1 flex-shrink-0">
                {/* Status indicator moved to the top right */}
                {isApproved ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-green-600 dark:text-green-400 flex items-center whitespace-nowrap cursor-help">
                          <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Approved post</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-amber-600 dark:text-amber-400 flex items-center whitespace-nowrap cursor-help">
                          <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Pending approval</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {!isApproved && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleApprovePost}
                    className="text-green-600 h-6 w-6 mx-0"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span className="sr-only">Approve</span>
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
                    <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`)} className="text-xs">
                      <Share2 className="h-3.5 w-3.5 mr-1.5" /> Share Post
                    </DropdownMenuItem>
                    {user && user.pubkey !== post.pubkey && (
                      <DropdownMenuItem onClick={() => setIsReportDialogOpen(true)} className="text-xs">
                        <Flag className="h-3.5 w-3.5 mr-1.5" /> Report Post
                      </DropdownMenuItem>
                    )}
                    {isModerator && (
                      <>
                        <DropdownMenuSeparator />
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
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
                  <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove Post</AlertDialogTitle><AlertDialogDescription>Are you sure you want to remove this post? This action will hide the post from the group.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleRemovePost} className="bg-red-600 hover:bg-red-700">Remove Post</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                </AlertDialog>
                <AlertDialog open={isBanDialogOpen} onOpenChange={setIsBanDialogOpen}>
                  <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Ban User</AlertDialogTitle><AlertDialogDescription>Are you sure you want to ban this user? They will no longer be able to post in this group, and all their existing posts will be hidden.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleBanUser} className="bg-red-600 hover:bg-red-700">Ban User</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                </AlertDialog>
              </div>
            ) : (
              <div className="flex items-center gap-2 ml-1 flex-shrink-0">
                {/* Status indicator moved to the top right for non-moderator view */}
                {isApproved ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-green-600 dark:text-green-400 flex items-center whitespace-nowrap cursor-help">
                          <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0"></span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Approved post</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-amber-600 dark:text-amber-400 flex items-center whitespace-nowrap cursor-help">
                          <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0"></span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Pending approval</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" title="More options">
                      <MoreVertical className="h-3.5 w-3.5" />
                      <span className="sr-only">More options</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`)} className="text-xs">
                      <Share2 className="h-3.5 w-3.5 mr-1.5" /> Share Post
                    </DropdownMenuItem>
                    {user && user.pubkey !== post.pubkey && (
                      <DropdownMenuItem onClick={() => setIsReportDialogOpen(true)} className="text-xs">
                        <Flag className="h-3.5 w-3.5 mr-1.5" /> Report Post
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Section - aligned with author info */}
      <div className="pt-1 pb-1.5 pl-[2.875rem] pr-3">
        <div className="whitespace-pre-wrap break-words text-sm mt-1 ml-3">
          <NoteContent event={post} />
        </div>
      </div>

      {/* Footer Section - aligned with author info and content */}
      <div className="flex-col pt-1.5 pl-[2.875rem] pr-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-12 ml-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground flex items-center h-7 px-1.5"
              onClick={() => setShowReplies(!showReplies)}
            >
              {/* Get replies count */}
              {(() => {
                const { nostr: postNostr } = useNostr();
                const { data: replyCount = 0 } = useQuery({
                  queryKey: ["reply-count", post.id],
                  queryFn: async (c) => {
                    const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
                    const events = await postNostr.query([{
                      kinds: [1111],
                      "#e": [post.id],
                      limit: 100,
                    }], { signal });
                    return events?.length || 0;
                  },
                  enabled: !!postNostr && !!post.id,
                });
                
                return (
                  <>
                    <MessageSquare className={`h-3.5 w-3.5`} />
                    {replyCount > 0 && <span className="text-xs ml-0.5">{replyCount}</span>}
                  </>
                );
              })()}
            </Button>
            <EmojiReactionButton postId={post.id} showText={false} />
            <NutzapButton postId={post.id} authorPubkey={post.pubkey} showText={false} />
          </div>
          {timeRemaining && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-red-500/60 dark:text-red-400/60 flex items-center whitespace-nowrap cursor-help text-xs">
                    <Timer className="h-3 w-3 mr-1.5 opacity-70" />
                    {timeRemaining}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Post expires in {timeRemaining}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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

      {/* Report Dialog */}
      <ReportDialog
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
        pubkey={post.pubkey}
        eventId={post.id}
        communityId={communityId}
        contentPreview={post.content}
      />
    </div>
  );
}
