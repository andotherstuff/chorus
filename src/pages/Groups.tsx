import { useCurrentUser } from "@/hooks/useCurrentUser";
import Header from "@/components/ui/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GroupSearch } from "@/components/groups/GroupSearch";
import { useState, useMemo, useEffect, useCallback } from "react";
import { TrendingUp, Pin, Users, Clock, Activity } from "lucide-react";
import { useGroupStats } from "@/hooks/useGroupStats";
import { useNip29GroupStats } from "@/hooks/useNip29GroupStats";
import { usePinnedGroups } from "@/hooks/usePinnedGroups";
import { useUnifiedGroupsWithCache } from "@/hooks/useUnifiedGroupsWithCache";
import { useGroupDeletionRequests } from "@/hooks/useGroupDeletionRequests";
import { useUserPendingJoinRequests } from "@/hooks/useUserPendingJoinRequests";
import { GroupCard } from "@/components/groups/GroupCard";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { PWAInstallInstructions } from "@/components/PWAInstallInstructions";
import type { NostrEvent } from "@nostrify/nostrify";
import type { UserRole } from "@/hooks/useUserRole";
import type { Group } from "@/types/groups";
import { getCommunityId, parseGroup } from "@/lib/group-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/Icon";
import { useCashuWallet } from "@/hooks/useCashuWallet";
import { useSearchParams } from "react-router-dom";
import { useUserGroups } from "@/hooks/useUserGroups";

