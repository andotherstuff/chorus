import { useUserGroups } from "@/hooks/useUserGroups";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePinnedGroups } from "@/hooks/usePinnedGroups";
import { MyGroupCard } from "./MyGroupCard";
import { NostrEvent } from "@nostrify/nostrify";
import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";

export function MyGroupsList() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { data: userGroups, isLoading } = useUserGroups();
  const { pinGroup, unpinGroup, isGroupPinned, isUpdating } = usePinnedGroups();
  
  // Query for community stats (posts and participants)
  const { data: communityStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["my-groups-stats", userGroups],
    queryFn: async (c) => {
      if (!userGroups || !userGroups.allGroups || userGroups.allGroups.length === 0 || !nostr) return {};
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);
      const stats: Record<string, { posts: number; participants: Set<string> }> = {};
      
      // Create a filter for all communities to get posts in a single query
      const communityRefs = userGroups.allGroups.map(community => {
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
      posts.forEach(post => {
        const communityTag = post.tags.find(tag => tag[0] === "a");
        if (!communityTag) return;
        
        const communityId = communityTag[1];
        if (!stats[communityId]) {
          stats[communityId] = { posts: 0, participants: new Set() };
        }
        
        // Count posts and unique participants
        stats[communityId].posts++;
        stats[communityId].participants.add(post.pubkey);
      });
      
      return stats;
    },
    enabled: !!nostr && !!userGroups && !!userGroups.allGroups && userGroups.allGroups.length > 0,
  });

  if (!user) {
    return null;
  }

  // If user has no groups and data is loaded, don't show the section
  if (!isLoading && 
      userGroups && 
      userGroups.pinned.length === 0 &&
      userGroups.owned.length === 0 && 
      userGroups.moderated.length === 0 && 
      userGroups.member.length === 0) {
    return null;
  }
  
  // Ensure we have the data before proceeding
  if (!userGroups) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">My Groups</h2>
      </div>

      {isLoading ? (
        <div className="flex gap-4 pb-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={`skeleton-my-group-${index}`} className="min-w-[250px] max-w-[250px] flex flex-col">
              <div className="h-28 overflow-hidden">
                <Skeleton className="w-full h-full" />
              </div>
              <CardHeader className="p-3">
                <Skeleton className="h-5 w-3/4" />
              </CardHeader>
              <CardFooter className="p-3 pt-0">
                <Skeleton className="h-9 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Use allGroups to avoid duplicates */}
            {userGroups?.allGroups.map(community => {
              const dTag = community.tags.find(tag => tag[0] === "d");
              const communityId = `34550:${community.pubkey}:${dTag ? dTag[1] : ""}`;
              const isPinned = isGroupPinned(communityId);
              
              // Determine the role
              let role: "pinned" | "owner" | "moderator" | "member" = "member";
              
              if (isPinned) {
                role = "pinned";
              } else if (community.pubkey === user.pubkey) {
                role = "owner";
              } else if (community.tags.some(tag => 
                tag[0] === "p" && 
                tag[1] === user.pubkey && 
                tag[3] === "moderator"
              )) {
                role = "moderator";
              }
              
              const stats = communityStats ? communityStats[communityId] : undefined;
              
              return (
                <MyGroupCard
                  key={`${role}-${community.id}`}
                  community={community}
                  role={role}
                  isPinned={isPinned}
                  pinGroup={pinGroup}
                  unpinGroup={unpinGroup}
                  isUpdating={isUpdating}
                  stats={stats}
                  isLoadingStats={isLoadingStats}
                />
              );
            })}
          </div>
      )}
    </div>
  );
}
