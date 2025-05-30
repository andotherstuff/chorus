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
  Users, 
  Pencil,
  Calendar, 
  MessageCircle,
  MessageSquare,
  Heart,
  Share2,
  LinkIcon,
  MoreVertical,
  Flag,
  QrCode,
  ArrowRight,
  Crown,
  Shield,
  User,
  Timer
} from "lucide-react";
import { toast } from "sonner";
import type { NostrEvent } from "@nostrify/nostrify";
import { parseNostrAddress } from "@/lib/nostr-utils";
import Header from "@/components/ui/Header";
import { VerifiedNip05 } from "@/components/VerifiedNip05";
import { useNip05Verification } from "@/hooks/useNip05Verification";
import { cn, formatRelativeTime } from "@/lib/utils";
import { shareContent } from "@/lib/share";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { EmojiReactionButton } from "@/components/EmojiReactionButton";
import { NutzapButton } from "@/components/groups/NutzapButton";
import { NutzapInterface } from "@/components/groups/NutzapInterface";
import { ReplyList } from "@/components/groups/ReplyList";
import { KINDS } from "@/lib/nostr-kinds";
import { nip19 } from 'nostr-tools';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QRCodeModal } from "@/components/QRCodeModal";
import { CommonGroupsListImproved } from "@/components/profile/CommonGroupsListImproved";
import { useIsGroupDeleted, useGroupDeletionRequests } from "@/hooks/useGroupDeletionRequests";

// Hook to get shared group IDs
function useSharedGroupIds(profileUserPubkey: string): string[] {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  const { data: sharedGroupIds = [] } = useQuery({
    queryKey: ["shared-group-ids", user?.pubkey, profileUserPubkey],
    queryFn: async (c) => {
      if (!user || !nostr || !profileUserPubkey || user.pubkey === profileUserPubkey) {
        return [];
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);

      // Helper function to get community ID
      const getCommunityId = (community: NostrEvent) => {
        const dTag = community.tags.find(tag => tag[0] === "d");
        return `34550:${community.pubkey}:${dTag ? dTag[1] : ""}`;
      };

      // Get membership events for both users
      const [currentUserMemberships, profileUserMemberships] = await Promise.all([
        nostr.query([{ kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST], "#p": [user.pubkey], limit: 100 }], { signal }),
        nostr.query([{ kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST], "#p": [profileUserPubkey], limit: 100 }], { signal })
      ]);

      // Get communities owned/moderated by both users
      const [currentUserCommunities, profileUserCommunities] = await Promise.all([
        nostr.query([
          { kinds: [KINDS.GROUP], authors: [user.pubkey] },
          { kinds: [KINDS.GROUP], "#p": [user.pubkey] }
        ], { signal }),
        nostr.query([
          { kinds: [KINDS.GROUP], authors: [profileUserPubkey] },
          { kinds: [KINDS.GROUP], "#p": [profileUserPubkey] }
        ], { signal })
      ]);

      // Extract community IDs for current user
      const currentUserCommunityIds = new Set<string>();
      
      // From memberships
      for (const membership of currentUserMemberships) {
        const aTag = membership.tags.find(tag => tag[0] === "a");
        if (aTag) currentUserCommunityIds.add(aTag[1]);
      }
      
      // From owned/moderated communities
      for (const community of currentUserCommunities) {
        const communityId = getCommunityId(community);
        currentUserCommunityIds.add(communityId);
      }

      // Extract community IDs for profile user
      const profileUserCommunityIds = new Set<string>();
      
      // From memberships
      for (const membership of profileUserMemberships) {
        const aTag = membership.tags.find(tag => tag[0] === "a");
        if (aTag) profileUserCommunityIds.add(aTag[1]);
      }
      
      // From owned/moderated communities
      for (const community of profileUserCommunities) {
        const communityId = getCommunityId(community);
        profileUserCommunityIds.add(communityId);
      }

      // Find common community IDs
      const commonCommunityIds = [...currentUserCommunityIds].filter(id => 
        profileUserCommunityIds.has(id)
      );

      return commonCommunityIds;
    },
    enabled: !!nostr && !!user && !!profileUserPubkey && user.pubkey !== profileUserPubkey,
  });

  return sharedGroupIds;
}

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
  const { isDeleted } = useIsGroupDeleted(groupId);

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

  // Show "Deleted" if the group has been deleted
  if (isDeleted) {
    return <span className="font-medium text-muted-foreground">Deleted</span>;
  }

  return <span className="font-medium">{groupName || "Group"}</span>;
}

// Component to display group information on a post
function PostGroupLink({ post }: { post: NostrEvent }) {
  const groupInfo = extractGroupInfo(post);
  const { isDeleted } = useIsGroupDeleted(groupInfo?.groupId);

  if (!groupInfo) return null;

  // If the group is deleted, show a non-clickable version
  if (isDeleted) {
    return (
      <div className="flex items-center text-xs md:text-sm text-muted-foreground">
        <div className="flex items-center px-2 py-1 rounded-full bg-muted/70">
          <Users className="h-3 w-3 md:h-4 md:w-4 mr-1.5" />
          <GroupNameDisplay groupId={groupInfo.groupId} />
        </div>
      </div>
    );
  }

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
  image: string | undefined;
  membershipEvent: NostrEvent;
  groupEvent: NostrEvent;
}

