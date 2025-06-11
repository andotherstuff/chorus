import { useCurrentUser } from "@/hooks/useCurrentUser";
import Header from "@/components/ui/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GroupSearch } from "@/components/groups/GroupSearch";
import { useState, useMemo, useEffect, useCallback } from "react";
import { TrendingUp } from "lucide-react";
import { useGroupStats } from "@/hooks/useGroupStats";
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
import { getCommunityId } from "@/lib/group-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/Icon";
import { useCashuWallet } from "@/hooks/useCashuWallet";
import { useSearchParams } from "react-router-dom";

export default function Groups() {
  const { user } = useCurrentUser();
  const { pinGroup, unpinGroup, isGroupPinned, isUpdating } = usePinnedGroups();
  const [searchQuery, setSearchQuery] = useState("");
  const [showPWAInstructions, setShowPWAInstructions] = useState(false);
  const { wallet, isLoading: isWalletLoading } = useCashuWallet();
  const [searchParams] = useSearchParams();
  const filterMyGroups = searchParams.get("filter") === "my-groups";

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

  // Filter and sort all groups
  const sortedAndFilteredGroups = useMemo(() => {
    if (!allGroups || allGroups.length === 0) return [];

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
      
      // Check if user is owner
      if (group.pubkey === user.pubkey) return true;
      
      // Check if user is moderator/admin
      if (group.type === "nip72" && group.moderators.includes(user.pubkey)) return true;
      if (group.type === "nip29" && group.admins.includes(user.pubkey)) return true;
      
      // Check if user is member
      if (group.type === "nip29" && group.members?.includes(user.pubkey)) return true;
      
      // Check if user has pending request
      const groupId = getCommunityId(group);
      if (pendingJoinRequestsSet.has(groupId)) return true;
      
      // For NIP-72 groups, check approved members
      if (group.type === "nip72") {
        const userRole = getUserRoleForGroup(group);
        if (userRole === "member") return true;
      }
      
      return false;
    };

    // Create a stable copy of the array to avoid mutation issues
    const stableGroups = [...allGroups];

    return stableGroups
      .filter(group => matchesSearch(group) && !isGroupDeleted(group) && isUserGroup(group))
      .sort((a, b) => {
      // Ensure both a and b are valid objects
      if (!a || !b) return 0;

      try {
        const aId = getCommunityId(a);
        const bId = getCommunityId(b);

        const aIsPinned = isGroupPinned(aId);
        const bIsPinned = isGroupPinned(bId);

        // First priority: pinned groups
        if (aIsPinned && !bIsPinned) return -1;
        if (!aIsPinned && bIsPinned) return 1;

        // Get user roles and pending status
        const aUserRole = getUserRoleForGroup(a);
        const bUserRole = getUserRoleForGroup(b);
        const aHasPendingRequest = pendingJoinRequestsSet.has(aId);
        const bHasPendingRequest = pendingJoinRequestsSet.has(bId);

        // Define role priority (lower number = higher priority)
        const getRolePriority = (
          role: UserRole | undefined,
          hasPending: boolean
        ) => {
          if (role === "owner") return 1;
          if (role === "moderator") return 2;
          if (role === "member") return 3;
          if (hasPending) return 4;
          return 5; // Not a member and no pending request
        };

        const aPriority = getRolePriority(aUserRole, aHasPendingRequest);
        const bPriority = getRolePriority(bUserRole, bHasPendingRequest);

        // Second priority: user's relationship to the group (owner > mod > member > pending > other)
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        // Third priority: Sort by activity (posts count + participants count)
        if (groupStats && a.type === 'nip72' && b.type === 'nip72') {
          const aId = getCommunityId(a);
          const bId = getCommunityId(b);
          const aStats = groupStats[aId];
          const bStats = groupStats[bId];
          
          if (aStats && bStats) {
            // Calculate activity score (posts + participants)
            const aActivity = aStats.posts + aStats.participants.size;
            const bActivity = bStats.posts + bStats.participants.size;
            
            // Higher activity comes first
            if (aActivity !== bActivity) {
              return bActivity - aActivity;
            }
          }
        }

        // Final priority: Sort alphabetically by name
        const aName = a.name?.toLowerCase() || "";
        const bName = b.name?.toLowerCase() || "";

        return aName.localeCompare(bName);
      } catch (error) {
        console.error("Error sorting groups:", error);
        return 0;
      }
    });
  }, [
    allGroups,
    searchQuery,
    isGroupPinned,
    getUserRoleForGroup,
    pendingJoinRequestsSet,
    deletionRequestsMap,
    groupStats,
    filterMyGroups,
    user,
  ]);

  // Auto-refresh could be added here if needed

  const isLoading = isLoadingGroups || isPendingRequestsLoading;
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
            sortedAndFilteredGroups &&
            sortedAndFilteredGroups.length > 0 ? (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              {sortedAndFilteredGroups.map((community) => {
                if (!community) return null;
                try {
                  const communityId = getCommunityId(community);
                  const isPinned = isGroupPinned(communityId);
                  const userRole = getUserRoleForGroup(community);
                  const hasPendingRequest = pendingJoinRequestsSet.has(communityId);
                  const hasActiveDeletionRequest = deletionRequestsMap?.has(communityId) || false;
                  
                  // Get stats for this group (only for NIP-72 groups)
                  const stats = community.type === 'nip72' && groupStats ? groupStats[communityId] : undefined;

                  return (
                    <GroupCard
                      key={`${community.id}-${communityId}`}
                      community={community}
                      isPinned={isPinned}
                      pinGroup={pinGroup}
                      unpinGroup={unpinGroup}
                      isUpdating={isUpdating}
                      stats={stats}
                      isLoadingStats={isLoadingStats && community.type === 'nip72'}
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