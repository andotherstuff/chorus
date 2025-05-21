import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { NostrEvent } from "@nostrify/nostrify";
import { useApprovedMembers } from "./useApprovedMembers";
import { useReplyApprovals } from "./useReplyApprovals";
import { parseNostrAddress } from "@/lib/nostr-utils";

/**
 * Hook to fetch all pending replies in a community
 * @param communityId The community ID to fetch pending replies for
 */
export function usePendingReplies(communityId: string) {
  const { nostr } = useNostr();
  const { approvedMembers, moderators } = useApprovedMembers(communityId);
  const { replyApprovals } = useReplyApprovals(communityId);

  return useQuery({
    queryKey: ["pending-replies", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Get all replies in the community (kind 1111 with the community tag)
      const replies = await nostr.query([{ 
        kinds: [1111],
        "#a": [communityId],
        limit: 100,
      }], { signal });
      
      // Parse the community ID to get the pubkey and identifier
      const parsedId = communityId.includes(':') 
        ? parseNostrAddress(communityId)
        : null;
      
      // Get community details to get the owner
      let communityOwnerPubkey = "";
      if (parsedId) {
        const communityEvent = await nostr.query([{ 
          kinds: [34550],
          authors: [parsedId.pubkey],
          "#d": [parsedId.identifier],
        }], { signal });
        
        communityOwnerPubkey = communityEvent[0]?.pubkey || "";
      }
      
      // Filter out replies that are:
      // 1. Already approved
      // 2. Posted by approved members (auto-approved)
      // 3. Posted by moderators (auto-approved)
      // 4. Posted by the community owner (auto-approved)
      const pendingReplies = replies.filter(reply => {
        // Skip if reply is already approved
        if (replyApprovals.includes(reply.id)) {
          return false;
        }
        
        // Skip if author is the community owner (auto-approved)
        if (communityOwnerPubkey && reply.pubkey === communityOwnerPubkey) {
          return false;
        }
        
        // Skip if author is an approved member or moderator (auto-approved)
        if (approvedMembers.includes(reply.pubkey) || moderators.includes(reply.pubkey)) {
          return false;
        }
        
        // Debug logging to help diagnose issues
        console.log("Pending reply check:", {
          replyId: reply.id,
          author: reply.pubkey,
          communityOwner: communityOwnerPubkey,
          isOwner: reply.pubkey === communityOwnerPubkey,
          isApproved: replyApprovals.includes(reply.id),
          isAuthorApproved: approvedMembers.includes(reply.pubkey),
          isAuthorModerator: moderators.includes(reply.pubkey),
          isPending: !replyApprovals.includes(reply.id) && 
                    reply.pubkey !== communityOwnerPubkey &&
                    !approvedMembers.includes(reply.pubkey) && 
                    !moderators.includes(reply.pubkey)
        });
        
        return true;
      });
      
      // Get the parent posts/replies for context
      const parentIds = pendingReplies
        .map(reply => {
          const parentTag = reply.tags.find(tag => tag[0] === "e");
          return parentTag ? parentTag[1] : null;
        })
        .filter((id): id is string => id !== null);
      
      // Fetch parent events if there are any
      let parentEvents: NostrEvent[] = [];
      if (parentIds.length > 0) {
        parentEvents = await nostr.query([{
          ids: parentIds,
          limit: parentIds.length
        }], { signal });
      }
      
      // Create a map of parent events for easy lookup
      const parentMap = new Map<string, NostrEvent>();
      for (const event of parentEvents) {
        parentMap.set(event.id, event);
      }
      
      // Enhance pending replies with parent information
      const enhancedPendingReplies = pendingReplies.map(reply => {
        const parentId = reply.tags.find(tag => tag[0] === "e")?.[1] || "";
        const parentEvent = parentMap.get(parentId);
        
        return {
          ...reply,
          parent: parentEvent || null,
          parentId
        };
      });
      
      // Sort by created_at (newest first)
      return enhancedPendingReplies.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!nostr && !!communityId,
    staleTime: 30000, // Cache for 30 seconds
  });
}