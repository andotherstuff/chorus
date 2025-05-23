import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import Header from "@/components/ui/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GroupSearch } from "@/components/groups/GroupSearch";
import { useState, useMemo, useEffect } from "react";
import { useGroupStats } from "@/hooks/useGroupStats";
import { usePinnedGroups } from "@/hooks/usePinnedGroups";
import { useUserGroups } from "@/hooks/useUserGroups";
import { GroupCard } from "@/components/groups/GroupCard";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { PWAInstallInstructions } from "@/components/PWAInstallInstructions";
import type { NostrEvent } from "@nostrify/nostrify";
import type { UserRole } from "@/hooks/useUserRole";
import type { Group } from "@/types/groups";
import { parseGroup, getCommunityId, createGroupRouteId } from "@/lib/group-utils";
import { Badge } from "@/components/ui/badge";

// Helper function to get community ID for backward compatibility
const getLegacyCommunityId = (community: NostrEvent) => {
  const dTag = community.tags.find(tag => tag[0] === "d");
  return `34550:${community.pubkey}:${dTag ? dTag[1] : ""}`;
};

export default function Groups() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { pinGroup, unpinGroup, isGroupPinned, isUpdating } = usePinnedGroups();
  const [searchQuery, setSearchQuery] = useState("");
  const [showPWAInstructions, setShowPWAInstructions] = useState(false);

  // Fetch NIP-72 communities
  const {
    data: communities = [],
    isLoading: isLoadingCommunities,
    error: communitiesError,
  } = useQuery({
    queryKey: ["communities"],
    queryFn: async () => {
      const signal = AbortSignal.timeout(10000);
      try {
        const events = await nostr.query([{ kinds: [34550] }], { signal });
        return events;
      } catch (error) {
        console.error("Error fetching NIP-72 communities:", error);
        return [];
      }
    },
  });

  // Convert NostrEvents to Groups for unified interface
  const allGroups: Group[] = useMemo(() => {
    return communities
      .map(community => parseGroup(community))
      .filter((group): group is Group => group !== null);
  }, [communities]);

  // Use the main branch's API correctly
  const {
    data: groupStatsResults = {},
    isLoading: isLoadingStats,
    refetch: refetchStats,
  } = useGroupStats(communities);

  const {
    data: userGroupsData,
    isLoading: isLoadingUserGroups,
  } = useUserGroups();

  // Extract user groups properly
  const userGroups = useMemo(() => {
    if (!userGroupsData) return [];
    
    const allUserGroups = [
      ...(userGroupsData.pinned || []),
      ...(userGroupsData.owned || []),
      ...(userGroupsData.moderated || []),
      ...(userGroupsData.member || []),
    ];
    
    return allUserGroups.map(community => ({
      id: getLegacyCommunityId(community),
      role: "member" as UserRole, // Default role, could be enhanced
    }));
  }, [userGroupsData]);

  // Filter groups based on search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return allGroups;
    }

    const query = searchQuery.toLowerCase();
    return allGroups.filter(group => {
      return (
        group.name?.toLowerCase().includes(query) ||
        group.description?.toLowerCase().includes(query) ||
        group.id.toLowerCase().includes(query)
      );
    });
  }, [allGroups, searchQuery]);

  // Categorize groups
  const { pinnedGroups, memberGroups, allOtherGroups } = useMemo(() => {
    const pinned: Group[] = [];
    const member: Group[] = [];
    const other: Group[] = [];

    const userGroupIds = new Set(userGroups.map(ug => ug.id));

    filteredGroups.forEach(group => {
      const communityId = getCommunityId(group);
      const isPinned = isGroupPinned(communityId);
      const isMember = userGroupIds.has(communityId);

      if (isPinned) {
        pinned.push(group);
      } else if (isMember) {
        member.push(group);
      } else {
        other.push(group);
      }
    });

    // Sort by recent activity
    const sortByActivity = (a: Group, b: Group) => {
      const aId = getCommunityId(a);
      const bId = getCommunityId(b);
      const aStats = groupStatsResults[aId];
      const bStats = groupStatsResults[bId];
      const aPosts = aStats?.posts || 0;
      const bPosts = bStats?.posts || 0;
      return bPosts - aPosts;
    };

    return {
      pinnedGroups: pinned.sort(sortByActivity),
      memberGroups: member.sort(sortByActivity),
      allOtherGroups: other.sort(sortByActivity),
    };
  }, [filteredGroups, userGroups, groupStatsResults, isGroupPinned]);

  // Auto-refresh stats periodically
  useEffect(() => {
    if (allGroups.length > 0) {
      const interval = setInterval(() => {
        refetchStats();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [allGroups.length, refetchStats]);

  const isLoading = isLoadingCommunities || isLoadingUserGroups;
  const error = communitiesError;

  if (error) {
    console.error("Error fetching groups:", error);
  }

  const renderGroupSection = (title: string, groups: Group[], showCount = true) => {
    if (groups.length === 0) return null;

    return (
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          {title}
          {showCount && (
            <Badge variant="secondary" className="text-xs">
              {groups.length}
            </Badge>
          )}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map(group => {
            const communityId = getCommunityId(group);
            const userGroup = userGroups.find(ug => ug.id === communityId);
            const stats = groupStatsResults[communityId];

            return (
              <GroupCard
                key={communityId}
                community={group}
                isPinned={isGroupPinned(communityId)}
                pinGroup={pinGroup}
                unpinGroup={unpinGroup}
                isUpdating={isUpdating}
                isMember={!!userGroup}
                userRole={userGroup?.role}
                stats={stats}
                isLoadingStats={isLoadingStats}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const renderLoadingCard = () => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-3 px-3 sm:px-4">
      <Header />
      <PWAInstallBanner />
      <PWAInstallInstructions 
        isOpen={showPWAInstructions} 
        onClose={() => setShowPWAInstructions(false)} 
      />

      <div className="space-y-6 mt-6">
        <div>
          <h1 className="text-3xl font-bold">Groups</h1>
          <p className="text-muted-foreground mt-2">
            Discover and join communities. Enhanced with NIP-29 private group support coming soon!
          </p>
        </div>

        <GroupSearch onSearch={setSearchQuery} />

        {isLoading ? (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-4">Loading Groups...</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i}>{renderLoadingCard()}</div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div>
            {renderGroupSection("📌 Pinned Groups", pinnedGroups)}
            {renderGroupSection("✅ Your Groups", memberGroups)}
            {renderGroupSection("🌍 All Groups", allOtherGroups)}

            {filteredGroups.length === 0 && !isLoading && (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground text-lg">
                    {searchQuery.trim() 
                      ? `No groups found matching "${searchQuery}"`
                      : "No groups available"
                    }
                  </p>
                  {!searchQuery.trim() && (
                    <p className="text-muted-foreground mt-2">
                      Create your first group to get started!
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
