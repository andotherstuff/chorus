import { useQuery } from "@tanstack/react-query";
import { useNostr } from "@/hooks/useNostr";
import { KINDS } from "@/lib/nostr-kinds";
import type { NostrEvent } from "@nostrify/nostrify";

interface GroupDeletionRequest {
  deletionEvent: NostrEvent;
  groupId: string;
  isValid: boolean;
  reason?: string;
}

/**
 * Hook to fetch and validate deletion requests for groups
 * Returns a map of groupId -> deletion request info
 */
export function useGroupDeletionRequests(groupIds: string[]) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ["group-deletion-requests", groupIds.sort()],
    queryFn: async (c) => {
      if (groupIds.length === 0) {
        return new Map<string, GroupDeletionRequest>();
      }

      try {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
        
        // Query for kind 5 deletion events that reference groups via 'a' tags or 'e' tags
        // We need to extract event IDs from group IDs for 'e' tag filtering
        const groupEventIds: string[] = [];
        
        // For each group ID, we need to query for the actual group event to get its event ID
        // This is needed for 'e' tag compatibility
        for (const groupId of groupIds) {
          const parts = groupId.split(":");
          if (parts.length === 3 && parts[0] === KINDS.GROUP.toString()) {
            const [, pubkey, identifier] = parts;
            try {
              const groupEvents = await nostr.query([{
                kinds: [KINDS.GROUP],
                authors: [pubkey],
                "#d": [identifier],
                limit: 1
              }], { signal: AbortSignal.timeout(2000) });
              
              if (groupEvents.length > 0) {
                groupEventIds.push(groupEvents[0].id);
              }
            } catch (error) {
              // If we can't fetch the group event, skip it for 'e' tag filtering
              console.warn("Could not fetch group event for deletion filtering:", groupId, error);
            }
          }
        }

        // Query for deletion events using both 'a' tags and 'e' tags
        const deletionEvents = await nostr.query([
          {
            kinds: [KINDS.DELETION],
            "#a": groupIds,
            limit: 500
          },
          ...(groupEventIds.length > 0 ? [{
            kinds: [KINDS.DELETION],
            "#e": groupEventIds,
            limit: 500
          }] : [])
        ], { signal });

        const deletionMap = new Map<string, GroupDeletionRequest>();

        // Process each deletion event
        for (const deletionEvent of deletionEvents) {
          // Find the 'a' tags that reference groups (kind 34550)
          const aTags = deletionEvent.tags.filter(tag => 
            tag[0] === "a" && tag[1] && tag[1].startsWith(`${KINDS.GROUP}:`)
          );

          // Process 'a' tags (addressable event references)
          for (const aTag of aTags) {
            const groupId = aTag[1];
            
            // Parse the group ID to get the owner's pubkey
            const parts = groupId.split(":");
            if (parts.length !== 3 || parts[0] !== KINDS.GROUP.toString()) {
              continue;
            }
            
            const [, groupOwnerPubkey] = parts;
            
            // Validate that the deletion request is from the group owner
            const isValid = deletionEvent.pubkey === groupOwnerPubkey;
            
            // Only store the most recent valid deletion request for each group
            const existing = deletionMap.get(groupId);
            if (!existing || (isValid && deletionEvent.created_at > existing.deletionEvent.created_at)) {
              deletionMap.set(groupId, {
                deletionEvent,
                groupId,
                isValid,
                reason: deletionEvent.content || undefined
              });
            }
          }

          // Also check 'e' tags for event ID references
          // This provides compatibility with relays that primarily use 'e' tags for deletions
          const eTags = deletionEvent.tags.filter(tag => tag[0] === "e" && tag[1]);
          
          if (eTags.length > 0) {
            // For 'e' tag processing, we need to be more careful since we need to match
            // event IDs to group IDs. We'll query for the referenced events to validate them.
            for (const eTag of eTags) {
              const eventId = eTag[1];
              
              try {
                // Query for the referenced event to see if it's a group event
                const referencedEvents = await nostr.query([{
                  ids: [eventId],
                  kinds: [KINDS.GROUP],
                  limit: 1
                }], { signal: AbortSignal.timeout(2000) });
                
                if (referencedEvents.length > 0) {
                  const groupEvent = referencedEvents[0];
                  const dTag = groupEvent.tags.find(tag => tag[0] === "d");
                  
                  if (dTag) {
                    const groupId = `${KINDS.GROUP}:${groupEvent.pubkey}:${dTag[1]}`;
                    
                    // Check if this group is in our target list
                    if (groupIds.includes(groupId)) {
                      // Validate that the deletion request is from the group owner
                      const isValid = deletionEvent.pubkey === groupEvent.pubkey;
                      
                      // Only store the most recent valid deletion request for each group
                      const existing = deletionMap.get(groupId);
                      if (!existing || (isValid && deletionEvent.created_at > existing.deletionEvent.created_at)) {
                        deletionMap.set(groupId, {
                          deletionEvent,
                          groupId,
                          isValid,
                          reason: deletionEvent.content || undefined
                        });
                      }
                    }
                  }
                }
              } catch (error) {
                // If we can't fetch the referenced event, skip this 'e' tag
                console.warn("Could not fetch referenced event for deletion validation:", eventId, error);
                continue;
              }
            }
          }
        }

        return deletionMap;
      } catch (error) {
        console.error("Error fetching group deletion requests:", error);
        return new Map<string, GroupDeletionRequest>();
      }
    },
    enabled: groupIds.length > 0,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });
}

/**
 * Hook to check if a specific group has been deleted
 */
export function useIsGroupDeleted(groupId: string | undefined) {
  const { data: deletionRequests } = useGroupDeletionRequests(
    groupId ? [groupId] : []
  );

  if (!groupId || !deletionRequests) {
    return {
      isDeleted: false,
      deletionRequest: undefined,
      isLoading: false
    };
  }

  const deletionRequest = deletionRequests.get(groupId);
  
  return {
    isDeleted: deletionRequest?.isValid || false,
    deletionRequest: deletionRequest?.isValid ? deletionRequest : undefined,
    isLoading: false
  };
}