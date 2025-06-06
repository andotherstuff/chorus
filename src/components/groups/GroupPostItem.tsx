import { useState, useEffect } from "react";
import { useNostr } from "@/hooks/useNostr";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { NostrEvent } from "@jsr/nostrify__nostrify";
import { parseNostrAddress } from "@/lib/nostr-utils";
import { KINDS } from "@/lib/nostr-kinds";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/Icon";
import { formatRelativeTime } from "@/lib/utils";
import { useAuthor } from "@/hooks/useAuthor";
import { nip19 } from "nostr-tools";
import { NoteContent } from "../NoteContent";
import { EmojiReactionButton } from "@/components/EmojiReactionButton";
import { NutzapButton } from "@/components/groups/NutzapButton";
import { NutzapInterface } from "@/components/groups/NutzapInterface";
import { shareContent } from "@/lib/share";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface GroupPost {
  post: NostrEvent & {
    communityId: string;
    approval?: {
      id: string;
      pubkey: string;
      created_at: number;
      kind: number;
    };
  };
}

interface GroupInfo {
  id: string;
  name: string;
  avatar?: string;
}

// Function to count replies
function ReplyCount({ postId }: { postId: string }) {
  const { nostr } = useNostr();
  const [replyCount, setReplyCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchReplyCount = async () => {
      if (!nostr) return;

      try {
        const events = await nostr.query([{
          kinds: [KINDS.GROUP_POST_REPLY],
          "#e": [postId],
          limit: 100,
        }], { signal: AbortSignal.timeout(3000) });

        setReplyCount(events?.length || 0);
      } catch (error) {
        console.error("Error fetching reply count:", error);
      }
    };

    fetchReplyCount();
  }, [nostr, postId]);

  if (replyCount === null || replyCount === 0) {
    return null;
  }

  return <span className="text-xs ml-0.5">{replyCount}</span>;
}

export function GroupPostItem({ post }: GroupPost) {
  const { nostr } = useNostr();
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const author = useAuthor(post.pubkey);
  const [showZaps, setShowZaps] = useState(false);
  
  // Fetch group information
  useEffect(() => {
    const fetchGroupInfo = async () => {
      setIsLoading(true);
      
      try {
        const communityId = post.communityId;
        const parsedId = communityId.includes(':') ? parseNostrAddress(communityId) : null;
        
        if (!parsedId || !nostr) {
          setIsLoading(false);
          return;
        }
        
        const events = await nostr.query([{
          kinds: [KINDS.GROUP],
          authors: [parsedId.pubkey],
          "#d": [parsedId.identifier],
        }], { signal: AbortSignal.timeout(3000) });
        
        if (events && events.length > 0) {
          const nameTag = events[0].tags.find(tag => tag[0] === "name");
          const pictureTag = events[0].tags.find(tag => tag[0] === "picture");
          setGroupInfo({
            id: communityId,
            name: nameTag ? nameTag[1] : parsedId.identifier,
            avatar: pictureTag ? pictureTag[1] : undefined,
          });
        }
      } catch (error) {
        console.error("Error fetching group info:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchGroupInfo();
  }, [nostr, post.communityId]);

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
      const shareUrl = `${window.location.origin}/group/${encodeURIComponent(post.communityId)}#${post.id}`;
      
      await shareContent({
        title: "Check out this post",
        text: post.content.slice(0, 100) + (post.content.length > 100 ? "..." : ""),
        url: shareUrl
      });
    }
  };
  
  // Handle toggle between replies and zaps
  const handleZapToggle = (isOpen: boolean) => {
    setShowZaps(isOpen);
  };
  
  // Get author information for display
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
  
  if (isLoading) {
    return (
      <div className="border-b border-border/70 pb-4 mb-4 last:mb-0 last:border-none">
        <div className="flex items-start gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="pl-10 mt-2">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="border-b border-border/70 pb-4 pt-2 mb-4 last:mb-0 last:border-none hover:bg-muted/5 transition-colors">
      {/* Group Badge - links to the group */}
      <div className="mb-2">
        <Link 
          to={`/group/${encodeURIComponent(post.communityId)}`}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Avatar className="h-5 w-5 rounded-sm">
            {groupInfo?.avatar ? (
              <AvatarImage src={groupInfo.avatar} alt={groupInfo.name} />
            ) : (
              <AvatarFallback className="rounded-sm text-xs">
                {(groupInfo?.name || 'G').charAt(0).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          <span className="text-sm font-medium hover:underline">
            {groupInfo ? groupInfo.name : 'Unknown Group'}
          </span>
        </Link>
      </div>
      
      {/* Author and Post Info */}
      <div className="flex items-start">
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
                {post.approval ? (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-green-500/10 text-green-600 border-green-500/20">
                    Approved
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                    Pending
                  </Badge>
                )}
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
          </div>
        </div>
      </div>
      
      {/* Post Content */}
      <div className="pt-1 pb-1.5 pl-[2.875rem] pr-3">
        <div className="whitespace-pre-wrap break-words text-sm mt-1">
          <NoteContent event={post} />
        </div>
      </div>
      
      {/* Post Actions */}
      <div className="flex-col pt-1.5 pl-[2.875rem] pr-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-6 md:gap-8">
            <Link 
              to={`/group/${encodeURIComponent(post.communityId)}#${post.id}`}
              className="text-muted-foreground hover:text-foreground flex items-center h-7 px-1.5"
            >
              <Icon name="MessageSquare" size={14} />
              <ReplyCount postId={post.id} />
            </Link>
            <EmojiReactionButton postId={post.id} showText={false} />
            <NutzapButton 
              postId={post.id} 
              authorPubkey={post.pubkey} 
              showText={false} 
              onToggle={handleZapToggle}
              isOpen={showZaps}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground flex items-center h-7 px-1.5"
                    onClick={handleSharePost}
                  >
                    <Icon name="Share2" size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Share post</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground flex items-center h-7 px-1.5 md:hidden"
                    asChild
                  >
                    <Link to={`/group/${encodeURIComponent(post.communityId)}#${post.id}`} state={{ scrollToPostId: post.id }}>
                      <Icon name="ExternalLink" size={14} />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View in group</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          {/* Only show text version on desktop */}
          <Link 
            to={`/group/${encodeURIComponent(post.communityId)}#${post.id}`}
            state={{ scrollToPostId: post.id }}
            className="text-xs text-primary hover:underline items-center hidden md:flex"
          >
            <span className="mr-1">View in group</span>
            <Icon name="ExternalLink" size={12} />
          </Link>
        </div>
        
        {showZaps && (
          <div className="w-full mt-2.5">
            <NutzapInterface
              postId={post.id}
              authorPubkey={post.pubkey}
              relayHint={undefined}
              onSuccess={() => {
                // Call the refetch function if available
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const refetchFn = (window as any)[`zapRefetch_${post.id}`];
                if (typeof refetchFn === 'function') refetchFn();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}