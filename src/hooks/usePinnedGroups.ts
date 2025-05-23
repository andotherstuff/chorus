import { useNostr } from "./useNostr";
import { useCurrentUser } from "./useCurrentUser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNostrPublish } from "./useNostrPublish";
import { KINDS } from "@/lib/nostr-kinds";

export interface PinnedGroup {
  communityId: string;
  relayUrl?: string;
}

export function usePinnedGroups() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();

  // Fetch pinned groups
  const query = useQuery({
    queryKey: ["pinned-groups", user?.pubkey],
    queryFn: async (c) => {
      if (!user || !nostr) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Fetch the user's pinned groups event (kind 14553)
      const events = await nostr.query([
        { 
          kinds: [KINDS.PINNED_GROUPS_LIST], 
          authors: [user.pubkey],
          limit: 1 
        }
      ], { signal });

      // If no pinned groups event exists, return empty array
      if (!events || events.length === 0) {
        return [];
      }

      // Get the most recent event
      const pinnedGroupsEvent = events[0];
      
      // Extract the pinned groups from the tags
      const pinnedGroups: PinnedGroup[] = pinnedGroupsEvent.tags
        .filter(tag => tag[0] === "a" && tag[1]?.startsWith(`${KINDS.GROUP}:`))
        .map(tag => ({
          communityId: tag[1],
          relayUrl: tag[2] || undefined
        }));

      return pinnedGroups;
    },
    enabled: !!nostr && !!user,
  });

  // Mutation to update pinned groups
  const updatePinnedGroups = useMutation({
    mutationFn: async (pinnedGroups: PinnedGroup[]) => {
      if (!user) throw new Error("User not logged in");

      // Create tags for the event
      const tags = pinnedGroups.map(group => ["d", group.communityId]);

      // Publish the kind 14553 event
      await publishEvent({
        kind: KINDS.PINNED_GROUPS_LIST,
        tags,
        content: ""
      });

      return pinnedGroups;
    },
    onSuccess: () => {
      // Invalidate the pinned groups query to refetch
      queryClient.invalidateQueries({ queryKey: ["pinned-groups", user?.pubkey] });
      // Also invalidate user groups to update the UI
      queryClient.invalidateQueries({ queryKey: ["user-groups", user?.pubkey] });
    }
  });

  // Function to pin a group
  const pinGroup = async (communityId: string, relayUrl?: string) => {
    const currentPinnedGroups = query.data || [];
    
    // Check if group is already pinned
    const isAlreadyPinned = currentPinnedGroups.some(
      group => group.communityId === communityId
    );
    
    if (isAlreadyPinned) return;
    
    // Add the group to the beginning of the list (highest priority)
    const updatedPinnedGroups = [
      { communityId, relayUrl },
      ...currentPinnedGroups
    ];
    
    await updatePinnedGroups.mutateAsync(updatedPinnedGroups);
  };

  // Function to unpin a group
  const unpinGroup = async (communityId: string) => {
    const currentPinnedGroups = query.data || [];
    
    // Filter out the group to unpin
    const updatedPinnedGroups = currentPinnedGroups.filter(
      group => group.communityId !== communityId
    );
    
    await updatePinnedGroups.mutateAsync(updatedPinnedGroups);
  };

  // Function to check if a group is pinned
  const isGroupPinned = (communityId: string) => {
    const pinnedGroups = query.data || [];
    return pinnedGroups.some(group => group.communityId === communityId);
  };

  return {
    pinnedGroups: query.data || [],
    isLoading: query.isLoading,
    isUpdating: updatePinnedGroups.isPending,
    pinGroup,
    unpinGroup,
    isGroupPinned
  };
}