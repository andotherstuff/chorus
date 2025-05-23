import { useNostr } from "@/hooks/useNostr";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Users, Crown, Shield, User } from "lucide-react";
import type { NostrEvent } from "@nostrify/nostrify";
import { parseNostrAddress } from "@/lib/nostr-utils";

interface CommonGroup {
  id: string;
  name: string;
  description: string;
  image: string | undefined;
  groupEvent: NostrEvent;
  currentUserRole: "owner" | "moderator" | "member";
  profileUserRole: "owner" | "moderator" | "member";
}

interface CommonGroupsListProps {
  profileUserPubkey: string;
}

// Helper function to get community ID
const getCommunityId = (community: NostrEvent) => {
  const dTag = community.tags.find(tag => tag[0] === "d");
  return `34550:${community.pubkey}:${dTag ? dTag[1] : ""}`;
};

// Helper function to determine user's role in a group
const getUserRole = (group: NostrEvent, userPubkey: string): "owner" | "moderator" | "member" => {
  // Check if user is the owner (creator) of the group
  if (group.pubkey === userPubkey) {
    return "owner";
  }

  // Check if user is a moderator
  const moderatorTags = group.tags.filter(
    tag => tag[0] === "p" && tag[3] === "moderator"
  );
  const isModerator = moderatorTags.some(tag => tag[1] === userPubkey);
  
  if (isModerator) {
    return "moderator";
  }

  return "member";
};

// Role badge component with different styles for current user vs profile user
function RoleBadge({ 
  role, 
  isCurrentUser, 
  size = "sm" 
}: { 
  role: "owner" | "moderator" | "member"; 
  isCurrentUser: boolean;
  size?: "sm" | "xs";
}) {
  const getIcon = () => {
    switch (role) {
      case "owner":
        return <Crown className={`${size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} mr-1`} />;
      case "moderator":
        return <Shield className={`${size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} mr-1`} />;
      case "member":
        return <User className={`${size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} mr-1`} />;
    }
  };

  const getVariant = () => {
    if (isCurrentUser) {
      // Current user roles - solid colors
      switch (role) {
        case "owner":
          return "default"; // Blue
        case "moderator":
          return "secondary"; // Gray
        case "member":
          return "outline"; // Outline
      }
    } else {
      // Profile user roles - muted colors
      switch (role) {
        case "owner":
          return "default"; // Blue but will be styled differently
        case "moderator":
          return "secondary"; // Gray but will be styled differently  
        case "member":
          return "outline"; // Outline but will be styled differently
      }
    }
  };

  const getCustomClasses = () => {
    if (isCurrentUser) {
      // Current user - bright, solid colors
      switch (role) {
        case "owner":
          return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800";
        case "moderator":
          return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800";
        case "member":
          return "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300 border-gray-300 dark:border-gray-600";
      }
    } else {
      // Profile user - muted, subtle colors
      switch (role) {
        case "owner":
          return "bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 border-blue-100 dark:border-blue-900/30";
        case "moderator":
          return "bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400 border-green-100 dark:border-green-900/30";
        case "member":
          return "bg-gray-50 text-gray-500 dark:bg-gray-900/20 dark:text-gray-400 border-gray-200 dark:border-gray-800/50";
      }
    }
  };

  const roleText = role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <Badge 
      variant={getVariant()}
      className={`${getCustomClasses()} ${size === "xs" ? "text-xs px-1.5 py-0.5 h-5" : "text-xs px-2 py-0.5 h-6"} font-medium flex items-center`}
    >
      {getIcon()}
      {roleText}
    </Badge>
  );
}

