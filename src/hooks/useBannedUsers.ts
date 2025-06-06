import { useNostr } from "@/hooks/useNostr";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KINDS } from "@/lib/nostr-kinds";
import { NostrFilter } from "@jsr/nostrify__nostrify";
import { useGroup } from "./useGroup";

/**
 * Hook to manage banned users for a community
 * @param communityId Optional community ID. If not provided, some functions will require it as a parameter.
 */
export function useBannedUsers(communityId?: string) {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { data: group } = useGroup(communityId);
  const { mutateAsync: publishEvent } = useNostrPublish();

  // Query for banned users
  const { 
    data: bannedUsersEvents, 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: ["banned-users", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const moderators = new Set<string>([group!.pubkey]);

      for (const tag of group!.tags) {
        if (tag[0] === "p" && tag[3] === "moderator") {
          moderators.add(tag[1]);
        }
      }

      // Create the filter object
      const filter: NostrFilter = {
        kinds: [KINDS.GROUP_BANNED_MEMBERS_LIST],
        authors: [...moderators],
        limit: 50,
      };
      
      // Only add the community filter if communityId is defined
      if (communityId) {
        filter["#d"] = [communityId];
      }
      
      const events = await nostr.query([filter], { signal });
      
      return events;
    },
    enabled: !!nostr && !!communityId,
  });

  // Extract all banned user pubkeys from the events
  const bannedUsers = bannedUsersEvents?.flatMap(event => 
    event.tags.filter(tag => tag[0] === "p").map(tag => tag[1])
  ) || [];

  // Remove duplicates
  const uniqueBannedUsers = [...new Set(bannedUsers)];

  /**
   * Ban a user from the community
   * @param pubkey The public key of the user to ban
   * @param targetCommunityId Optional community ID to override the one provided to the hook
   */
  const banUser = async (pubkey: string, targetCommunityId?: string) => {
    const effectiveCommunityId = targetCommunityId || communityId;
    
    if (!effectiveCommunityId) {
      throw new Error("Community ID is required to ban a user");
    }
    
    try {
      // Create a new list with the user added to banned list
      const tags = [
        ["d", effectiveCommunityId],
        ...uniqueBannedUsers.map(pk => ["p", pk]),
        ["p", pubkey] // Add the new banned user
      ];

      // Create banned users event
      await publishEvent({
        kind: KINDS.GROUP_BANNED_MEMBERS_LIST,
        tags,
        content: "",
      });
      
      // Invalidate relevant queries
      invalidateRelatedQueries();
      
      toast.success("User banned successfully!");
      return true;
    } catch (error) {
      console.error("Error banning user:", error);
      toast.error("Failed to ban user. Please try again.");
      return false;
    }
  };

  /**
   * Unban a user from the community
   * @param pubkey The public key of the user to unban
   * @param targetCommunityId Optional community ID to override the one provided to the hook
   */
  const unbanUser = async (pubkey: string, targetCommunityId?: string) => {
    const effectiveCommunityId = targetCommunityId || communityId;
    
    if (!effectiveCommunityId) {
      throw new Error("Community ID is required to unban a user");
    }
    
    try {
      // Filter out the user to unban
      const updatedBannedUsers = uniqueBannedUsers.filter(pk => pk !== pubkey);
      
      // Create a new list with the user removed
      const tags = [
        ["d", effectiveCommunityId],
        ...updatedBannedUsers.map(pk => ["p", pk])
      ];

      // Create updated banned users event
      await publishEvent({
        kind: KINDS.GROUP_BANNED_MEMBERS_LIST,
        tags,
        content: "",
      });
      
      // Invalidate relevant queries
      invalidateRelatedQueries();
      
      toast.success("User unbanned successfully!");
      return true;
    } catch (error) {
      console.error("Error unbanning user:", error);
      toast.error("Failed to unban user. Please try again.");
      return false;
    }
  };

  /**
   * Invalidate all related queries when banned users list changes
   * @param targetCommunityId Optional community ID to override the one provided to the hook
   */
  const invalidateRelatedQueries = (targetCommunityId?: string) => {
    const effectiveCommunityId = targetCommunityId || communityId;
    
    if (!effectiveCommunityId) {
      // If no community ID is available, just invalidate general queries
      queryClient.invalidateQueries({ queryKey: ["banned-users"] });
      queryClient.invalidateQueries({ queryKey: ["approved-posts"] });
      queryClient.invalidateQueries({ queryKey: ["pending-posts"] });
      queryClient.invalidateQueries({ queryKey: ["pending-posts-count"] });
      queryClient.invalidateQueries({ queryKey: ["pending-replies"] });
      return;
    }
    
    // Invalidate the banned users query
    queryClient.invalidateQueries({ queryKey: ["banned-users", effectiveCommunityId] });
    
    // Invalidate post-related queries since banned users' posts should be hidden/shown
    queryClient.invalidateQueries({ queryKey: ["approved-posts", effectiveCommunityId] });
    queryClient.invalidateQueries({ queryKey: ["pending-posts", effectiveCommunityId] });
    queryClient.invalidateQueries({ queryKey: ["pending-posts-count", effectiveCommunityId] });
    queryClient.invalidateQueries({ queryKey: ["banned-users-count", effectiveCommunityId] });
    
    // Refetch the current query if we have a communityId
    queryClient.invalidateQueries({ queryKey: ["pending-replies", effectiveCommunityId] });
    if (communityId) {
      refetch();
    }
  };

  /**
   * Check if a user is banned
   */
  const isUserBanned = (pubkey: string) => {
    return uniqueBannedUsers.includes(pubkey);
  };

  return {
    bannedUsers: uniqueBannedUsers,
    isLoading,
    banUser,
    unbanUser,
    isUserBanned,
    refetch
  };
}