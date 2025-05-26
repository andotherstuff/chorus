import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import Header from "@/components/ui/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GroupSearch } from "@/components/groups/GroupSearch";
import { useState, useMemo, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { useGroupStats } from "@/hooks/useGroupStats";
import { usePinnedGroups } from "@/hooks/usePinnedGroups";
import { useUserGroups } from "@/hooks/useUserGroups";
import { useUserPendingJoinRequests } from "@/hooks/useUserPendingJoinRequests";
import { GroupCard } from "@/components/groups/GroupCard";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { PWAInstallInstructions } from "@/components/PWAInstallInstructions";
import type { NostrEvent } from "@nostrify/nostrify";
import type { UserRole } from "@/hooks/useUserRole";
import { KINDS } from "@/lib/nostr-kinds";
import { useCashuWallet } from "@/hooks/useCashuWallet";

// Helper function to get community ID
const getCommunityId = (community: NostrEvent) => {
  const dTag = community.tags.find((tag) => tag[0] === "d");
  return `${KINDS.GROUP}:${community.pubkey}:${dTag ? dTag[1] : ""}`;
};

export default function Groups() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { pinGroup, unpinGroup, isGroupPinned, isUpdating } = usePinnedGroups();
  const [searchQuery, setSearchQuery] = useState("");
  const [showPWAInstructions, setShowPWAInstructions] = useState(false);
  const { wallet, isLoading: isWalletLoading } = useCashuWallet();

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

  // Fetch all communities with improved error handling and timeout
  const { data: allGroups, isLoading: isGroupsLoading } = useQuery({
    queryKey: ["communities"],
    queryFn: async (c) => {
      try {
        // Increase timeout to 8 seconds to allow more time for relays to respond
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);
        const events = await nostr.query(
          [{ kinds: [KINDS.GROUP], limit: 100 }],
          { signal }
        );

        // Ensure we always return an array, even if the query fails
        return Array.isArray(events) ? events : [];
      } catch (error) {
        console.error("Error fetching communities:", error);
        // Return empty array on error instead of throwing
        return [];
      }
    },
    // Add retry logic for better reliability
    retry: 3,
    retryDelay: 1000,
    // Ensure stale data is shown while revalidating
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });

  // Get user's groups
  const { data: userGroups, isLoading: isUserGroupsLoading } = useUserGroups();

  // Get user's pending join requests
  const {
    data: pendingJoinRequests = [],
    isLoading: isPendingRequestsLoading,
  } = useUserPendingJoinRequests();

  // Query for community stats
  const { data: communityStats, isLoading: isLoadingStats } =
    useGroupStats(allGroups);

  // Create a map to track user's membership in groups
  const userMembershipMap = useMemo(() => {
    if (!userGroups || !user) return new Map<string, UserRole>();

    const membershipMap = new Map<string, UserRole>();

    // Process all of user's groups
    for (const group of userGroups.allGroups) {
      const communityId = getCommunityId(group);

      // Determine role
      let role: UserRole = "member";
      if (group.pubkey === user.pubkey) {
        role = "owner";
      } else if (
        group.tags.some(
          (tag) =>
            tag[0] === "p" && tag[1] === user.pubkey && tag[3] === "moderator"
        )
      ) {
        role = "moderator";
      }

      membershipMap.set(communityId, role);
    }

    return membershipMap;
  }, [userGroups, user]);

  // Create a set of pending join request community IDs for quick lookup
  const pendingJoinRequestsSet = useMemo(() => {
    return new Set(pendingJoinRequests);
  }, [pendingJoinRequests]);

  // Filter and sort all groups
  const sortedAndFilteredGroups = useMemo(() => {
    if (!allGroups || allGroups.length === 0) return [];

    // Function to check if a group matches the search query
    const matchesSearch = (community: NostrEvent) => {
      if (!searchQuery) return true;

      const nameTag = community.tags.find((tag) => tag[0] === "name");
      const descriptionTag = community.tags.find(
        (tag) => tag[0] === "description"
      );
      const dTag = community.tags.find((tag) => tag[0] === "d");

      const name = nameTag ? nameTag[1] : dTag ? dTag[1] : "";
      const description = descriptionTag ? descriptionTag[1] : "";

      const searchLower = searchQuery.toLowerCase();
      return (
        name.toLowerCase().includes(searchLower) ||
        description.toLowerCase().includes(searchLower)
      );
    };

    // Create a stable copy of the array to avoid mutation issues
    const stableGroups = [...allGroups];

    return stableGroups.filter(matchesSearch).sort((a, b) => {
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
        const aUserRole = userMembershipMap.get(aId);
        const bUserRole = userMembershipMap.get(bId);
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

        // If same priority, sort alphabetically by name
        const aNameTag = a.tags.find((tag) => tag[0] === "name");
        const bNameTag = b.tags.find((tag) => tag[0] === "name");

        const aName = aNameTag ? aNameTag[1].toLowerCase() : "";
        const bName = bNameTag ? bNameTag[1].toLowerCase() : "";

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
    userMembershipMap,
    pendingJoinRequestsSet,
  ]);

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
    <div className="container mx-auto py-1 px-3 sm:px-4">
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
          {isGroupsLoading ||
          isUserGroupsLoading ||
          isPendingRequestsLoading ? (
            renderSkeletons()
          ) : allGroups &&
            sortedAndFilteredGroups &&
            sortedAndFilteredGroups.length > 0 ? (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              {sortedAndFilteredGroups.map((community) => {
                if (!community) return null;
                try {
                  const communityId = getCommunityId(community);
                  const isPinned = isGroupPinned(communityId);
                  const userRole = userMembershipMap.get(communityId);
                  const isMember = userMembershipMap.has(communityId);
                  const hasPendingRequest =
                    pendingJoinRequestsSet.has(communityId);
                  const stats = communityStats
                    ? communityStats[communityId]
                    : undefined;

                  return (
                    <GroupCard
                      key={`${community.id}-${communityId}`}
                      community={community}
                      isPinned={isPinned}
                      pinGroup={pinGroup}
                      unpinGroup={unpinGroup}
                      isUpdating={isUpdating}
                      stats={stats}
                      isLoadingStats={isLoadingStats}
                      isMember={isMember}
                      userRole={userRole}
                      hasPendingRequest={hasPendingRequest}
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

      {/* PWA Install Instructions Dialog */}
      <PWAInstallInstructions
        isOpen={showPWAInstructions}
        onClose={() => setShowPWAInstructions(false)}
      />
    </div>
  );
}
