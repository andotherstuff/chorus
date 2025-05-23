import React, { useState } from "react";
import { useTrendingTopics } from "@/hooks/useTrendingTopics";
import Header from "@/components/ui/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NoteContent } from "@/components/NoteContent";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrendingUp, Clock, Hash } from "lucide-react";
import type { NostrEvent } from "@nostrify/nostrify";
import { useAuthor } from "@/hooks/useAuthor";
import { Link } from "react-router-dom";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";

// Helper component to display a single post
function PostPreview({ event }: { event: NostrEvent }) {
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
            <NoteContent event={event} className="text-sm" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TrendingPage() {
  // Time window options
  const timeOptions = [
    { label: "24h", value: 86400 },
    { label: "48h", value: 172800 },
    { label: "7d", value: 604800 },
  ];

  const [timeWindow, setTimeWindow] = useState(timeOptions[0].value);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  
  // Fetch trending topics with the selected time window
  const { data: trendingTopics, isLoading } = useTrendingTopics(timeWindow, 20);

  // Find the selected topic data
  const selectedTopicData = trendingTopics?.find(topic => topic.tag === selectedTopic);

  return (
    <div className="container mx-auto py-1 px-3 sm:px-4">
      <Header />

      <div className="flex flex-col mt-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Trending Topics
          </h1>
          
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="flex items-center gap-1"
          >
            <Link to="/hashtags">
              <Hash className="h-4 w-4 mr-1" />
              Explore All Hashtags
            </Link>
          </Button>
        </div>

        <div className="mb-6">
          <Tabs defaultValue={timeOptions[0].value.toString()} 
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

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-24" />
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full mb-3" />
                ))}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Popular Hashtags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {trendingTopics?.map((topic) => (
                    <Badge
                      key={topic.tag}
                      variant={selectedTopic === topic.tag ? "default" : "secondary"}
                      className="cursor-pointer text-sm py-1.5 px-3"
                      onClick={() => setSelectedTopic(topic.tag)}
                    >
                      #{topic.tag}
                      <span className="ml-1.5 text-xs">
                        {topic.count}
                      </span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {selectedTopic ? (
                      <>
                        <Hash className="h-4 w-4" />
                        {selectedTopic}
                      </>
                    ) : (
                      "Select a topic to see recent posts"
                    )}
                  </CardTitle>
                  {selectedTopic && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      asChild
                      className="text-xs"
                    >
                      <Link to={`/hashtags/${encodeURIComponent(selectedTopic)}`}>
                        View all posts
                      </Link>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedTopicData ? (
                  selectedTopicData.recentEvents.length > 0 ? (
                    <div>
                      {selectedTopicData.recentEvents.map((event) => (
                        <PostPreview key={event.id} event={event} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No recent posts found.</p>
                  )
                ) : (
                  <p className="text-muted-foreground">Select a hashtag from the left to see recent posts.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* PWA Install Banner */}
      <PWAInstallBanner />
    </div>
  );
}