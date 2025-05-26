import { useNostr } from "./useNostr";
import { useCurrentUser } from "./useCurrentUser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNostrPublish } from "./useNostrPublish";
import { KINDS } from "@/lib/nostr-kinds";
import { useGroup } from "./useGroup";

export interface PinnedPost {
  eventId: string;
  relayUrl?: string;
}

export function usePinnedPosts(communityId: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { data: group } = useGroup(communityId);
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();

  // Fetch pinned posts for the community
  const query = useQuery({
    queryKey: ["pinned-posts", communityId],
    queryFn: async (c) => {
      if (!nostr || !communityId) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const moderators = new Set<string>([group!.pubkey]);

      for (const tag of group!.tags) {
        if (tag[0] === "p" && tag[3] === "moderator") {
          moderators.add(tag[1]);
        }
      }
      
      // Fetch pinned posts events (kind 14554) for this community from all moderators
      const events = await nostr.query([
        { 
          kinds: [KINDS.GROUP_PINNED_POSTS_LIST], 
          authors: [...moderators],
          "#d": [communityId],
          limit: 50 
        }
      ], { signal });

      // If no pinned posts events exist, return empty array
      if (!events || events.length === 0) {
        return [];
      }

      // Get all pinned post IDs from all events (multiple moderators can pin posts)
      const pinnedPostIds = new Set<string>();
      
      for (const event of events) {
        // Extract the pinned post IDs from the "e" tags
        const eventTags = event.tags.filter(tag => tag[0] === "e");
        for (const tag of eventTags) {
          pinnedPostIds.add(tag[1]);
        }
      }

      return Array.from(pinnedPostIds);
    },
    enabled: !!nostr && !!communityId,
    // Ensure the query refetches when the component mounts
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Mutation to pin a post
  const pinPost = useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) throw new Error("User not logged in");

      // First, get the current pinned posts event to see if one already exists
      const signal = AbortSignal.timeout(5000);
      const existingEvents = await nostr.query([
        { 
          kinds: [KINDS.GROUP_PINNED_POSTS_LIST], 
          authors: [user.pubkey],
          "#d": [communityId],
          limit: 1 
        }
      ], { signal });

      // Start with the community tag
      const tags = [["d", communityId]];

      // If there's an existing event, copy its e tags and add the new one
      if (existingEvents.length > 0) {
        const existingEvent = existingEvents[0];
        const existingETags = existingEvent.tags.filter(tag => tag[0] === "e");
        
        // Add existing e tags (avoid duplicates)
        for (const eTag of existingETags) {
          if (eTag[1] !== eventId) {
            tags.push(eTag);
          }
        }
      }

      // Add the new e tag
      tags.push(["e", eventId]);

      // Publish the kind 14554 event
      await publishEvent({
        kind: KINDS.GROUP_PINNED_POSTS_LIST,
        tags,
        content: ""
      });

      return eventId;
    },
    onSuccess: () => {
      // Invalidate the pinned posts query to refetch
      queryClient.invalidateQueries({ queryKey: ["pinned-posts", communityId] });
      // Also invalidate the pinned posts content query
      queryClient.invalidateQueries({ queryKey: ["pinned-posts-content", communityId] });
    }
  });

  // Mutation to unpin a post
  const unpinPost = useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) throw new Error("User not logged in");

      // First, get the current pinned posts event
      const signal = AbortSignal.timeout(5000);
      const existingEvents = await nostr.query([
        { 
          kinds: [KINDS.GROUP_PINNED_POSTS_LIST], 
          authors: [user.pubkey],
          "#d": [communityId],
          limit: 1 
        }
      ], { signal });

      if (existingEvents.length === 0) {
        throw new Error("No pinned posts event found");
      }

      const existingEvent = existingEvents[0];
      const existingETags = existingEvent.tags.filter(tag => tag[0] === "e");
      
      // Filter out the post we want to unpin
      const remainingETags = existingETags.filter(tag => tag[1] !== eventId);

      // Start with the community tag
      const tags = [["d", communityId]];
      
      // Add the remaining e tags
      for (const eTag of remainingETags) {
        tags.push(eTag);
      }

      // If there are no remaining pinned posts, we could either:
      // 1. Publish an empty event with just the "d" tag, or
      // 2. Delete the entire event
      // Let's go with option 1 for consistency
      
      // Publish the updated kind 14554 event
      await publishEvent({
        kind: KINDS.GROUP_PINNED_POSTS_LIST,
        tags,
        content: ""
      });

      return eventId;
    },
    onSuccess: () => {
      // Invalidate the pinned posts query to refetch
      queryClient.invalidateQueries({ queryKey: ["pinned-posts", communityId] });
      // Also invalidate the pinned posts content query
      queryClient.invalidateQueries({ queryKey: ["pinned-posts-content", communityId] });
    }
  });

  // Function to check if a post is pinned
  const isPostPinned = (eventId: string) => {
    const pinnedPostIds = query.data || [];
    return pinnedPostIds.includes(eventId);
  };

  return {
    pinnedPostIds: query.data || [],
    isLoading: query.isLoading,
    isPinning: pinPost.isPending,
    isUnpinning: unpinPost.isPending,
    pinPost: pinPost.mutateAsync,
    unpinPost: unpinPost.mutateAsync,
    isPostPinned
  };
}