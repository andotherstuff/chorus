import { useCurrentUser } from "@/hooks/useCurrentUser";
import Header from "@/components/ui/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GroupSearch } from "@/components/groups/GroupSearch";
import { useState, useMemo, useEffect } from "react";
import { useGroupStats } from "@/hooks/useGroupStats";
import { usePinnedGroups } from "@/hooks/usePinnedGroups";
import { useUnifiedGroups } from "@/hooks/useUnifiedGroups";
import { GroupCard } from "@/components/groups/GroupCard";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { PWAInstallInstructions } from "@/components/PWAInstallInstructions";
import type { NostrEvent } from "@nostrify/nostrify";
import type { UserRole } from "@/hooks/useUserRole";
import type { Group } from "@/types/groups";
import { getCommunityId } from "@/lib/group-utils";
import { Badge } from "@/components/ui/badge";

export default function Groups() {
  const { user } = useCurrentUser();
  const { pinGroup, unpinGroup, isGroupPinned, isUpdating } = usePinnedGroups();
  const [searchQuery, setSearchQuery] = useState("");
  const [showPWAInstructions, setShowPWAInstructions] = useState(false);

  // Fetch unified groups (both NIP-72 and NIP-29)
  const {
    data: unifiedGroupsData,
    isLoading: isLoadingGroups,
    error: groupsError,
  } = useUnifiedGroups();

  // Get all groups from the unified data
  const allGroups: Group[] = useMemo(() => {
    return unifiedGroupsData?.allGroups || [];
  }, [unifiedGroupsData]);

  // Use NIP-72 events for group stats
  const nip72Events = useMemo(() => {
    return unifiedGroupsData?.nip72Events || [];
  }, [unifiedGroupsData]);

  const {
    data: groupStatsResults = {},
    isLoading: isLoadingStats,
    refetch: refetchStats,
  } = useGroupStats(nip72Events);

  // Extract user groups from unified data
  const userGroups = useMemo(() => {
    if (!unifiedGroupsData) return [];
    
    const { pinned, owned, moderated, member } = unifiedGroupsData;
    const allUserGroups = [...pinned, ...owned, ...moderated, ...member];
    
    return allUserGroups.map(group => ({
      id: getCommunityId(group),
      role: "member" as UserRole, // Default role, could be enhanced
    }));
  }, [unifiedGroupsData]);

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

  const isLoading = isLoadingGroups;
  const error = groupsError;

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
            Discover and join communities. Now supports both public communities (NIP-72) and private groups (NIP-29)!
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
