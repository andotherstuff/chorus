import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Users } from "lucide-react";
import { AppLayout } from "@/components/ui/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";

export default function Groups() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  const { data: communities, isLoading } = useQuery({
    queryKey: ["communities"],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{ kinds: [34550], limit: 50 }], { signal });
      return events;
    },
    enabled: !!nostr,
  });

  return (
    <AppLayout showHeader={false}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          // Skeleton loading state
          Array.from({ length: 6 }).map((_, index) => (
            <Card key={`skeleton-community-${index}-${Date.now()}`} className="overflow-hidden flex flex-col">
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
        ) : communities && communities.length > 0 ? (
          communities.map((community) => {
            // Extract community data from tags
            const nameTag = community.tags.find(tag => tag[0] === "name");
            const descriptionTag = community.tags.find(tag => tag[0] === "description");
            const imageTag = community.tags.find(tag => tag[0] === "image");
            const dTag = community.tags.find(tag => tag[0] === "d");
            const moderatorTags = community.tags.filter(tag => tag[0] === "p" && tag[3] === "moderator");

            const name = nameTag ? nameTag[1] : (dTag ? dTag[1] : "Unnamed Community");
            const description = descriptionTag ? descriptionTag[1] : "No description available";
            const image = imageTag ? imageTag[1] : "/placeholder-community.jpg";
            const communityId = `34550:${community.pubkey}:${dTag ? dTag[1] : ""}`;

            return (
              <Card key={community.id} className="overflow-hidden flex flex-col">
                <div className="h-40 overflow-hidden">
                  {image && (
                    <img
                      src={image}
                      alt={name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "https://placehold.co/600x400?text=Community";
                      }}
                    />
                  )}
                </div>
                <CardHeader>
                  <CardTitle>{name}</CardTitle>
                  <CardDescription className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    {moderatorTags.length} moderator{moderatorTags.length !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="line-clamp-3">{description}</p>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link to={`/group/${encodeURIComponent(communityId)}`}>
                      View Community
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full text-center py-10">
            <h2 className="text-xl font-semibold mb-2">No communities found</h2>
            <p className="text-muted-foreground mb-4">
              Be the first to create a community on this platform!
            </p>
            {user ? (
              null
            ) : (
              <p className="text-sm text-muted-foreground">
                Please log in to create a community
              </p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
