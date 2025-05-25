import React, { useState } from "react";
import { useNostr } from "@/hooks/useNostr";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserGroups } from "@/hooks/useUserGroups";
import { useQuery } from "@tanstack/react-query";
import { useAuthor } from "@/hooks/useAuthor";
import type { NostrEvent } from "@nostrify/nostrify";
import { KINDS } from "@/lib/nostr-kinds";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NoteContent } from "@/components/NoteContent";
import { Link } from "react-router-dom";
import { 
  Users, 
  MessageSquare, 
  Timer,
  MoreVertical,
  Share2,
  Flag,
  Calendar,
  Home,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { nip19 } from 'nostr-tools';
import { parseNostrAddress } from "@/lib/nostr-utils";
import { cn, formatRelativeTime } from "@/lib/utils";
import { shareContent } from "@/lib/share";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmojiReactionButton } from "@/components/EmojiReactionButton";
import { NutzapButton } from "@/components/groups/NutzapButton";
import { NutzapInterface } from "@/components/groups/NutzapInterface";
import { ReplyList } from "@/components/groups/ReplyList";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Header from "@/components/ui/Header";
import { LoginArea } from "@/components/auth/LoginArea";

// Helper function to extract group information from a post
function extractGroupInfo(post: NostrEvent): { groupId: string; groupName: string } | null {
  // Find the "a" tag that matches the group format
  const groupTag = post.tags.find(tag => {
    return tag[0] === "a" && tag[1].startsWith("34550:");
  });

  if (!groupTag) return null;

  const groupId = groupTag[1];

  // Parse the Nostr address to extract components
  const parsedAddress = parseNostrAddress(groupId);

  if (parsedAddress && parsedAddress.kind === 34550) {
    return {
      groupId,
      groupName: parsedAddress.identifier // The identifier part is often the group name
    };
  }

  // Fallback to simple string splitting if parsing fails
  const parts = groupId.split(":");
  if (parts.length >= 3) {
    return {
      groupId,
      groupName: parts[2] // The identifier part is often the group name
    };
  }

  return {
    groupId,
    groupName: "Group" // Fallback name if we can't extract it
  };
}

// Component to fetch and display group name
function GroupNameDisplay({ groupId }: { groupId: string }) {
  const { nostr } = useNostr();

  const { data: groupName, isLoading } = useQuery({
    queryKey: ["group-name", groupId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      // Parse the group ID to get the components
      const parsedAddress = parseNostrAddress(groupId);
      if (!parsedAddress || parsedAddress.kind !== 34550) {
        return "Group";
      }

      // Query for the group event
      const events = await nostr.query([{
        kinds: [KINDS.GROUP],
        authors: [parsedAddress.pubkey],
        "#d": [parsedAddress.identifier],
        limit: 1,
      }], { signal });

      if (events.length === 0) {
        return parsedAddress.identifier; // Fallback to identifier
      }

      const groupEvent = events[0];
      
      // Look for the name tag
      const nameTag = groupEvent.tags.find(tag => tag[0] === "name");
      if (nameTag && nameTag[1]) {
        return nameTag[1];
      }

      // Fallback to identifier
      return parsedAddress.identifier;
    },
    enabled: !!nostr && !!groupId,
  });

  if (isLoading) {
    return <span>Loading...</span>;
  }

  return <span className="font-medium">{groupName || "Group"}</span>;
}

// Component to display group information on a post
function PostGroupLink({ post }: { post: NostrEvent }) {
  const groupInfo = extractGroupInfo(post);

  if (!groupInfo) return null;

  return (
    <Link
      to={`/group/${encodeURIComponent(groupInfo.groupId)}`}
      className="flex items-center text-xs md:text-sm text-muted-foreground hover:text-primary transition-colors"
    >
      <div className="flex items-center px-2 py-1 rounded-full bg-muted/70 hover:bg-muted transition-colors">
        <Users className="h-3 w-3 md:h-4 md:w-4 mr-1.5" />
        <GroupNameDisplay groupId={groupInfo.groupId} />
      </div>
    </Link>
  );
}

