import React from "react";
import { Link } from "react-router-dom";
import { useTrendingTopics } from "@/hooks/useTrendingTopics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TrendingTopicsProps {
  timeWindow?: number; // In seconds, default: 24 hours
  limit?: number; // Number of topics to show
  className?: string;
}

export function TrendingTopics({
  timeWindow = 86400,
  limit = 10,
  className = "",
}: TrendingTopicsProps) {
  const { data: trendingTopics, isLoading } = useTrendingTopics(timeWindow, limit);

  // Time window options for dropdown
  const timeOptions = [
    { label: "Last 24 hours", value: 86400 },
    { label: "Last 48 hours", value: 172800 },
    { label: "Last week", value: 604800 },
  ];

  // Function to format time window
  const formatTimeWindow = (seconds: number) => {
    if (seconds === 86400) return "24h";
    if (seconds === 172800) return "48h";
    if (seconds === 604800) return "7d";
    return `${Math.floor(seconds / 86400)}d`;
  };

  // If there are no trending topics and not loading
  if (!isLoading && (!trendingTopics || trendingTopics.length === 0)) {
    return null; // Don't render anything if there's no data
  }

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Trending Topics</CardTitle>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatTimeWindow(timeWindow)}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Trending in the last {formatTimeWindow(timeWindow)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-16" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {trendingTopics?.map((topic) => (
              <Link key={topic.tag} to={`/hashtags/${encodeURIComponent(topic.tag)}`}>
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80 transition-colors"
                >
                  #{topic.tag}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {topic.count}
                  </span>
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}