export default function Groups() {
  const { user } = useCurrentUser();
  const { pinGroup, unpinGroup, isGroupPinned, isUpdating } = usePinnedGroups();
  const [searchQuery, setSearchQuery] = useState("");
  const [showPWAInstructions, setShowPWAInstructions] = useState(false);
  const { wallet, isLoading: isWalletLoading } = useCashuWallet();
  const [searchParams] = useSearchParams();
  const filterMyGroups = searchParams.get("filter") === "my-groups";
  
  // Get the user's groups for membership checking
  const { data: userGroups } = useUserGroups();

  // Log wallet data when it loads
  useEffect(() => {
    if (wallet) {
      console.log("Wallet loaded in Groups page:", wallet);
    }
  }, [wallet]);

  // Listen for PWA instructions event from banner
  useEffect(() => {
    const handleOpenPWAInstructions = () => {
      setShowPWAInstructions(true);
    };

    window.addEventListener("open-pwa-instructions", handleOpenPWAInstructions);
    return () => {
      window.removeEventListener(
        "open-pwa-instructions",
        handleOpenPWAInstructions
      );
    };
  }, []);

  // Fetch unified groups (both NIP-72 and NIP-29) with caching
  const {
    groups: allGroups,
    isLoading: isLoadingGroups,
    error: groupsError,
    cacheStatus,
  } = useUnifiedGroupsWithCache();

  // Extract NIP-72 groups for stats
  const nip72Groups = useMemo(() => {
    return allGroups.filter(g => g.type === 'nip72');
  }, [allGroups]);

  // Extract NIP-29 groups for stats
  const nip29Groups = useMemo(() => {
    return allGroups.filter(g => g.type === 'nip29');
  }, [allGroups]);

  // Get community references for stats fetching
  const communityRefs = useMemo(() => {
    return nip72Groups.map(group => {
      if (group.type === 'nip72') {
        return `34550:${group.pubkey}:${group.identifier}`;
      }
      return null;
    }).filter(Boolean) as string[];
  }, [nip72Groups]);

  // Fetch stats for NIP-72 groups using community references
  const { data: groupStats, isLoading: isLoadingStats } = useGroupStats(
    communityRefs,
    !isLoadingGroups && communityRefs.length > 0
  );

  // Fetch stats for NIP-29 groups
  const { data: nip29GroupStats, isLoading: isLoadingNip29Stats } = useNip29GroupStats(
    nip29Groups,
    !isLoadingGroups && nip29Groups.length > 0
  );


  // Get user's role for each group
  const getUserRoleForGroup = useCallback((group: Group): UserRole | null => {
    if (!user) return null;
    
    if (group.pubkey === user.pubkey) {
      return "owner";
    }
    
    if (group.type === "nip72" && group.moderators.includes(user.pubkey)) {
      return "moderator";
    }
    
    if (group.type === "nip29" && group.admins.includes(user.pubkey)) {
      return "moderator"; // NIP-29 admins are equivalent to moderators
    }
    
    if (group.type === "nip29" && group.members?.includes(user.pubkey)) {
      return "member";
    }
    
    return null;
  }, [user]);

  // Get user's pending join requests
  const {
    data: pendingJoinRequests = [],
    isLoading: isPendingRequestsLoading,
  } = useUserPendingJoinRequests();

  // Get group IDs for deletion request checking
  const groupIds = useMemo(() => {
    if (!allGroups) return [];
    return allGroups.map(getCommunityId);
  }, [allGroups]);

  // Check for deletion requests
  const { data: deletionRequestsMap } = useGroupDeletionRequests(groupIds);

  // Create a set of pending join request community IDs for quick lookup
  const pendingJoinRequestsSet = useMemo(() => {
    return new Set(pendingJoinRequests);
  }, [pendingJoinRequests]);

  // Create a set of group IDs where the user is a member
  const userGroupIds = useMemo(() => {
    const groupIds = new Set<string>();
    
    if (userGroups?.allGroups) {
      // Add all NIP-72 groups from useUserGroups
      userGroups.allGroups.forEach(event => {
        const group = parseGroup(event);
        if (group) {
          groupIds.add(getCommunityId(group));
        }
      });
    }
    
    return groupIds;
  }, [userGroups]);

  // Filter and categorize all groups
  const { categorizedGroups, allFilteredGroups } = useMemo(() => {
    if (!allGroups || allGroups.length === 0) return { 
      categorizedGroups: {
        pinned: [],
        owned: [],
        moderated: [],
        member: [],
        pending: [],
        other: []
      },
      allFilteredGroups: []
    };

    // Function to check if a group matches the search query
    const matchesSearch = (group: Group) => {
      if (!searchQuery) return true;

      const searchLower = searchQuery.toLowerCase();
      return (
        group.name?.toLowerCase().includes(searchLower) ||
        group.description?.toLowerCase().includes(searchLower) ||
        group.id.toLowerCase().includes(searchLower)
      );
    };

    // Function to check if a group has been deleted
    const isGroupDeleted = (group: Group) => {
      if (!deletionRequestsMap) return false;
      const groupId = getCommunityId(group);
      const deletionRequest = deletionRequestsMap.get(groupId);
      return deletionRequest?.isValid || false;
    };
    
    // Function to check if user is part of a group
    const isUserGroup = (group: Group) => {
      if (!user || !filterMyGroups) return true;
      
      const groupId = getCommunityId(group);
      
      // Check if user is owner
      if (group.pubkey === user.pubkey) {
        return true;
      }
      
      // Check if user is moderator/admin
      if (group.type === "nip72" && group.moderators.includes(user.pubkey)) {
        return true;
      }
      if (group.type === "nip29" && group.admins.includes(user.pubkey)) {
        return true;
      }
      
      // Check if user is member
      if (group.type === "nip29" && group.members?.includes(user.pubkey)) {
        return true;
      }
      
      // Check if user has pending request
      if (pendingJoinRequestsSet.has(groupId)) {
        return true;
      }
      
      // Check if this group is in the user's group IDs set (for NIP-72 membership)
      if (userGroupIds.has(groupId)) {
        return true;
      }
      
      return false;
    };

    // Create a stable copy of the array and filter
    const stableGroups = [...allGroups];
    const filteredGroups = stableGroups.filter(group => matchesSearch(group) && !isGroupDeleted(group) && isUserGroup(group));

    // Categorize groups
    const categories = {
      pinned: [] as Group[],
      owned: [] as Group[],
      moderated: [] as Group[],
      member: [] as Group[],
      pending: [] as Group[],
      other: [] as Group[]
    };

    for (const group of filteredGroups) {
      try {
        const groupId = getCommunityId(group);
        const isPinned = isGroupPinned(groupId);
        const userRole = getUserRoleForGroup(group);
        const hasPendingRequest = pendingJoinRequestsSet.has(groupId);

        if (isPinned) {
          categories.pinned.push(group);
        } else if (userRole === "owner") {
          categories.owned.push(group);
        } else if (userRole === "moderator") {
          categories.moderated.push(group);
        } else if (userRole === "member" || userGroupIds.has(groupId)) {
          categories.member.push(group);
        } else if (hasPendingRequest) {
          categories.pending.push(group);
        } else {
          categories.other.push(group);
        }
      } catch (error) {
        console.error("Error categorizing group:", error);
        categories.other.push(group);
      }
    }

    // Sort function that prioritizes activity
    const sortByActivity = (a: Group, b: Group) => {
      try {
        // Activity-based sorting for NIP-72 groups
        if (groupStats && a.type === 'nip72' && b.type === 'nip72') {
          const aId = getCommunityId(a);
          const bId = getCommunityId(b);
          const aStats = groupStats[aId];
          const bStats = groupStats[bId];
          
          if (aStats && bStats) {
            const aActivity = aStats.posts + aStats.participants.size;
            const bActivity = bStats.posts + bStats.participants.size;
            
            if (aActivity !== bActivity) {
              return bActivity - aActivity; // Higher activity first
            }
          }
        }

        // Activity-based sorting for NIP-29 groups
        if (nip29GroupStats && a.type === 'nip29' && b.type === 'nip29') {
          const aStats = nip29GroupStats[a.groupId];
          const bStats = nip29GroupStats[b.groupId];
          
          if (aStats && bStats) {
            const aActivity = aStats.posts + aStats.participants.size;
            const bActivity = bStats.posts + bStats.participants.size;
            
            if (aActivity !== bActivity) {
              return bActivity - aActivity; // Higher activity first
            }
          }
        }

        // Mixed type sorting: prefer groups with any activity over groups with no activity
        if (a.type !== b.type) {
          const aHasActivity = a.type === 'nip72' 
            ? (groupStats?.[getCommunityId(a)]?.posts || 0) > 0
            : (nip29GroupStats?.[a.groupId]?.posts || 0) > 0;
          const bHasActivity = b.type === 'nip72' 
            ? (groupStats?.[getCommunityId(b)]?.posts || 0) > 0
            : (nip29GroupStats?.[b.groupId]?.posts || 0) > 0;
          
          if (aHasActivity && !bHasActivity) return -1;
          if (!aHasActivity && bHasActivity) return 1;
          
          // If both have activity or both don't, prefer NIP-72 groups
          return a.type === 'nip72' ? -1 : 1;
        }

        // Fall back to alphabetical sorting
        const aName = a.name?.toLowerCase() || "";
        const bName = b.name?.toLowerCase() || "";
        return aName.localeCompare(bName);
      } catch (error) {
        console.error("Error sorting groups:", error);
        return 0;
      }
    };

    // Sort each category by activity
    Object.values(categories).forEach(category => {
      category.sort(sortByActivity);
    });

    // Combine categories in order
    const allSorted = [
      ...categories.pinned,
      ...categories.owned,
      ...categories.moderated,
      ...categories.member,
      ...categories.pending,
      ...categories.other
    ];

    return {
      categorizedGroups: categories,
      allFilteredGroups: allSorted
    };
  }, [
    allGroups,
    searchQuery,
    isGroupPinned,
    getUserRoleForGroup,
    pendingJoinRequestsSet,
    deletionRequestsMap,
    groupStats,
    nip29GroupStats,
    filterMyGroups,
    user,
    userGroupIds,
  ]);

  // Helper function to get stats for any group type
  const getGroupStats = (community: Group) => {
    if (community.type === 'nip72') {
      const communityId = getCommunityId(community);
      return groupStats?.[communityId];
    } else if (community.type === 'nip29') {
      return nip29GroupStats?.[community.groupId];
    }
    return undefined;
  };

  // Helper function to check if stats are loading for a group
  const isLoadingStatsForGroup = (community: Group) => {
    if (community.type === 'nip72') {
      return isLoadingStats;
    } else if (community.type === 'nip29') {
      return isLoadingNip29Stats;
    }
    return false;
  };

  // Auto-refresh could be added here if needed

  const isLoading = isLoadingGroups || isPendingRequestsLoading;
  const isLoadingAnyStats = isLoadingStats || isLoadingNip29Stats;
  const error = groupsError;

  if (error) {
    console.error("Error fetching groups:", error);
  }

  // Loading state skeleton with stable keys
  const skeletonKeys = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, index) => `skeleton-group-${index}`),
    []
  );

  const renderSkeletons = () => (
    <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
      {skeletonKeys.map((key) => (
        <Card key={key} className="overflow-hidden flex flex-col h-[140px]">
          <CardHeader className="flex flex-row items-center space-y-0 gap-3 pt-4 pb-2 px-3">
            <Skeleton className="h-12 w-12 rounded-md" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-1">
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-3 w-8" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto py-3 px-3 sm:px-4">
      <Header />

      <div className="flex flex-col mt-2">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-3 gap-2">
          <div className="w-full md:w-64 lg:w-72">
            <GroupSearch
              onSearch={setSearchQuery}
              className="sticky top-0 z-10"
            />
            <div className="mt-2 flex justify-end md:hidden">
              <a
                href="/trending"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Trending Hashtags
              </a>
            </div>
          </div>
          <div className="hidden md:flex">
            <a
              href="/trending"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Trending Hashtags
            </a>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">
                {filterMyGroups ? "My Groups" : "Groups"}
              </h1>
              {filterMyGroups && (
                <a 
                  href="/groups" 
                  className="text-sm text-primary hover:underline"
                >
                  Show All Groups
                </a>
              )}
            </div>
            <p className="text-muted-foreground mt-2">
              {filterMyGroups 
                ? "Groups you own, moderate, or are a member of."
                : "Discover and join communities."}
            </p>
          </div>

          {isLoading ? (
            <div>
              <div className="text-center py-8">
                <h2 className="text-xl font-semibold mb-2">Searching for Groups</h2>
                <p className="text-muted-foreground mb-4">
                  Finding communities and groups across the network... This might take a moment.
                </p>
              </div>
              {renderSkeletons()}
            </div>
          ) : allGroups &&
            allFilteredGroups &&
            allFilteredGroups.length > 0 ? (
            <div className="space-y-6">
              {/* Pinned Groups */}
              {categorizedGroups.pinned.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Pin className="w-4 h-4" />
                    Pinned Groups
                  </h3>
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    {categorizedGroups.pinned.map((community) => {
                      const communityId = getCommunityId(community);
                      const isPinned = isGroupPinned(communityId);
                      const userRole = getUserRoleForGroup(community);
                      const hasPendingRequest = pendingJoinRequestsSet.has(communityId);
                      const stats = getGroupStats(community);

                      return (
                        <GroupCard
                          key={`pinned-${community.id}-${communityId}`}
                          community={community}
                          isPinned={isPinned}
                          pinGroup={pinGroup}
                          unpinGroup={unpinGroup}
                          isUpdating={isUpdating}
                          stats={stats}
                          isLoadingStats={isLoadingStatsForGroup(community)}
                          hasPendingRequest={hasPendingRequest}
                          userRole={userRole}
                          isMember={userRole !== null}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Your Groups */}
              {(categorizedGroups.owned.length > 0 || categorizedGroups.moderated.length > 0 || categorizedGroups.member.length > 0) && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Your Groups
                  </h3>
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    {[...categorizedGroups.owned, ...categorizedGroups.moderated, ...categorizedGroups.member].map((community) => {
                      const communityId = getCommunityId(community);
                      const isPinned = isGroupPinned(communityId);
                      const userRole = getUserRoleForGroup(community);
                      const hasPendingRequest = pendingJoinRequestsSet.has(communityId);
                      const stats = getGroupStats(community);

                      return (
                        <GroupCard
                          key={`your-${community.id}-${communityId}`}
                          community={community}
                          isPinned={isPinned}
                          pinGroup={pinGroup}
                          unpinGroup={unpinGroup}
                          isUpdating={isUpdating}
                          stats={stats}
                          isLoadingStats={isLoadingStatsForGroup(community)}
                          hasPendingRequest={hasPendingRequest}
                          userRole={userRole}
                          isMember={userRole !== null}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pending Requests */}
              {categorizedGroups.pending.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Pending Join Requests
                  </h3>
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    {categorizedGroups.pending.map((community) => {
                      const communityId = getCommunityId(community);
                      const isPinned = isGroupPinned(communityId);
                      const userRole = getUserRoleForGroup(community);
                      const hasPendingRequest = pendingJoinRequestsSet.has(communityId);
                      const stats = getGroupStats(community);

                      return (
                        <GroupCard
                          key={`pending-${community.id}-${communityId}`}
                          community={community}
                          isPinned={isPinned}
                          pinGroup={pinGroup}
                          unpinGroup={unpinGroup}
                          isUpdating={isUpdating}
                          stats={stats}
                          isLoadingStats={isLoadingStatsForGroup(community)}
                          hasPendingRequest={hasPendingRequest}
                          userRole={userRole}
                          isMember={userRole !== null}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Other Groups */}
              {categorizedGroups.other.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    {(categorizedGroups.pinned.length > 0 || categorizedGroups.owned.length > 0 || categorizedGroups.moderated.length > 0 || categorizedGroups.member.length > 0 || categorizedGroups.pending.length > 0) ? 'Other Groups' : 'All Groups'}
                  </h3>
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    {categorizedGroups.other.map((community) => {
                if (!community) return null;
                try {
                  const communityId = getCommunityId(community);
                  const isPinned = isGroupPinned(communityId);
                  const userRole = getUserRoleForGroup(community);
                  const hasPendingRequest = pendingJoinRequestsSet.has(communityId);
                  const hasActiveDeletionRequest = deletionRequestsMap?.has(communityId) || false;
                  
                  // Get stats for this group (both NIP-72 and NIP-29)
                  const stats = getGroupStats(community);

                  return (
                    <GroupCard
                      key={`${community.id}-${communityId}`}
                      community={community}
                      isPinned={isPinned}
                      pinGroup={pinGroup}
                      unpinGroup={unpinGroup}
                      isUpdating={isUpdating}
                      stats={stats}
                      isLoadingStats={isLoadingStatsForGroup(community)}
                      hasPendingRequest={hasPendingRequest}
                      userRole={userRole}
                      isMember={userRole !== null}
                    />
                  );
                } catch (error) {
                  console.error("Error rendering group card:", error);
                  return null;
                }
              })}
                  </div>
                </div>
              )}
            </div>
          ) : searchQuery ? (
            <div className="col-span-full text-center py-10">
              <h2 className="text-xl font-semibold mb-2">
                No matching groups found
              </h2>
              <p className="text-muted-foreground">
                Try a different search term or browse all groups
              </p>
            </div>
          ) : filterMyGroups ? (
            <div className="col-span-full text-center py-10">
              <h2 className="text-xl font-semibold mb-2">You haven't joined any groups yet</h2>
              <p className="text-muted-foreground mb-4">
                Explore communities and join groups that interest you.
              </p>
              <Button asChild>
                <a href="/groups">
                  <Icon name="Home" size={16} className="mr-2" />
                  Browse All Groups
                </a>
              </Button>
            </div>
          ) : (
            <div className="col-span-full text-center py-10">
              <h2 className="text-xl font-semibold mb-2">No groups found</h2>
              <p className="text-muted-foreground mb-4">
                Be the first to create a group on this platform!
              </p>
              {!user && (
                <p className="text-sm text-muted-foreground">
                  Please log in to create a group
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PWA Install Banner */}
      <PWAInstallBanner />
      <PWAInstallInstructions
        isOpen={showPWAInstructions}
        onClose={() => setShowPWAInstructions(false)}
      />
    </div>
  );
}