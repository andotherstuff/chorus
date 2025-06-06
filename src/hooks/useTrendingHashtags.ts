import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@jsr/nostrify__react';
import { KINDS } from "@/lib/nostr-kinds";

export interface TrendingHashtag {
  hashtag: string;
  count: number;
  recentPosts: number; // posts in last 24h
}

export function useTrendingHashtags(limit = 10) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['trending-hashtags', limit],
    queryFn: async () => {
      if (!nostr) return [];

      const signal = AbortSignal.timeout(5000);
      
      // Get recent posts from the last 7 days to analyze trending hashtags
      const since = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60); // 7 days ago
      const recent24h = Math.floor(Date.now() / 1000) - (24 * 60 * 60); // 24 hours ago

      try {
        // Query for recent posts that might contain hashtags
        const events = await nostr.query([
          {
            kinds: [KINDS.TEXT_NOTE, KINDS.GROUP_POST], // text notes and community posts
            since,
            limit: 1000, // Get a good sample size
          }
        ], { signal });

        // Track hashtag counts and recent activity
        const hashtagStats = new Map<string, { total: number; recent: number }>();

        events.forEach(event => {
          // Extract hashtags from content
          const contentHashtags = (event.content.match(/#(\w+)/g) || [])
            .map(tag => tag.slice(1).toLowerCase());

          // Extract hashtags from 't' tags
          const tTagHashtags = event.tags
            .filter(tag => tag[0] === 't' && tag[1])
            .map(tag => tag[1].toLowerCase());

          // Combine all hashtags
          const allHashtags = [...contentHashtags, ...tTagHashtags];
          
          // Remove duplicates within this event
          const uniqueHashtags = [...new Set(allHashtags)];

          const isRecent = event.created_at > recent24h;

          uniqueHashtags.forEach(hashtag => {
            const current = hashtagStats.get(hashtag) || { total: 0, recent: 0 };
            current.total += 1;
            if (isRecent) {
              current.recent += 1;
            }
            hashtagStats.set(hashtag, current);
          });
        });

        // Convert to array and calculate trending score
        const trendingHashtags: TrendingHashtag[] = Array.from(hashtagStats.entries())
          .map(([hashtag, stats]) => ({
            hashtag,
            count: stats.total,
            recentPosts: stats.recent,
          }))
          .filter(item => item.count >= 2) // Minimum threshold
          .sort((a, b) => {
            // Trending algorithm: weight recent activity heavily
            const scoreA = a.recentPosts * 3 + a.count;
            const scoreB = b.recentPosts * 3 + b.count;
            return scoreB - scoreA;
          })
          .slice(0, limit);

        console.log('Trending hashtags calculated:', trendingHashtags);
        return trendingHashtags;

      } catch (error) {
        console.error('Error fetching trending hashtags:', error);
        return [];
      }
    },
    enabled: !!nostr,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
}