export function CommonGroupsList({ profileUserPubkey }: CommonGroupsListProps) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  const { data: commonGroups, isLoading } = useQuery({
    queryKey: ["common-groups", user?.pubkey, profileUserPubkey],
    queryFn: async (c) => {
      if (!user || !nostr || !profileUserPubkey || user.pubkey === profileUserPubkey) {
        return [];
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);

      // Get membership events for both users
      const [currentUserMemberships, profileUserMemberships] = await Promise.all([
        nostr.query([{ kinds: [14550], "#p": [user.pubkey], limit: 100 }], { signal }),
        nostr.query([{ kinds: [14550], "#p": [profileUserPubkey], limit: 100 }], { signal })
      ]);

      // Get communities owned/moderated by both users
      const [currentUserCommunities, profileUserCommunities] = await Promise.all([
        nostr.query([
          { kinds: [34550], authors: [user.pubkey] },
          { kinds: [34550], "#p": [user.pubkey] }
        ], { signal }),
        nostr.query([
          { kinds: [34550], authors: [profileUserPubkey] },
          { kinds: [34550], "#p": [profileUserPubkey] }
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

      if (commonCommunityIds.length === 0) {
        return [];
      }

      // Fetch community details for common groups
      const communityFilters = commonCommunityIds.map(id => {
        const parts = id.split(":");
        if (parts.length === 3) {
          return {
            kinds: [parseInt(parts[0])],
            authors: [parts[1]],
            "#d": [parts[2]]
          };
        }
        return null;
      }).filter((filter): filter is NonNullable<typeof filter> => filter !== null);

      if (communityFilters.length === 0) {
        return [];
      }

      const communityEvents = await nostr.query(communityFilters, { signal });

      // Build common groups with role information
      const commonGroups: CommonGroup[] = [];

      for (const event of communityEvents) {
        const communityId = getCommunityId(event);
        
        // Only include if both users are actually members
        if (currentUserCommunityIds.has(communityId) && profileUserCommunityIds.has(communityId)) {
          const nameTag = event.tags.find(tag => tag[0] === "name");
          const descriptionTag = event.tags.find(tag => tag[0] === "description");
          const imageTag = event.tags.find(tag => tag[0] === "image");

          commonGroups.push({
            id: communityId,
            name: nameTag ? nameTag[1] : (event.tags.find(tag => tag[0] === "d")?.[1] || "Unnamed Group"),
            description: descriptionTag ? descriptionTag[1] : "",
            image: imageTag ? imageTag[1] : undefined,
            groupEvent: event,
            currentUserRole: getUserRole(event, user.pubkey),
            profileUserRole: getUserRole(event, profileUserPubkey)
          });
        }
      }

      // Sort by name
      return commonGroups.sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!nostr && !!user && !!profileUserPubkey && user.pubkey !== profileUserPubkey,
  });

  // Don't show anything if viewing own profile
  if (!user || !profileUserPubkey || user.pubkey === profileUserPubkey) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Groups in Common</h3>
        </div>
        <div className="space-y-3">
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
      </div>
    );
  }

  if (!commonGroups || commonGroups.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Groups in Common</h3>
        </div>
        <div className="p-6 text-center bg-muted/30 rounded-lg">
          <p className="text-muted-foreground text-sm">No groups in common</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Groups in Common</h3>
        <Badge variant="secondary" className="text-xs">
          {commonGroups.length}
        </Badge>
      </div>
      
      <div className="space-y-3">
        {commonGroups.map((group) => (
          <Link
            key={group.id}
            to={`/group/${encodeURIComponent(group.id)}`}
            className="block"
          >
            <Card className="overflow-hidden border border-border/40 hover:border-border hover:shadow-sm transition-all duration-200">
              <div className="flex p-4">
                <div className="h-12 w-12 rounded-lg overflow-hidden mr-3 flex-shrink-0 bg-muted relative">
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
                    className={`absolute inset-0 bg-primary/10 text-primary font-bold text-sm flex items-center justify-center ${group.image ? 'hidden' : 'flex'}`}
                  >
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm truncate pr-2">{group.name}</h4>
                  </div>
                  
                  {group.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                      {group.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">You:</span>
                      <RoleBadge role={group.currentUserRole} isCurrentUser={true} size="xs" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Them:</span>
                      <RoleBadge role={group.profileUserRole} isCurrentUser={false} size="xs" />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}