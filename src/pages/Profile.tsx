import { useParams, useLocation } from "react-router-dom";
import { useAuthor } from "@/hooks/useAuthor";
import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useState, useEffect } from "react";
import { 
  Avatar, 
  AvatarFallback, 
  AvatarImage 
} from "@/components/ui/avatar";
import { 
  Card, 
  CardHeader, 
  CardContent
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { NoteContent } from "@/components/NoteContent";
import { Link } from "react-router-dom";
import { 
  ExternalLink, 
  Copy, 
  Users, 
  Pencil,
  Calendar, 
  MessageCircle,
  MessageSquare,
  Heart,
  Share2,
  LinkIcon,
  MoreVertical,
  Flag
} from "lucide-react";
import { toast } from "sonner";
import type { NostrEvent } from "@nostrify/nostrify";
import { parseNostrAddress } from "@/lib/nostr-utils";
import Header from "@/components/ui/Header";
import { VerifiedNip05 } from "@/components/VerifiedNip05";
import { useNip05Verification } from "@/hooks/useNip05Verification";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmojiReactionButton } from "@/components/EmojiReactionButton";
import { NutzapButton } from "@/components/groups/NutzapButton";
import { NutzapInterface } from "@/components/groups/NutzapInterface";
import { ReplyList } from "@/components/groups/ReplyList";
import { nip19 } from 'nostr-tools';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
        kinds: [34550],
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

