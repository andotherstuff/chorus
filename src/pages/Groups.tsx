import { useEffect, useState } from "react";
import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { LoginArea } from "@/components/auth/LoginArea";
import { Separator } from "@/components/ui/separator";
import { Users, Plus, MessageSquare, Activity } from "lucide-react";

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
    enabled: !!nostr && !!communities && communities.length > 0,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Loading communities...</h1>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Nostr Communities</h1>
        <div className="flex items-center gap-2">
          <LoginArea />
          {user && (
            <Button asChild>
              <Link to="/create-group">
                <Plus className="mr-2 h-4 w-4" /> Create Community
              </Link>
            </Button>
          )}
        </div>
      </div>
      
      <Separator className="my-6" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {communities && communities.length > 0 ? (
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
                  <CardDescription>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <div className="inline-flex items-center px-2 py-1 bg-muted rounded-md text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {moderatorTags.length} mod{moderatorTags.length !== 1 ? 's' : ''}
                      </div>
                      
                      {isLoadingStats ? (
                        <>
                          <div className="inline-flex items-center px-2 py-1 bg-muted rounded-md text-xs opacity-70">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Loading...
                          </div>
                          <div className="inline-flex items-center px-2 py-1 bg-muted rounded-md text-xs opacity-70">
                            <Activity className="h-3 w-3 mr-1" />
                            Loading...
                          </div>
                        </>
                      ) : communityStats && (() => {
                        const communityId = `34550:${community.pubkey}:${dTag ? dTag[1] : ""}`;
                        const stats = communityStats[communityId];
                        
                        if (!stats) {
                          return (
                            <>
                              <div className="inline-flex items-center px-2 py-1 bg-muted rounded-md text-xs">
                                <MessageSquare className="h-3 w-3 mr-1" />
                                0 posts
                              </div>
                              <div className="inline-flex items-center px-2 py-1 bg-muted rounded-md text-xs">
                                <Activity className="h-3 w-3 mr-1" />
                                0 participants
                              </div>
                            </>
                          );
                        }
                        
                        return (
                          <>
                            <div className="inline-flex items-center px-2 py-1 bg-muted rounded-md text-xs">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              {stats.posts} post{stats.posts !== 1 ? 's' : ''}
                            </div>
                            <div className="inline-flex items-center px-2 py-1 bg-muted rounded-md text-xs">
                              <Activity className="h-3 w-3 mr-1" />
                              {stats.participants.size} participant{stats.participants.size !== 1 ? 's' : ''}
                            </div>
                          </>
                        );
                      })()}
                    </div>
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
              <Button asChild>
                <Link to="/create-group">
                  <Plus className="mr-2 h-4 w-4" /> Create Community
                </Link>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Please log in to create a community
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}