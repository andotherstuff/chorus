import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Separator } from "@/components/ui/separator";
import Header from "@/components/ui/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { MyGroupsList } from "@/components/groups/MyGroupsList";
import { usePinnedGroups } from "@/hooks/usePinnedGroups";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { GroupCard } from "@/components/groups/GroupCard";
import { GroupSearch } from "@/components/groups/GroupSearch";
import { useState } from "react";

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

  // Query for community stats (posts and participants)
  const { data: communityStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["community-stats"],
    queryFn: async (c) => {
      if (!communities || communities.length === 0) return {};

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);
      const stats: Record<string, { posts: number; participants: Set<string> }> = {};

      // Create a filter for all communities to get posts in a single query
      const communityRefs = communities.map(community => {
        const dTag = community.tags.find(tag => tag[0] === "d");
        return `34550:${community.pubkey}:${dTag ? dTag[1] : ""}`;
      });

      // Get all posts that reference any community
      const posts = await nostr.query([{
        kinds: [1, 4550],
        "#a": communityRefs,
        limit: 500
      }], { signal });

      // Process posts to get stats for each community
      for (const post of posts) {
        const communityTag = post.tags.find(tag => tag[0] === "a");
        if (!communityTag) continue;

        const communityId = communityTag[1];
        if (!stats[communityId]) {
          stats[communityId] = { posts: 0, participants: new Set() };
        }

        // Count posts and unique participants
        stats[communityId].posts++;
        stats[communityId].participants.add(post.pubkey);
      }

      return stats;
    },
    enabled: !!nostr && !!communities && communities.length > 0,
  });

  // Filter communities based on search query
  const filteredCommunities = communities?.filter(community => {
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
    <div className="container mx-auto py-4 px-6">
      <Header />
      <MyGroupsList />

      <div className="flex flex-col mt-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
          <div className="md:w-64 lg:w-72">
            <GroupSearch
              onSearch={setSearchQuery}
              className="sticky top-0 z-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <Card key={`skeleton-group-${index}-${Date.now()}`} className="overflow-hidden flex flex-col">
                <div className="h-40 overflow-hidden">
                  <Skeleton className="w-full h-full" />
                </div>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent className="flex-grow">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
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
