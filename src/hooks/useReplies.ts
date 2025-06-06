import { useNostr } from "@jsr/nostrify__react";
import { useQuery } from "@tanstack/react-query";
import { NostrEvent } from "@jsr/nostrify__nostrify";
import { KINDS } from "@/lib/nostr-kinds";

/**
 * Hook to fetch replies to a specific post
 * @param postId The ID of the post to fetch replies for
 * @param communityId The community ID for context
 */
export function useReplies(postId: string, communityId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ["replies", postId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Get replies using kind 1111 with the post as the parent
      const replies = await nostr.query([{ 
        kinds: [KINDS.GROUP_POST_REPLY],
        "#e": [postId],
        limit: 100,
      }], { signal });
      
      // Sort replies by created_at (oldest first for chronological conversation flow)
      return replies.sort((a, b) => a.created_at - b.created_at);
    },
    enabled: !!nostr && !!postId,
  });
}

/**
 * Hook to fetch nested replies to a specific reply
 * @param replyId The ID of the reply to fetch nested replies for
 */
export function useNestedReplies(replyId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ["nested-replies", replyId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Get nested replies using kind 1111 with the reply as the parent
      const replies = await nostr.query([{ 
        kinds: [KINDS.GROUP_POST_REPLY],
        "#e": [replyId],
        limit: 50,
      }], { signal });
      
      // Sort replies by created_at (oldest first for chronological conversation flow)
      return replies.sort((a, b) => a.created_at - b.created_at);
    },
    enabled: !!nostr && !!replyId,
  });
}