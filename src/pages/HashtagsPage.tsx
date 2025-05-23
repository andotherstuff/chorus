import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/ui/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { NoteContent } from "@/components/NoteContent";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthor } from "@/hooks/useAuthor";
import { Hash, ArrowLeft, ChevronDown } from "lucide-react";
import { TrendingTopics } from "@/components/TrendingTopics";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import type { NostrEvent } from "@nostrify/nostrify";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Helper function to parse hashtag from URL or params
function useHashtag() {
  const { tag } = useParams<{ tag: string }>();
  const [searchParams] = useSearchParams();
  const searchTag = searchParams.get("tag");
  
  return tag || searchTag || "";
}

// Helper component to display a single post
function PostItem({ event }: { event: NostrEvent }) {
  const author = useAuthor(event.pubkey);
  const authorData = author.data?.metadata;

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Link to={`/profile/${event.pubkey}`}>
            <Avatar className="h-10 w-10">
              {authorData?.picture ? (
                <AvatarImage src={authorData.picture} alt={authorData.name || event.pubkey.slice(0, 8)} />
              ) : (
                <AvatarFallback>{(authorData?.name || event.pubkey.slice(0, 2)).toUpperCase()}</AvatarFallback>
              )}
            </Avatar>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Link to={`/profile/${event.pubkey}`} className="font-medium hover:underline">
                {authorData?.display_name || authorData?.name || event.pubkey.slice(0, 8)}
              </Link>
              <span className="text-xs text-muted-foreground">
                {new Date(event.created_at * 1000).toLocaleString()}
              </span>
            </div>
            <NoteContent event={event} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HashtagsPage() {
  const hashtag = useHashtag();
  const { nostr } = useNostr();
  const [timeWindow, setTimeWindow] = useState<number>(604800); // Default to 7 days
  const [loadMoreCount, setLoadMoreCount] = useState<number>(1);
  
  // Reset load more count when hashtag changes
  useEffect(() => {
    setLoadMoreCount(1);
  }, [hashtag]);

  // Fetch posts with the specified hashtag
  const { data: posts, isLoading } = useQuery({
    queryKey: ["hashtag-posts", hashtag, timeWindow, loadMoreCount],
    queryFn: async (c) => {
      if (!nostr || !hashtag) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);
      
      // Calculate timestamp for time window
      const now = Math.floor(Date.now() / 1000);
      const since = now - timeWindow;
      
      // Fetch posts with both content hashtags and tag hashtags
      const [contentEvents, tagEvents] = await Promise.all([
        // Query for events with hashtags in content
        nostr.query([{ 
          kinds: [1], // text notes
          since,
          limit: 40 * loadMoreCount // Increase limit based on load more clicks
        }], { signal }),
        
        // Query for events with t tags
        nostr.query([{
          kinds: [1],
          since,
          '#t': [hashtag],
          limit: 40 * loadMoreCount
        }], { signal })
      ]);
      
      // Combine and filter events
      let combinedEvents = [...contentEvents, ...tagEvents];
      
      // Filter content events that have the hashtag in their content
      const hashtagRegex = new RegExp(`#${hashtag}\\b`, 'i');
      combinedEvents = combinedEvents.filter(event => {
        // Check if it has the hashtag in content
        const hasHashtagInContent = hashtagRegex.test(event.content);
        
        // Check if it has the hashtag as a t tag
        const hasHashtagInTags = event.tags.some(
          tag => tag[0] === 't' && tag[1].toLowerCase() === hashtag.toLowerCase()
        );
        
        return hasHashtagInContent || hasHashtagInTags;
      });
      
      // Remove duplicates by event ID
      const uniqueEvents = Array.from(
        new Map(combinedEvents.map(event => [event.id, event])).values()
      );
      
      // Sort by created_at (newest first)
      return uniqueEvents.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!nostr && !!hashtag,
    staleTime: 60000, // 1 minute
  });

  // Time window options
  const timeOptions = [
    { label: "24h", value: 86400 },
    { label: "Week", value: 604800 },
    { label: "Month", value: 2592000 },
    { label: "All Time", value: 315360000 }, // ~10 years
  ];

  // If no hashtag is specified
  if (!hashtag) {
    return (
      <div className="container mx-auto py-1 px-3 sm:px-4">
        <Header />
        <div className="mt-8 text-center">
          <h1 className="text-2xl font-bold mb-4 flex justify-center items-center gap-2">
            <Hash className="h-6 w-6" />
            Explore Hashtags
          </h1>
          
          <p className="text-muted-foreground mb-6">
            Select a hashtag to view related posts
          </p>
          
          <div className="max-w-2xl mx-auto">
            <TrendingTopics limit={16} className="mb-4" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-1 px-3 sm:px-4">
      <Header />

      <div className="flex flex-col mt-2">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="mb-4"
          >
            <Link to="/hashtags">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Hashtags
            </Link>
          </Button>

          <h1 className="text-2xl font-bold mb-3 flex items-center gap-2">
            <Hash className="h-6 w-6" />
            #{hashtag}
          </h1>

          {/* Time filter tabs */}
          <Tabs defaultValue={timeWindow.toString()} 
                onValueChange={(value) => setTimeWindow(parseInt(value))}>
            <TabsList>
              {timeOptions.map(option => (
                <TabsTrigger key={option.value} value={option.value.toString()}>
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Results */}
        <div className="max-w-2xl">
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="mb-3">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-4 w-full mb-1" />
                      <Skeleton className="h-4 w-4/5 mb-1" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : !posts || posts.length === 0 ? (
            <div className="text-center py-10">
              <h2 className="text-xl font-semibold mb-2">No posts found</h2>
              <p className="text-muted-foreground mb-4">
                Try a different hashtag or time period
              </p>
            </div>
          ) : (
            <>
              {/* Post list */}
              {posts.map(event => (
                <PostItem key={event.id} event={event} />
              ))}
              
              {/* Load more button */}
              {posts.length >= 40 * loadMoreCount && (
                <div className="flex justify-center my-4">
                  <Button 
                    variant="outline"
                    onClick={() => setLoadMoreCount(count => count + 1)}
                    className="flex items-center gap-1"
                  >
                    Load More
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* PWA Install Banner */}
      <PWAInstallBanner />
    </div>
  );
}