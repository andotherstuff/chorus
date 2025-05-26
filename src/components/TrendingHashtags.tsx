import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Hash } from "lucide-react";
import { Link } from "react-router-dom";
import { useTrendingHashtags } from "@/hooks/useTrendingHashtags";

interface TrendingHashtagsProps {
  limit?: number;
  showTitle?: boolean;
  className?: string;
}

export function TrendingHashtags({ 
  limit = 10, 
  showTitle = true,
  className = "" 
}: TrendingHashtagsProps) {
  const { data: trendingHashtags, isLoading, error } = useTrendingHashtags(limit);

  if (isLoading) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Trending
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !trendingHashtags?.length) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Trending
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No trending hashtags yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Trending
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-2">
        {trendingHashtags.map((item, index) => (
          <Link 
            key={item.hashtag}
            to={`/t/${item.hashtag}`}
            className="flex items-center justify-between p-2 rounded hover:bg-muted/30 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-4">
                {index + 1}
              </span>
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium group-hover:text-foreground">
                {item.hashtag}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {item.count}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}