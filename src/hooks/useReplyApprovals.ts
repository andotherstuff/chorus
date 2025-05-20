import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import { NostrEvent } from "@nostrify/nostrify";

/**
 * Hook to fetch and manage reply approvals
 * @param communityId The community ID to check approvals for
 */
export function useReplyApprovals(communityId: string) {
  const { nostr } = useNostr();

  // Query for reply approval events
  const { data: replyApprovals, isLoading } = useQuery({
    queryKey: ["reply-approvals", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Get approval events for replies (kind 4550 with k=1111)
      const approvals = await nostr.query([{ 
        kinds: [4550],
        "#a": [communityId],
        "#k": ["1111"],
        limit: 100,
      }], { signal });
      
      // Extract the approved reply IDs
      return approvals.map(approval => {
        const eventTag = approval.tags.find(tag => tag[0] === "e");
        return eventTag ? eventTag[1] : null;
      }).filter((id): id is string => id !== null);
    },
    enabled: !!nostr && !!communityId,
  });

  /**
   * Check if a reply is approved
   * @param replyId The reply ID to check
   * @returns boolean indicating if the reply is approved
   */
  const isReplyApproved = (replyId: string): boolean => {
    return replyApprovals?.includes(replyId) || false;
  };

  return {
    replyApprovals: replyApprovals || [],
    isReplyApproved,
    isLoading
  };
}