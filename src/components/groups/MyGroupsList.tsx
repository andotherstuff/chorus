import { useUserGroups } from "@/hooks/useUserGroups";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePinnedGroups } from "@/hooks/usePinnedGroups";
import { MyGroupCard } from "./MyGroupCard";
import { useGroupStats } from "@/hooks/useGroupStats";

export function MyGroupsList() {
  const { user } = useCurrentUser();
  const { data: userGroups, isLoading } = useUserGroups();
  const { pinGroup, unpinGroup, isGroupPinned, isUpdating } = usePinnedGroups();

  // Query for community stats (posts and participants)
  const { data: communityStats, isLoading: isLoadingStats } = useGroupStats(
    userGroups?.allGroups,
    !!userGroups && !!userGroups.allGroups && userGroups.allGroups.length > 0
  );

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
    <div className="mb-2">
      {isLoading ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={`skeleton-my-group-${index}`} className="overflow-hidden flex flex-col h-[120px]">
              <CardHeader className="flex flex-row items-center space-y-0 gap-3 pt-4 pb-2 px-5">
                <Skeleton className="h-12 w-12 rounded-md" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-1">
                    <Skeleton className="h-3 w-8" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                </div>
              </CardHeader>
              <Skeleton className="mx-5 h-3 w-full mb-1" />
              <Skeleton className="mx-5 h-3 w-2/3" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
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
