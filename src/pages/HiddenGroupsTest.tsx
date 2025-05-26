import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHiddenGroups } from "@/hooks/useHiddenGroups";
import Header from "@/components/ui/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RichText } from "@/components/ui/RichText";
import { EyeOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { KINDS } from "@/lib/nostr-kinds";
import type { NostrEvent } from "@nostrify/nostrify";

// Helper function to get community ID
const getCommunityId = (community: NostrEvent) => {
  const dTag = community.tags.find((tag) => tag[0] === "d");
  return `${KINDS.GROUP}:${community.pubkey}:${dTag ? dTag[1] : ""}`;
};

interface HiddenGroupCardProps {
  community: NostrEvent;
}

function HiddenGroupCard({ community }: HiddenGroupCardProps) {
  // Extract community data from tags
  const nameTag = community.tags.find((tag) => tag[0] === "name");
  const descriptionTag = community.tags.find((tag) => tag[0] === "description");
  const imageTag = community.tags.find((tag) => tag[0] === "image");
  const dTag = community.tags.find((tag) => tag[0] === "d");

  const name = nameTag ? nameTag[1] : dTag ? dTag[1] : "Unnamed Group";
  const description = descriptionTag ? descriptionTag[1] : "No description available";
  const image = imageTag ? imageTag[1] : undefined;
  const communityId = getCommunityId(community);

  // Get the first letter of the group name for avatar fallback
  const getInitials = () => {
    return name.charAt(0).toUpperCase();
  };

  return (
    <Card className="overflow-hidden flex flex-col relative group h-full">
      <div className="absolute top-2 right-2 z-10">
        <Badge variant="destructive" className="text-xs">
          <EyeOff className="h-3 w-3 mr-1" />
          Hidden
        </Badge>
      </div>

      <CardHeader className="flex flex-row items-center space-y-0 gap-3 pt-4 pb-2 px-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 rounded-md">
            <AvatarImage src={image} alt={name} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1 flex-1">
            <CardTitle className="text-sm font-medium leading-tight">{name}</CardTitle>
            <div className="text-xs text-muted-foreground">
              ID: {communityId.split(":")[2] || "Unknown"}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3 pt-0 flex-1 flex flex-col">
        <RichText className="line-clamp-3 text-xs mb-4 flex-1">
          {description}
        </RichText>
        
        <div className="flex gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Link to={`/group/${encodeURIComponent(communityId)}`}>
              <Eye className="h-3 w-3 mr-1" />
              View Group
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HiddenGroupsTest() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { data: hiddenGroupIds = new Set(), isLoading: isHiddenGroupsLoading } = useHiddenGroups();

  // Fetch the actual group events for hidden groups
  const { data: hiddenGroups = [], isLoading: isGroupsLoading } = useQuery({
    queryKey: ["hidden-groups-details", Array.from(hiddenGroupIds)],
    queryFn: async (c) => {
      if (hiddenGroupIds.size === 0) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);
      
      // Convert group IDs to filters
      const filters = Array.from(hiddenGroupIds).map(groupId => {
        const parts = groupId.split(":");
        if (parts.length === 3) {
          return {
            kinds: [parseInt(parts[0])],
            authors: [parts[1]],
            "#d": [parts[2]],
            limit: 1
          };
        }
        return null;
      }).filter((filter): filter is NonNullable<typeof filter> => filter !== null);

      if (filters.length === 0) return [];

      try {
        const events = await nostr.query(filters, { signal });
        return events;
      } catch (error) {
        console.error("Error fetching hidden group details:", error);
        return [];
      }
    },
    enabled: hiddenGroupIds.size > 0,
    staleTime: 60000, // 1 minute
  });

  if (!user) {
    return (
      <div className="container mx-auto py-1 px-3 sm:px-4">
        <Header />
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Please Log In</h1>
            <p className="text-muted-foreground">
              You must be logged in to view this test page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-1 px-3 sm:px-4">
      <Header />

      <div className="flex flex-col mt-4">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <EyeOff className="h-6 w-6 text-red-500" />
            <h1 className="text-2xl font-bold">Hidden Groups Test</h1>
            <Badge variant="secondary" className="text-xs">
              Test Version
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            This is a test version that shows hidden groups to any logged-in user for debugging purposes.
          </p>
          <div className="mt-2 p-3 bg-muted rounded-lg text-sm">
            <p><strong>Debug Info:</strong></p>
            <p>User: {user.pubkey}</p>
            <p>Hidden Group IDs: {Array.from(hiddenGroupIds).join(", ") || "None"}</p>
            <p>Hidden Groups Loading: {String(isHiddenGroupsLoading)}</p>
            <p>Groups Loading: {String(isGroupsLoading)}</p>
            <p>Hidden Groups Count: {hiddenGroups.length}</p>
          </div>
        </div>

        <div className="space-y-4">
          {isHiddenGroupsLoading || isGroupsLoading ? (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="overflow-hidden flex flex-col h-[200px]">
                  <CardHeader className="flex flex-row items-center space-y-0 gap-3 pt-4 pb-2 px-3">
                    <Skeleton className="h-12 w-12 rounded-md" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 pt-0 flex-1">
                    <Skeleton className="h-3 w-full mb-1" />
                    <Skeleton className="h-3 w-2/3 mb-4" />
                    <div className="flex gap-2 mt-auto">
                      <Skeleton className="h-8 flex-1" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : hiddenGroups.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Found {hiddenGroups.length} hidden {hiddenGroups.length === 1 ? 'group' : 'groups'}
                </p>
              </div>
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {hiddenGroups.map((community) => {
                  const communityId = getCommunityId(community);
                  return (
                    <HiddenGroupCard
                      key={communityId}
                      community={community}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <EyeOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Hidden Groups</h2>
              <p className="text-muted-foreground">
                There are currently no groups hidden from public listings.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}