function PostCard({ post, isLastItem = false }: { 
  post: NostrEvent; 
  isLastItem?: boolean;
}) {
  const { user } = useCurrentUser();
  const author = useAuthor(post.pubkey);
  const [showReplies, setShowReplies] = useState(false);
  const [showZaps, setShowZaps] = useState(false);

  const metadata = author.data?.metadata;
  const displayName = metadata?.name || post.pubkey.slice(0, 8);
  const displayNameFull = metadata?.display_name || displayName;
  const profileImage = metadata?.picture;

  const handleSharePost = async () => {
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
    } catch (error) {
      console.error("Error creating share URL:", error);
      // Fallback to the original URL format
      const groupInfo = extractGroupInfo(post);
      let shareUrl: string;
      
      if (groupInfo) {
        // If post is in a group, link to the group with post hash
        shareUrl = `${window.location.origin}/group/${encodeURIComponent(groupInfo.groupId)}#${post.id}`;
      } else {
        // Otherwise, link to the user's profile
        shareUrl = `${window.location.origin}/profile/${post.pubkey}#${post.id}`;
      }
      
      await shareContent({
        title: "Check out this post",
        text: post.content.slice(0, 100) + (post.content.length > 100 ? "..." : ""),
        url: shareUrl
      });
    }
  };

  // Handle toggle between replies and zaps
  const handleShowReplies = () => {
    const newState = !showReplies;
    setShowReplies(newState);
    if (newState) {
      setShowZaps(false); // Close zaps if opening replies
    }
  };

  const handleZapToggle = (isOpen: boolean) => {
    setShowZaps(isOpen);
    if (isOpen) {
      setShowReplies(false); // Close replies if opening zaps
    }
  };

  // Extract expiration timestamp from post tags
  const expirationTag = post.tags.find(tag => tag[0] === "expiration");
  const expirationTimestamp = expirationTag ? Number.parseInt(expirationTag[1]) : null;

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

  // Format author identifier
  let authorIdentifier = post.pubkey;
  if (post.pubkey.match(/^[0-9a-fA-F]{64}$/)) {
    try {
      const npub = nip19.npubEncode(post.pubkey);
      authorIdentifier = `${npub.slice(0,10)}...${npub.slice(-4)}`;
    } catch (e) {
      authorIdentifier = `${post.pubkey.slice(0,8)}...${post.pubkey.slice(-4)}`;
    }
  }

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
                <span className="font-semibold text-sm leading-tight block">{displayNameFull}</span>
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
              </div>
            </div>

            <div className="flex items-center gap-2 ml-1 flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" title="More options">
                    <MoreVertical className="h-3.5 w-3.5" />
                    <span className="sr-only">More options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleSharePost} className="text-xs">
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
      </div>

      {/* Content Section - takes full width */}
      <div className="pt-1 pb-1.5 pl-3 pr-3">
        <div className="whitespace-pre-wrap break-words text-sm mt-1">
          <NoteContent event={post} />
        </div>
        
        {extractGroupInfo(post) && (
          <div className="mt-2">
            <PostGroupLink post={post} />
          </div>
        )}
      </div>

      {/* Footer Section - aligned with icons */}
      <div className="flex-col pt-1.5 pl-3 pr-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-12">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground flex items-center h-7 px-1.5"
              onClick={handleShowReplies}
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
            <EmojiReactionButton postId={post.id} showText={false} />
            <NutzapButton 
              postId={post.id} 
              authorPubkey={post.pubkey} 
              showText={true} 
              onToggle={handleZapToggle}
              isOpen={showZaps}
            />
          </div>
          {expirationTimestamp && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-red-500/60 dark:text-red-400/60 flex items-center whitespace-nowrap cursor-help text-xs">
                    <Timer className="h-3 w-3 mr-1.5 opacity-70" />
                    {formatRelativeTime(expirationTimestamp)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Post expires in {formatRelativeTime(expirationTimestamp)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {showReplies && (
          <div className="w-full mt-2.5">
            <ReplyList
              postId={post.id}
              communityId=""
              postAuthorPubkey={post.pubkey}
            />
          </div>
        )}

        {showZaps && (
          <div className="w-full mt-2.5">
            <NutzapInterface
              postId={post.id}
              authorPubkey={post.pubkey}
              relayHint={undefined}
              onSuccess={() => {
                // Call the refetch function if available
                const windowWithZapRefetch = window as unknown as { [key: string]: (() => void) | undefined };
                const refetchFn = windowWithZapRefetch[`zapRefetch_${post.id}`];
                if (refetchFn) refetchFn();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Hook to fetch posts from all user's groups
function useHomeFeedPosts() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { data: userGroups } = useUserGroups();

  return useQuery({
    queryKey: ["home-feed-posts", user?.pubkey, userGroups?.allGroups?.length],
    queryFn: async (c) => {
      if (!user || !nostr || !userGroups?.allGroups || userGroups.allGroups.length === 0) {
        return [];
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);

      // Get community IDs from all groups the user is in
      const communityIds = userGroups.allGroups.map(group => {
        const dTag = group.tags.find(tag => tag[0] === "d");
        return `34550:${group.pubkey}:${dTag ? dTag[1] : ""}`;
      });

      if (communityIds.length === 0) {
        return [];
      }

      // Query for approved posts in all these communities
      const approvals = await nostr.query([{
        kinds: [KINDS.GROUP_POST_APPROVAL],
        "#a": communityIds,
        limit: 100, // Get more approvals since we're aggregating from multiple groups
      }], { signal });

      // Extract the approved posts from the approval events
      const approvedPosts = approvals.map(approval => {
        try {
          // Get the kind tag to check if it's a reply
          const kindTag = approval.tags.find(tag => tag[0] === "k");
          const kind = kindTag ? Number.parseInt(kindTag[1]) : null;

          // Skip this approval if it's for a reply (kind 1111)
          if (kind === KINDS.GROUP_POST_REPLY) {
            return null;
          }

          const approvedPost = JSON.parse(approval.content) as NostrEvent;

          // Skip if the post itself is a reply
          if (approvedPost.kind === KINDS.GROUP_POST_REPLY) {
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

      // Also get posts from approved members and moderators that might be auto-approved
      const allPosts = await nostr.query([{
        kinds: [KINDS.GROUP_POST],
        "#a": communityIds,
        limit: 100,
      }], { signal });

      // For each community, get approved members and moderators
      const autoApprovedPosts: NostrEvent[] = [];
      
      for (const communityId of communityIds) {
        // Get approved members for this community
        const membershipEvents = await nostr.query([{
          kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST],
          "#d": [communityId],
          limit: 10,
        }], { signal: AbortSignal.timeout(3000) });

        // Get community details for moderators
        const parsedId = parseNostrAddress(communityId);
        if (!parsedId) continue;

        const communityEvents = await nostr.query([{
          kinds: [KINDS.GROUP],
          authors: [parsedId.pubkey],
          "#d": [parsedId.identifier],
          limit: 1,
        }], { signal: AbortSignal.timeout(3000) });

        const communityEvent = communityEvents[0];
        if (!communityEvent) continue;

        // Get approved members
        const approvedMembers = new Set<string>();
        for (const membershipEvent of membershipEvents) {
          const pTags = membershipEvent.tags.filter(tag => tag[0] === "p");
          for (const pTag of pTags) {
            approvedMembers.add(pTag[1]);
          }
        }

        // Get moderators
        const moderators = new Set<string>();
        moderators.add(communityEvent.pubkey); // Owner is always a moderator
        const moderatorTags = communityEvent.tags.filter(tag => 
          tag[0] === "p" && tag[3] === "moderator"
        );
        for (const modTag of moderatorTags) {
          moderators.add(modTag[1]);
        }

        // Find posts from approved members and moderators in this community
        const communityPosts = allPosts.filter(post => {
          const aTag = post.tags.find(tag => tag[0] === "a");
          return aTag && aTag[1] === communityId;
        });

        for (const post of communityPosts) {
          // Skip if already in approved posts
          if (approvedPosts.some(ap => ap.id === post.id)) {
            continue;
          }

          // Skip replies
          if (post.kind === KINDS.GROUP_POST_REPLY) {
            continue;
          }

          // Auto-approve if from approved member or moderator
          if (approvedMembers.has(post.pubkey) || moderators.has(post.pubkey)) {
            autoApprovedPosts.push({
              ...post,
              approval: {
                id: `auto-approved-${post.id}`,
                pubkey: post.pubkey,
                created_at: post.created_at,
                autoApproved: true,
                kind: post.kind
              }
            } as NostrEvent & { approval: any });
          }
        }
      }

      // Combine approved and auto-approved posts
      const allApprovedPosts = [...approvedPosts, ...autoApprovedPosts];

      // Remove duplicates and sort by creation time (newest first)
      const uniquePosts = allApprovedPosts.filter((post, index, self) =>
        index === self.findIndex(p => p.id === post.id)
      );

      return uniquePosts.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!nostr && !!user && !!userGroups?.allGroups,
  });
}

export default function HomeFeed() {
  const { user } = useCurrentUser();
  const { data: posts, isLoading, refetch, isFetching } = useHomeFeedPosts();

  // If user is not logged in, show login area
  if (!user) {
    return (
      <div className="container mx-auto py-1 px-3 sm:px-4">
        <Header />
        <div className="max-w-3xl mx-auto mt-8">
          <div className="text-center py-12">
            <Home className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h1 className="text-2xl font-bold mb-2">Welcome to your Home Feed</h1>
            <p className="text-muted-foreground mb-6">
              Sign in to see posts from all the groups you're a member of
            </p>
            <LoginArea />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-1 px-3 sm:px-4">
      <Header />
      
      <div className="max-w-3xl mx-auto mt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Home className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Home Feed</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`py-4 ${i < 5 ? 'border-b-2 border-border/70' : ''}`}>
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
        ) : posts && posts.length > 0 ? (
          <div className="space-y-0">
            {posts.map((post, index) => (
              <PostCard 
                key={post.id} 
                post={post} 
                isLastItem={index === posts.length - 1}
              />
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <Home className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
            <p className="text-muted-foreground mb-4">
              Your home feed will show posts from groups you're a member of.
            </p>
            <Link to="/groups">
              <Button variant="outline">
                <Users className="h-4 w-4 mr-2" />
                Explore Groups
              </Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}