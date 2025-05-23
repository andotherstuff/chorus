import { useNostr } from "./useNostr";
import { useQuery } from "@tanstack/react-query";
import { useNostrPublish } from "./useNostrPublish";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";
import { KINDS } from "@/lib/nostr-kinds";

/**
 * Hook to get likes for a post and handle liking/unliking
 */
export function useLikes(eventId: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();

  // Query to get all likes for this event
  const { data: likes, isLoading, refetch } = useQuery({
    queryKey: ["likes", eventId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      // Get all kind 7 reactions with "+" content that reference this event
      const events = await nostr.query([{ 
        kinds: [KINDS.REACTION],
        "#e": [eventId],
        limit: 100,
      }], { signal });
      
      // Filter to only include "likes" (content is "+" or empty string)
      return events.filter(event => 
        event.content === "+" || event.content === ""
      );
    },
    enabled: !!nostr && !!eventId,
  });

  // Check if the current user has liked this post
  const hasLiked = !!user && !!likes?.some(like => like.pubkey === user.pubkey);
  
  // Count of likes
  const likeCount = likes?.length || 0;

  // Function to like a post
  const likePost = async () => {
    if (!user) {
      toast.error("You must be logged in to like posts");
      return;
    }

    try {
      // Create a like event (kind 7)
      await publishEvent({
        kind: KINDS.REACTION,
        tags: [
          ["e", eventId],
          ["k", String(KINDS.GROUP_POST)], // Assuming we're liking a kind 11 post
        ],
        content: "+", // "+" means like
      });
      
      // Refetch likes to update the UI
      refetch();
      
      toast.success("Post liked!");
    } catch (error) {
      console.error("Error liking post:", error);
      toast.error("Failed to like post. Please try again.");
    }
  };

  // Function to unlike a post (by publishing a deletion event)
  const unlikePost = async () => {
    if (!user) {
      toast.error("You must be logged in to unlike posts");
      return;
    }

    try {
      // Find the user's like event
      const userLike = likes?.find(like => like.pubkey === user.pubkey);
      
      if (!userLike) {
        console.error("No like event found to unlike");
        return;
      }
      
      // Create a deletion event (kind 5) that references the like event
      await publishEvent({
        kind: 5,
        tags: [
          ["e", userLike.id], // Reference the like event to delete
        ],
        content: "Deleted like",
      });
      
      // Refetch likes to update the UI
      refetch();
      
      toast.success("Post unliked!");
    } catch (error) {
      console.error("Error unliking post:", error);
      toast.error("Failed to unlike post. Please try again.");
    }
  };

  // Toggle like function
  const toggleLike = async () => {
    if (hasLiked) {
      await unlikePost();
    } else {
      await likePost();
    }
  };

  return {
    likes,
    likeCount,
    hasLiked,
    toggleLike,
    isLoading,
  };
}