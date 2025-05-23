import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import { NostrEvent } from "@nostrify/nostrify";

// Interface for trending topic objects
export interface TrendingTopic {
  tag: string;
  count: number; // How many posts contain this tag
  recentEvents: NostrEvent[]; // Sample of recent events with this tag
}

/**
 * Hook to fetch trending topics from Nostr
 * @param timeWindow Time window in seconds to consider for trending (default: 24 hours)
 * @param limit Maximum number of trending topics to return
 */
export function useTrendingTopics(timeWindow: number = 86400, limit: number = 10) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ["trending-topics", timeWindow, limit],
    queryFn: async (c) => {
      if (!nostr) return [];

      // Create a signal that times out after 10 seconds
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);
      
      // Get the current timestamp
      const now = Math.floor(Date.now() / 1000);
      const since = now - timeWindow;
      
      // Fetch recent kind:1 (text note) events within the time window
      const events = await nostr.query([{ 
        kinds: [1], 
        since,
        limit: 500 // Fetch a good number of recent events for analysis
      }], { signal });
      
      // Extract all hashtags from event content and t tags
      const hashtagCounts = new Map<string, { count: number, events: NostrEvent[] }>();
      
      for (const event of events) {
        // Process hashtags in content (format: #hashtag)
        const hashtags = event.content.match(/#(\w+)/g) || [];
        const processedHashtags = new Set<string>(); // Track processed hashtags to avoid counting duplicates within the same post
        
        // Count each unique hashtag from content
        for (const tag of hashtags) {
          // Remove the # prefix for consistency and convert to lowercase
          const cleanTag = tag.substring(1).toLowerCase();
          
          // Skip if too short
          if (cleanTag.length < 2) continue;
          
          // Add to set of processed hashtags
          processedHashtags.add(cleanTag);
        }
        
        // Also check actual 't' tags in the event - proper Nostr way to tag topics
        const tTags = event.tags.filter(tag => tag[0] === 't');
        for (const tTag of tTags) {
          if (tTag.length < 2) continue;
          
          const tagValue = tTag[1].toLowerCase();
          if (tagValue.length < 2) continue;
          
          // Add to set of processed hashtags
          processedHashtags.add(tagValue);
        }
        
        // Now process all the unique hashtags found in this post
        for (const cleanTag of processedHashtags) {
          const existingData = hashtagCounts.get(cleanTag) || { count: 0, events: [] };
          existingData.count += 1;
          
          // Only keep up to 5 recent events per tag
          if (existingData.events.length < 5) {
            existingData.events.push(event);
          }
          
          hashtagCounts.set(cleanTag, existingData);
        }
      }
      
      // Convert the Map to an array of TrendingTopic objects
      const topicsArray = Array.from(hashtagCounts.entries()).map(([tag, data]) => ({
        tag,
        count: data.count,
        recentEvents: data.events
      }));
      
      // Sort by count (descending) and take top 'limit' topics
      return topicsArray
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    },
    enabled: !!nostr,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    refetchInterval: 600000, // Refetch every 10 minutes
  });
}