import { useNostr } from "@/hooks/useNostr";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Users, Crown, Shield, User, ArrowRight } from "lucide-react";
import type { NostrEvent } from "@nostrify/nostrify";
import { parseNostrAddress } from "@/lib/nostr-utils";
import { useAuthor } from "@/hooks/useAuthor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

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

// Modern role indicator component
function RoleIndicator({ 
  role,
  label,
  variant = "default"
}: { 
  role: "owner" | "moderator" | "member";
  label?: string;
  variant?: "default" | "muted";
}) {
  const getRoleIcon = () => {
    switch (role) {
      case "owner":
        return <Crown className="h-3.5 w-3.5" />;
      case "moderator":
        return <Shield className="h-3.5 w-3.5" />;
      case "member":
        return <User className="h-3.5 w-3.5" />;
    }
  };

  const getRoleColor = () => {
    if (variant === "muted") {
      switch (role) {
        case "owner":
          return "text-blue-500 dark:text-blue-400";
        case "moderator":
          return "text-green-500 dark:text-green-400";
        case "member":
          return "text-gray-500 dark:text-gray-400";
      }
    } else {
      switch (role) {
        case "owner":
          return "text-blue-600 dark:text-blue-400";
        case "moderator":
          return "text-green-600 dark:text-green-400";
        case "member":
          return "text-gray-600 dark:text-gray-400";
      }
    }
  };

  const roleText = role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <div className="flex items-center gap-1.5">
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <div className={`flex items-center gap-1 ${getRoleColor()}`}>
        {getRoleIcon()}
        <span className="text-xs font-medium">{roleText}</span>
      </div>
    </div>
  );
}

// User avatar with role indicator
function UserWithRole({
  pubkey,
  role,
  size = "sm"
}: {
  pubkey: string;
  role: "owner" | "moderator" | "member";
  size?: "sm" | "xs";
}) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || pubkey.slice(0, 8);
  const avatarSize = size === "xs" ? "h-6 w-6" : "h-8 w-8";

  return (
    <div className="flex items-center gap-2">
      <Avatar className={`${avatarSize}`}>
        <AvatarImage src={metadata?.picture} />
        <AvatarFallback className="text-xs">
          {displayName.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="text-xs font-medium">{displayName}</span>
        <RoleIndicator role={role} variant="muted" />
      </div>
    </div>
  );
}

export function CommonGroupsListImproved({ profileUserPubkey }: CommonGroupsListProps) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const profileAuthor = useAuthor(profileUserPubkey);
  const profileMetadata = profileAuthor.data?.metadata;
  const profileDisplayName = profileMetadata?.name || profileUserPubkey.slice(0, 8);

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
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Shared Groups</h3>
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-14 w-14 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!commonGroups || commonGroups.length === 0) {
    return null; // Don't show section if no common groups
  }

  return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Shared Groups</h3>
        </div>
        <Badge variant="secondary" className="text-xs font-medium">
          {commonGroups.length} {commonGroups.length === 1 ? 'group' : 'groups'}
        </Badge>
      </div>
      
      <div className="space-y-3">
        {commonGroups.map((group) => (
          <Link
            key={group.id}
            to={`/group/${encodeURIComponent(group.id)}`}
            className="block group"
          >
            <Card className="overflow-hidden hover:shadow-md transition-all duration-200 hover:border-primary/20">
              <div className="p-4">
                {/* Group info section */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="h-14 w-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted relative">
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
                      className={`absolute inset-0 bg-primary/10 text-primary font-bold text-lg flex items-center justify-center ${group.image ? 'hidden' : 'flex'}`}
                    >
                      {group.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-base group-hover:text-primary transition-colors">{group.name}</h4>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {group.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {group.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Role comparison section */}
                <div className="bg-muted/30 dark:bg-muted/20 rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <UserWithRole 
                        pubkey={user.pubkey} 
                        role={group.currentUserRole}
                        size="xs"
                      />
                    </div>
                    <div>
                      <UserWithRole 
                        pubkey={profileUserPubkey} 
                        role={group.profileUserRole}
                        size="xs"
                      />
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