// Formatted date component
function FormattedDate({ timestamp }: { timestamp: number }) {
  const date = new Date(timestamp * 1000);
  
  // Format relative time (e.g., "2 hours ago")
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  let relativeTime = '';
  
  if (diffInSeconds < 60) {
    relativeTime = rtf.format(-Math.floor(diffInSeconds), 'second');
  } else if (diffInSeconds < 3600) {
    relativeTime = rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
  } else if (diffInSeconds < 86400) {
    relativeTime = rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
  } else if (diffInSeconds < 604800) {
    relativeTime = rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
  } else if (diffInSeconds < 2592000) {
    relativeTime = rtf.format(-Math.floor(diffInSeconds / 604800), 'week');
  } else if (diffInSeconds < 31536000) {
    relativeTime = rtf.format(-Math.floor(diffInSeconds / 2592000), 'month');
  } else {
    relativeTime = rtf.format(-Math.floor(diffInSeconds / 31536000), 'year');
  }
  
  // Format absolute date (shown on hover)
  const formatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  const formattedDate = date.toLocaleString('en-US', formatOptions);
  
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 mr-1.5 inline-block" />
            {relativeTime}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{formattedDate}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Component to display the user's groups
interface UserGroup {
  id: string;
  name: string;
  description: string;
  image: string;
  membershipEvent: NostrEvent;
  groupEvent: NostrEvent;
}

function UserGroupsList({
  groups,
  isLoading
}: {
  groups: UserGroup[] | undefined;
  isLoading: boolean;
}) {
  const { user } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="p-6 text-center bg-muted/30 rounded-lg">
        <p className="text-muted-foreground">This user is not a member of any groups yet</p>
      </div>
    );
  }

  // Create a map to deduplicate groups by ID
  const uniqueGroups = new Map<string, UserGroup>();
  for (const group of groups) {
    // Only add if not already in the map, or replace with newer version
    if (
      !uniqueGroups.has(group.id) ||
      (group.groupEvent.created_at > (uniqueGroups.get(group.id)?.groupEvent.created_at ?? 0))
    ) {
      uniqueGroups.set(group.id, group);
    }
  }

  // Helper function to determine user's role in a group
  const getUserRole = (group: UserGroup, userPubkey: string) => {
    // Check if user is the owner (creator) of the group
    if (group.groupEvent.pubkey === userPubkey) {
      return 'owner';
    }

    // Check if user is a moderator
    const moderatorTags = group.groupEvent.tags.filter(
      tag => tag[0] === "p" && tag[3] === "moderator"
    );
    const isModerator = moderatorTags.some(tag => tag[1] === userPubkey);
    
    if (isModerator) {
      return 'moderator';
    }

    return 'member';
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      {Array.from(uniqueGroups.values()).map((group) => {
        const userRole = user ? getUserRole(group, user.pubkey) : 'member';
        
        return (
          <Link
            key={group.id}
            to={`/group/${encodeURIComponent(group.id)}`}
            className="block"
          >
            <Card className="overflow-hidden border border-border/40 hover:border-border hover:shadow-sm transition-all duration-200">
              <div className="flex p-4">
                <div className="h-14 w-14 rounded-lg overflow-hidden mr-4 flex-shrink-0 bg-muted">
                  <img
                    src={group.image}
                    alt={group.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder-community.svg";
                    }}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="font-medium text-sm">{group.name}</h3>
                    {userRole !== 'member' && (
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        userRole === 'owner' 
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      }`}>
                        {userRole === 'owner' ? 'Owner' : 'Moderator'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-snug text-muted-foreground line-clamp-2">
                    {group.description || "No description available"}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

function PostCard({ post, profileImage, displayName, displayNameFull, isLastItem = false }: { 
  post: NostrEvent; 
  profileImage?: string;
  displayName: string;
  displayNameFull: string;
  isLastItem?: boolean;
}) {
  const { user } = useCurrentUser();
  const [showReplies, setShowReplies] = useState(false);
  const [showZaps, setShowZaps] = useState(false);

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
                  <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`)} className="text-xs">
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
                const refetchFn = (window as any)[`zapRefetch_${post.id}`];
                if (refetchFn) refetchFn();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Profile() {
  const { pubkey } = useParams<{ pubkey: string }>();
  const location = useLocation();
  const author = useAuthor(pubkey);
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState("posts");

  const hash = location.hash.replace('#', '');

  // Set active tab based on URL hash
  useEffect(() => {
    const validTabs = ["posts", "groups"];
    
    if (hash && validTabs.includes(hash)) {
      setActiveTab(hash);
    } else if (!activeTab || !validTabs.includes(activeTab)) {
      setActiveTab("posts");
    }
  }, [hash, activeTab]);

  // Query for user's posts
  const { data: posts, isLoading: isLoadingPosts } = useQuery({
    queryKey: ["user-posts", pubkey],
    queryFn: async (c) => {
      if (!pubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Get posts by this user
      const userPosts = await nostr.query([{
        kinds: [11],
        authors: [pubkey],
        limit: 20,
      }], { signal });

      return userPosts.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!nostr && !!pubkey,
  });

  // Query for groups the user is a part of
  const { data: userGroups, isLoading: isLoadingGroups } = useQuery({
    queryKey: ["user-groups-profile", pubkey],
    queryFn: async (c) => {
      if (!pubkey || !nostr) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // First, check if this is the current user - if so, we can use a more efficient approach
      const isCurrentUserProfile = user && pubkey === user.pubkey;

      const groupEvents: NostrEvent[] = [];

      if (isCurrentUserProfile) {
        // For current user, get all communities they're part of from various sources

        // Get communities where user is owner or moderator
        const ownedOrModeratedEvents = await nostr.query([{
          kinds: [34550],
          authors: [pubkey], // Communities they created
          limit: 50,
        }], { signal });

        groupEvents.push(...ownedOrModeratedEvents);

        // Get communities where user is a moderator but not owner
        const moderatedEvents = await nostr.query([{
          kinds: [34550],
          "#p": [pubkey],
          limit: 50,
        }], { signal });

        // Filter to only include events where user is tagged as moderator
        const moderatorEvents = moderatedEvents.filter(event =>
          event.pubkey !== pubkey && // Not already counted as owned
          event.tags.some(tag =>
            tag[0] === "p" &&
            tag[1] === pubkey &&
            tag[3] === "moderator"
          )
        );

        groupEvents.push(...moderatorEvents);

        // Get communities where user is a member
        const membershipEvents = await nostr.query([{
          kinds: [14550],
          "#p": [pubkey],
          limit: 50,
        }], { signal });

        // For each membership event, get the community details
        for (const event of membershipEvents) {
          const aTag = event.tags.find(tag => tag[0] === "a");
          if (!aTag || !aTag[1]) continue;

          const groupId = aTag[1];
          const parsedGroup = parseNostrAddress(groupId);

          if (!parsedGroup || parsedGroup.kind !== 34550) continue;

          // Fetch the group details if we don't already have it
          const existingGroup = groupEvents.find(g => {
            const dTag = g.tags.find(tag => tag[0] === "d");
            return g.pubkey === parsedGroup.pubkey && dTag && dTag[1] === parsedGroup.identifier;
          });

          if (!existingGroup) {
            const [groupEvent] = await nostr.query([{
              kinds: [34550],
              authors: [parsedGroup.pubkey],
              "#d": [parsedGroup.identifier],
              limit: 1,
            }], { signal: AbortSignal.timeout(3000) });

            if (groupEvent) {
              groupEvents.push(groupEvent);
            }
          }
        }
      } else {
        // For other users, get membership events
        const membershipEvents = await nostr.query([{
          kinds: [14550],
          "#p": [pubkey],
          limit: 50,
        }], { signal });

        // For each membership event, get the community details
        for (const event of membershipEvents) {
          const aTag = event.tags.find(tag => tag[0] === "a");
          if (!aTag || !aTag[1]) continue;

          const groupId = aTag[1];
          const parsedGroup = parseNostrAddress(groupId);

          if (!parsedGroup || parsedGroup.kind !== 34550) continue;

          // Fetch the group details
          const [groupEvent] = await nostr.query([{
            kinds: [34550],
            authors: [parsedGroup.pubkey],
            "#d": [parsedGroup.identifier],
            limit: 1,
          }], { signal: AbortSignal.timeout(3000) });

          if (groupEvent) {
            groupEvents.push(groupEvent);
          }
        }

        // Also get communities they created
        const ownedEvents = await nostr.query([{
          kinds: [34550],
          authors: [pubkey],
          limit: 50,
        }], { signal });

        groupEvents.push(...ownedEvents);
      }

      // Deduplicate groups by their unique ID
      const uniqueGroups = new Map<string, NostrEvent>();
      for (const event of groupEvents) {
        const dTag = event.tags.find(tag => tag[0] === "d");
        if (!dTag) continue;

        const groupId = `34550:${event.pubkey}:${dTag[1]}`;
        uniqueGroups.set(groupId, event);
      }

      // Convert to UserGroup format
      return Array.from(uniqueGroups.entries()).map(([id, event]) => {
        const nameTag = event.tags.find(tag => tag[0] === "name");
        const descriptionTag = event.tags.find(tag => tag[0] === "description");
        const imageTag = event.tags.find(tag => tag[0] === "image");
        const dTag = event.tags.find(tag => tag[0] === "d");

        return {
          id,
          name: nameTag ? nameTag[1] : (dTag ? dTag[1] : "Unnamed Group"),
          description: descriptionTag ? descriptionTag[1] : "",
          image: imageTag ? imageTag[1] : "/placeholder-group.jpg",
          membershipEvent: event, // Using the group event as membership event
          groupEvent: event,
        };
      });
    },
    enabled: !!nostr && !!pubkey,
  });

  const metadata = author.data?.metadata;
  const displayName = metadata?.name || pubkey?.slice(0, 8) || "";
  const displayNameFull = metadata?.display_name || displayName;
  const profileImage = metadata?.picture;
  const about = metadata?.about;
  const website = metadata?.website;
  const nip05 = metadata?.nip05;
  const banner = metadata?.banner;

  // Check NIP05 verification status
  const { data: nip05Verification } = useNip05Verification(nip05, pubkey || "");

  // Check if this is the current user's profile
  const isCurrentUser = user && pubkey === user.pubkey;

  const copyPubkeyToClipboard = () => {
    if (pubkey) {
      navigator.clipboard.writeText(pubkey);
      toast.success("Public key copied to clipboard");
    }
  };

  useEffect(() => {
    if (displayNameFull && displayNameFull !== "Unnamed User") {
      document.title = `+chorus - ${displayNameFull}`;
    } else {
      document.title = "+chorus";
    }
    return () => {
      document.title = "+chorus";
    };
  }, [displayNameFull]);

  if (author.isLoading) {
    return (
      <div className="container mx-auto py-1 px-3 sm:px-4">
        <Header />
        <div className="space-y-6 my-6">
          {/* Banner skeleton */}
          <div className="w-full h-48 rounded-xl bg-muted/50 overflow-hidden mb-8"></div>
          
          {/* Profile info skeleton */}
          <div className="relative max-w-5xl mx-auto -mt-24 mb-8">
            <div className="bg-background rounded-xl border shadow-sm p-8">
              <div className="flex flex-col md:flex-row md:items-end gap-6">
                <Skeleton className="h-32 w-32 rounded-full border-4 border-background -mt-20" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-5 w-64" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-8 w-20 rounded-md" />
                    <Skeleton className="h-8 w-20 rounded-md" />
                  </div>
                </div>
              </div>
              
              <div className="mt-3 space-y-2">
                <Skeleton className="h-4 w-full max-w-2xl" />
                <Skeleton className="h-4 w-5/6 max-w-2xl" />
                <Skeleton className="h-4 w-4/6 max-w-xl" />
              </div>
            </div>
          </div>

          {/* Tabs skeleton */}
          <div className="max-w-5xl mx-auto">
            <div className="border-b mb-8">
              <div className="flex gap-8">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
              </div>
            </div>
            
            {/* Content skeleton */}
            <div className="grid md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="overflow-hidden shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-20" />
                          </div>
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-5/6" />
                          <Skeleton className="h-4 w-2/3" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div>
                <Skeleton className="h-8 w-40 mb-4" />
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="overflow-hidden">
                      <div className="flex p-4">
                        <Skeleton className="h-14 w-14 rounded-lg mr-4" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-full" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-1 px-3 sm:px-4">
      <Header />

      <div className="relative mb-6 mt-4">
        {/* Top row: Avatar and name/username side by side */}
        <div className="flex items-center gap-4 mb-4">
          <Avatar className="h-20 w-20 rounded-full border-4 border-background shadow-md">
            <AvatarImage src={profileImage} />
            <AvatarFallback className="text-xl bg-primary/10">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{displayNameFull}</h1>
              {nip05 && nip05Verification?.isVerified && (
                <VerifiedNip05 nip05={nip05} pubkey={pubkey || ""} />
              )}
            </div>
            {displayName !== displayNameFull && (
              <p className="text-sm text-muted-foreground">@{displayName}</p>
            )}
          </div>
        </div>
        
        {/* Middle row: Bio */}
        {about && (
          <div className="w-full mb-4">
            <p className="text-base text-muted-foreground whitespace-pre-wrap">{about}</p>
          </div>
        )}

        {/* Bottom row: Action buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Npub button - always first */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={copyPubkeyToClipboard}
          >
            <Copy className="h-4 w-4" />
            Npub
          </Button>
          
          {/* Website button - second if exists */}
          {website && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              asChild
            >
              <a
                href={website.startsWith('http') ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center"
              >
                <LinkIcon className="h-4 w-4" />
                Website
              </a>
            </Button>
          )}

          {/* Edit Profile button - only for current user */}
          {isCurrentUser && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              asChild
            >
              <Link to="/settings/profile">
                <Pencil className="h-4 w-4" />
                Edit Profile
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} defaultValue="posts" onValueChange={(value) => {
        setActiveTab(value);
        // Update URL hash without full page reload
        window.history.pushState(null, '', `#${value}`);
      }} className="w-full">
        <div className="md:flex md:justify-start">
          <TabsList className="mb-4 w-full md:w-auto flex">
            <TabsTrigger value="posts" className="flex-1 md:flex-none">
              <MessageCircle className="h-4 w-4 mr-2" />
              Posts
            </TabsTrigger>

            <TabsTrigger value="groups" className="flex-1 md:flex-none">
              <Users className="h-4 w-4 mr-2" />
              Groups
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="posts" className="space-y-4">
          <div className="max-w-3xl mx-auto">
            {isLoadingPosts ? (
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
            ) : posts && posts.length > 0 ? (
              <div className="space-y-0">
                {posts.map((post, index) => (
                  <PostCard 
                    key={post.id} 
                    post={post} 
                    profileImage={profileImage}
                    displayName={displayName}
                    displayNameFull={displayNameFull}
                    isLastItem={index === posts.length - 1}
                  />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center border border-border/30 rounded-md bg-card">
                <p className="text-muted-foreground">No posts from this user yet</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          <div className="max-w-3xl mx-auto">
            <UserGroupsList groups={userGroups} isLoading={isLoadingGroups} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}