// Modern role badge component with optional avatar
function RoleBadge({ 
  role, 
  size = "default",
  userPubkey,
  showAvatar = false,
  simplified = false
}: { 
  role: "owner" | "moderator" | "member";
  size?: "default" | "sm";
  userPubkey?: string;
  showAvatar?: boolean;
  simplified?: boolean;
}) {
  const author = useAuthor(userPubkey);
  const metadata = showAvatar && userPubkey ? author.data?.metadata : null;
  
  const getIcon = () => {
    const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
    switch (role) {
      case "owner":
        return <Crown className={`${iconSize} ${showAvatar && !simplified ? '' : 'mr-1'}`} />;
      case "moderator":
        return <Shield className={`${iconSize} ${showAvatar && !simplified ? '' : 'mr-1'}`} />;
      case "member":
        return null; // No icon for regular members
    }
  };

  const getRoleStyles = () => {
    switch (role) {
      case "owner":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800";
      case "moderator":
        return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800";
      case "member":
        return "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700";
    }
  };

  if (role === "member") {
    return null; // Don't show badge for regular members
  }

  const roleText = role.charAt(0).toUpperCase() + role.slice(1);
  const paddingSize = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-0.5";

  // Simplified version: just show avatar and icon
  if (simplified && showAvatar && userPubkey) {
    return (
      <div className={`inline-flex items-center gap-1 ${paddingSize} text-xs font-medium rounded-md border ${getRoleStyles()}`}>
        <Avatar className="h-4 w-4">
          <AvatarImage src={metadata?.picture} />
          <AvatarFallback className="text-[8px]">
            {metadata?.name?.slice(0, 1).toUpperCase() || userPubkey.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {getIcon()}
      </div>
    );
  }

  // Original version with text
  return (
    <div className={`inline-flex items-center gap-1.5 ${paddingSize} text-xs font-medium rounded-md border ${getRoleStyles()}`}>
      {showAvatar && userPubkey && (
        <Avatar className="h-4 w-4">
          <AvatarImage src={metadata?.picture} />
          <AvatarFallback className="text-[8px]">
            {metadata?.name?.slice(0, 1).toUpperCase() || userPubkey.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      {getIcon()}
      <span>{roleText}</span>
    </div>
  );
}

function UserGroupsList({
  groups,
  isLoading,
  profileUserPubkey,
  sharedGroupIds = []
}: {
  groups: UserGroup[] | undefined;
  isLoading: boolean;
  profileUserPubkey: string;
  sharedGroupIds?: string[];
}) {
  const { user } = useCurrentUser();
  const isCurrentUser = user && profileUserPubkey === user.pubkey;
  const profileAuthor = useAuthor(profileUserPubkey);
  const profileMetadata = profileAuthor.data?.metadata;
  const profileDisplayName = profileMetadata?.name || profileUserPubkey.slice(0, 8);

  // Get group IDs for deletion checking
  const groupIds = groups?.map(group => group.id) || [];
  const { data: deletionRequests } = useGroupDeletionRequests(groupIds);

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
      <div className="p-8 text-center bg-muted/20 rounded-xl border border-border/50">
        <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-muted-foreground">
          {isCurrentUser ? "You are not a member of any groups yet" : "This user is not a member of any groups yet"}
        </p>
        {isCurrentUser && (
          <Link to="/groups" className="mt-3 inline-block">
            <Button variant="outline" size="sm">Explore Groups</Button>
          </Link>
        )}
      </div>
    );
  }

  // Create a map to deduplicate groups by ID and filter out shared groups and deleted groups
  const uniqueGroups = new Map<string, UserGroup>();
  for (const group of groups) {
    // Skip if this group is in the shared groups list (only when viewing another user's profile)
    if (!isCurrentUser && sharedGroupIds.includes(group.id)) {
      continue;
    }
    
    // Skip if this group has been deleted
    if (deletionRequests) {
      const deletionRequest = deletionRequests.get(group.id);
      if (deletionRequest?.isValid) {
        continue;
      }
    }
    
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

  // Sort groups by role (owner first, then moderator, then member)
  const sortedGroups = Array.from(uniqueGroups.values()).sort((a, b) => {
    const roleOrder = { owner: 0, moderator: 1, member: 2 };
    const aRole = getUserRole(a, profileUserPubkey);
    const bRole = getUserRole(b, profileUserPubkey);
    
    if (roleOrder[aRole] !== roleOrder[bRole]) {
      return roleOrder[aRole] - roleOrder[bRole];
    }
    
    // If same role, sort by name
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6">
      {/* Common Groups Section - only show when viewing another user's profile */}
      {!isCurrentUser && user && (
        <CommonGroupsListImproved profileUserPubkey={profileUserPubkey} />
      )}

      {/* User's Groups Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">
              {isCurrentUser ? "Your Groups" : `${profileDisplayName}'s Groups`}
            </h3>
          </div>
          <Badge variant="secondary" className="text-xs">
            {uniqueGroups.size} {uniqueGroups.size === 1 ? 'group' : 'groups'}
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {sortedGroups.map((group) => {
            const userRole = getUserRole(group, profileUserPubkey);
            
            return (
              <Link
                key={group.id}
                to={`/group/${encodeURIComponent(group.id)}`}
                className="block group"
              >
                <Card className="overflow-hidden hover:shadow-md transition-all duration-200 hover:border-primary/20">
                  <div className="flex p-4">
                    <div className="h-16 w-16 rounded-lg overflow-hidden mr-4 flex-shrink-0 bg-muted relative">
                      {group.image ? (
                        <img
                          src={group.image}
                          alt={group.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div 
                        className={`absolute inset-0 bg-primary/10 text-primary font-bold text-xl flex items-center justify-center ${group.image ? 'hidden' : 'flex'}`}
                      >
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base group-hover:text-primary transition-colors">{group.name}</h3>
                        <RoleBadge 
                          role={userRole} 
                          size="sm" 
                          userPubkey={profileUserPubkey}
                          showAvatar={!isCurrentUser}
                          simplified={!isCurrentUser}
                        />
                      </div>
                      {group.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {group.description}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center ml-2" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
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
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

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

export default function Profile() {
  const { pubkey } = useParams<{ pubkey: string }>();
  const location = useLocation();
  const author = useAuthor(pubkey);
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState("posts");
  const [showQRCode, setShowQRCode] = useState(false);

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
        kinds: [KINDS.GROUP_POST],
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
          kinds: [KINDS.GROUP],
          authors: [pubkey], // Communities they created
          limit: 50,
        }], { signal });

        groupEvents.push(...ownedOrModeratedEvents);

        // Get communities where user is a moderator but not owner
        const moderatedEvents = await nostr.query([{
          kinds: [KINDS.GROUP],
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
          kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST],
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
              kinds: [KINDS.GROUP],
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
          kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST],
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
            kinds: [KINDS.GROUP],
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
          kinds: [KINDS.GROUP],
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
          image: imageTag ? imageTag[1] : undefined,
          membershipEvent: event, // Using the group event as membership event
          groupEvent: event,
        };
      });
    },
    enabled: !!nostr && !!pubkey,
  });

  const metadata = author.data?.metadata;
  const displayName = metadata?.name || pubkey?.slice(0, 8) || "";
  const displayNameFull = displayName;
  const profileImage = metadata?.picture;
  const about = metadata?.about;
  const website = metadata?.website;
  const nip05 = metadata?.nip05;
  const banner = metadata?.banner;

  // Check NIP05 verification status
  const { data: nip05Verification } = useNip05Verification(nip05, pubkey || "");

  // Check if this is the current user's profile
  const isCurrentUser = user && pubkey === user.pubkey;

  // Get shared group IDs to filter them out from the main groups list
  const sharedGroupIds = useSharedGroupIds(pubkey || "");

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
          {/* Profile info skeleton - matches new layout */}
          <div className="max-w-3xl mx-auto relative mb-6 mt-4">
            {/* Top row: Avatar and name/username side by side */}
            <div className="flex items-center gap-4 mb-4">
              <Skeleton className="h-20 w-20 rounded-full border-4 border-background shadow-md" />
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            
            {/* Middle row: Bio */}
            <div className="w-full mb-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            </div>

            {/* Bottom row: Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>

          {/* Tabs skeleton */}
          <div className="w-full">
            <div className="md:flex md:justify-start">
              <div className="mb-4 w-full md:w-auto flex gap-1 p-1 bg-muted rounded-lg">
                <Skeleton className="h-8 w-24 rounded-md" />
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
            </div>
            
            {/* Content skeleton - matches post layout */}
            <div className="max-w-3xl mx-auto">
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
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-1 px-3 sm:px-4">
      <Header />

      <div className="max-w-3xl mx-auto relative mb-6 mt-4">
        {/* Top row: Avatar and name/username side by side */}
        <div className="flex items-center gap-4 mb-4">
          <Avatar className="h-20 w-20 rounded-full border-4 border-background shadow-md">
            <AvatarImage src={profileImage} />
            <AvatarFallback className="text-xl bg-primary/10">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{displayNameFull}</h1>
              {/* QR Code button - icon only, right next to name */}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowQRCode(true)}
              >
                <QrCode className="h-4 w-4" />
                <span className="sr-only">Show QR Code</span>
              </Button>
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
          {/* Website button - first if exists */}
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

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQRCode}
        onClose={() => setShowQRCode(false)}
        profileUrl={`${window.location.origin}/profile/${pubkey}`}
        displayName={displayNameFull}
      />

      <div className="max-w-3xl mx-auto">
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
            <div className="w-full">
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
            <div className="w-full pb-6">
              <UserGroupsList 
                groups={userGroups} 
                isLoading={isLoadingGroups} 
                profileUserPubkey={pubkey || ""} 
                sharedGroupIds={sharedGroupIds}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}