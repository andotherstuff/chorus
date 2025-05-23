import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { useBannedUsers } from "@/hooks/useBannedUsers";
import { useNostr } from "@/hooks/useNostr";
import { NostrEvent } from "@nostrify/nostrify";
import { useUpdateApprovedMembers } from "@/hooks/useUpdateApprovedMembers";

export type ModeratorAction = "remove_content" | "remove_user" | "ban_user" | "no_action";

export interface ReportActionOptions {
  reportId: string;
  communityId: string;
  pubkey: string;
  eventId?: string;
  action: ModeratorAction;
  reason?: string;
}

export function useReportActions() {
  const { mutateAsync: publishEvent, isPending: isPublishPending } = useNostrPublish({
    invalidateQueries: [
      { queryKey: ["group-reports"] },
      { queryKey: ["approved-posts"] },
      { queryKey: ["pending-posts"] },
      { queryKey: ["open-reports-count"] }
    ]
  });
  const { user } = useCurrentUser();
  // We'll initialize the banUser function inside handleReportAction
  const { banUser } = useBannedUsers();
  const { nostr } = useNostr();
  const { removeFromApprovedList, isPending: isRemovePending } = useUpdateApprovedMembers();
  
  const isPending = isPublishPending || isRemovePending;

  const handleReportAction = async (options: ReportActionOptions) => {
    if (!user) {
      toast.error("You must be logged in to take action on reports");
      throw new Error("User not logged in");
    }

    const { reportId, communityId, pubkey, eventId, action, reason } = options;

    try {
      // Take the appropriate action based on moderator decision
      switch (action) {
        case "remove_content":
          if (eventId) {
            // Fetch the post to get its kind and include it in the removal event
            try {
              // Fetch the original post
              const events = await nostr.query([{
                ids: [eventId],
                limit: 1,
              }], { signal: AbortSignal.timeout(5000) });
              
              if (events.length === 0) {
                throw new Error("Post not found");
              }
              
              const post = events[0] as NostrEvent;
              const postKind = post.kind.toString();
              
              // Get the community identifier from the post's a-tag if available
              let communityIdentifier = communityId;
              const postCommunityTag = post.tags.find(tag => tag[0] === "a");
              if (postCommunityTag) {
                communityIdentifier = postCommunityTag[1];
              }
              
              // Create the removal event
              await publishEvent({
                kind: 4551, // Remove post
                tags: [
                  ["a", communityIdentifier], 
                  ["e", eventId], 
                  ["p", pubkey], 
                  ["k", postKind]
                ],
                content: JSON.stringify(post), // Include the full post event as JSON
              });
              
              // Also publish a separate event with the reason if provided
              if (reason) {
                await publishEvent({
                  kind: 1985, // Label
                  tags: [
                    ["e", eventId],
                    ["a", communityIdentifier],
                    ["l", "removal-reason"],
                    ["L", "chorus.removal.reason"]
                  ],
                  content: reason,
                });
              }
            } catch (error) {
              console.error("Error fetching post for removal:", error);
              toast.error("Failed to remove post: Could not fetch post details");
              throw error;
            }
          }
          break;
          
        case "remove_user":
          // Remove user from approved members list
          const result = await removeFromApprovedList(pubkey, communityId);
          
          if (result.success) {
            if (result.message === "User is not in the approved members list") {
              toast.warning("User was not found in the approved members list");
            } else {
              toast.success("User removed from approved members list");
            }
          } else {
            toast.error(result.message);
            throw new Error(result.message);
          }
          break;
          
        case "ban_user":
          // Ban the user with the specific communityId
          await banUser(pubkey, communityId);
          
          // Also remove the user from the approved users list
          const removeResult = await removeFromApprovedList(pubkey, communityId);
          
          if (removeResult.success) {
            if (removeResult.message === "User is not in the approved members list") {
              // User wasn't in approved list, that's fine
              console.log("User was not in approved members list when banned");
            } else {
              console.log("User removed from approved members list during ban");
            }
          } else {
            // Log the error but don't fail the entire ban operation
            console.error("Failed to remove user from approved list during ban:", removeResult.message);
            toast.warning("User was banned but could not be removed from approved members list");
          }
          break;
          
        case "no_action":
          // No additional action needed
          break;
      }

      // After the action has been successfully taken, submit a Kind 4554 event
      // to mark the report as handled
      let actionType = "";
      switch (action) {
        case "no_action":
          actionType = "closed without action";
          break;
        case "remove_content":
          actionType = "content removed";
          break;
        case "remove_user":
          actionType = "user removed";
          break;
        case "ban_user":
          actionType = "user banned";
          break;
      }

      await publishEvent({
        kind: 4554, // New event type for report resolution
        tags: [
          ["e", reportId], // Reference to the original report event
          ["a", communityId],
          ["t", actionType] // Tag indicating what action was taken
        ],
        content: reason || `Report resolved: ${actionType}`,
      });

      toast.success("Action taken successfully");
      return true;
    } catch (error) {
      console.error("Error taking action on report:", error);
      toast.error("Failed to take action. Please try again.");
      throw error;
    }
  };

  return {
    handleReportAction,
    isPending
  };
}