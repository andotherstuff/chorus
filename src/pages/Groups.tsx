import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Separator } from "@/components/ui/separator";
import Header from "@/components/ui/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { MyGroupsList } from "@/components/groups/MyGroupsList";
import { usePinnedGroups } from "@/hooks/usePinnedGroups";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GroupCard } from "@/components/groups/GroupCard";
import { GroupSearch } from "@/components/groups/GroupSearch";
import { useState } from "react";
import { useGroupStats } from "@/hooks/useGroupStats";
import { useUserGroups } from "@/hooks/useUserGroups";

export default function Groups() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { pinGroup, unpinGroup, isGroupPinned, isUpdating } = usePinnedGroups(); // Initialized hook
  const [searchQuery, setSearchQuery] = useState("");

  const { data: communities, isLoading } = useQuery({
    queryKey: ["communities"],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{ kinds: [34550], limit: 50 }], { signal });
      return events;
    },
    enabled: !!nostr,
  });

  // Get user's groups
  const { data: userGroups } = useUserGroups();

  // Query for community stats (posts and participants)
  const { data: communityStats, isLoading: isLoadingStats } = useGroupStats(communities);

  // Helper function to get community ID
  const getCommunityId = (community) => {
    const dTag = community.tags.find(tag => tag[0] === "d");
    return `34550:${community.pubkey}:${dTag ? dTag[1] : ""}`;
  };

  // Create a set of user's group IDs for efficient lookup
  const userGroupIds = new Set();
  if (userGroups?.allGroups) {
    for (const group of userGroups.allGroups) {
      userGroupIds.add(getCommunityId(group));
    }
  }

  // Filter communities based on search query and exclude user's groups
  const filteredCommunities = communities?.filter(community => {
    // Skip if this community is already in user's groups
    const communityId = getCommunityId(community);
    if (userGroupIds.has(communityId)) {
      return false;
    }

    // Apply search filter if there's a query
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
  });

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
      <MyGroupsList />

        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {isLoading ? (
            Array.from({ length: 12 }).map((_, index) => (
              <Card key={`skeleton-group-${index}-${Date.now()}`} className="overflow-hidden flex flex-col h-[140px]">
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
            ))
          ) : filteredCommunities && filteredCommunities.length > 0 ? (
            filteredCommunities.map((community) => {
              const dTag = community.tags.find(tag => tag[0] === "d");
              const communityId = `34550:${community.pubkey}:${dTag ? dTag[1] : ""}`;
              const isPinned = isGroupPinned(communityId);
              const stats = communityStats ? communityStats[communityId] : undefined;

              return (
                <GroupCard
                  key={community.id}
                  community={community}
                  isPinned={isPinned}
                  pinGroup={pinGroup}
                  unpinGroup={unpinGroup}
                  isUpdating={isUpdating}
                  stats={stats}
                  isLoadingStats={isLoadingStats}
                />
              );
            })
          ) : searchQuery && communities && communities.length > 0 ? (
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
              {user ? (
                null
              ) : (
                <p className="text-sm text-muted-foreground">
                  Please log in to create a group
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
