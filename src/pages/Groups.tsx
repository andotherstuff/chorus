import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Separator } from "@/components/ui/separator";
import Header from "@/components/ui/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

// Helper function to get community ID
const getCommunityId = (community: NostrEvent) => {
  const dTag = community.tags.find(tag => tag[0] === "d");
  return `34550:${community.pubkey}:${dTag ? dTag[1] : ""}`;
};

export default function Groups() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { pinGroup, unpinGroup, isGroupPinned, isUpdating } = usePinnedGroups();
  const [searchQuery, setSearchQuery] = useState("");
  const [showPWAInstructions, setShowPWAInstructions] = useState(false);

  // Listen for PWA instructions event from banner
  useEffect(() => {
    const handleOpenPWAInstructions = () => {
      setShowPWAInstructions(true);
    };

    window.addEventListener('open-pwa-instructions', handleOpenPWAInstructions);
    return () => {
      window.removeEventListener('open-pwa-instructions', handleOpenPWAInstructions);
    };
  }, []);

  // Fetch all communities with improved error handling and timeout
  const { data: allGroups, isLoading: isGroupsLoading } = useQuery({
    queryKey: ["communities"],
    queryFn: async (c) => {
      try {
        // Increase timeout to 8 seconds to allow more time for relays to respond
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);
        const events = await nostr.query([{ kinds: [34550], limit: 100 }], { signal });
        
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

  // Query for community stats
  const { data: communityStats, isLoading: isLoadingStats } = useGroupStats(allGroups);

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
      } else if (group.tags.some(tag =>
        tag[0] === "p" &&
        tag[1] === user.pubkey &&
        tag[3] === "moderator"
      )) {
        role = "moderator";
      }

      membershipMap.set(communityId, role);
    }

    return membershipMap;
  }, [userGroups, user]);

  // Filter and sort all groups
  const sortedAndFilteredGroups = useMemo(() => {
    if (!allGroups || allGroups.length === 0) return [];

    // Function to check if a group matches the search query
    const matchesSearch = (community: NostrEvent) => {
      if (!searchQuery) return true;

      const nameTag = community.tags.find(tag => tag[0] === "name");
      const descriptionTag = community.tags.find(tag => tag[0] === "description");
      const dTag = community.tags.find(tag => tag[0] === "d");

      const name = nameTag ? nameTag[1] : (dTag ? dTag[1] : "");
      const description = descriptionTag ? descriptionTag[1] : "";

      const searchLower = searchQuery.toLowerCase();
      return (
        name.toLowerCase().includes(searchLower) ||
        description.toLowerCase().includes(searchLower)
      );
    };

    // Create a stable copy of the array to avoid mutation issues
    const stableGroups = [...allGroups];

    return stableGroups
      .filter(matchesSearch)
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

          const aIsMember = userMembershipMap.has(aId);
          const bIsMember = userMembershipMap.has(bId);

          // Second priority: groups that the user is a member of
          if (aIsMember && !bIsMember) return -1;
          if (!aIsMember && bIsMember) return 1;

          // If both are pinned or both are not pinned and both are member or both are not member,
          // sort alphabetically by name
          const aNameTag = a.tags.find(tag => tag[0] === "name");
          const bNameTag = b.tags.find(tag => tag[0] === "name");

          const aName = aNameTag ? aNameTag[1].toLowerCase() : "";
          const bName = bNameTag ? bNameTag[1].toLowerCase() : "";

          return aName.localeCompare(bName);
        } catch (error) {
          console.error("Error sorting groups:", error);
          return 0;
        }
      });
  }, [allGroups, searchQuery, isGroupPinned, userMembershipMap]);

  // Loading state skeleton with stable keys
  const skeletonKeys = useMemo(() => 
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

      <div className="flex flex-col mt-4">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-3 gap-2">
          <div className="w-full md:w-64 lg:w-72">
            <GroupSearch
              onSearch={setSearchQuery}
              className="sticky top-0 z-10"
            />
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {isGroupsLoading || isUserGroupsLoading ? (
            renderSkeletons()
          ) : allGroups && sortedAndFilteredGroups && sortedAndFilteredGroups.length > 0 ? (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              {sortedAndFilteredGroups.map((community) => {
                if (!community) return null;
                try {
                  const communityId = getCommunityId(community);
                  const isPinned = isGroupPinned(communityId);
                  const userRole = userMembershipMap.get(communityId);
                  const isMember = userMembershipMap.has(communityId);
                  const stats = communityStats ? communityStats[communityId] : undefined;

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
              <h2 className="text-xl font-semibold mb-2">No matching groups found</h2>
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