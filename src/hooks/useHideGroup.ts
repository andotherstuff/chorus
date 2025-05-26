import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSiteAdmin } from "@/hooks/useSiteAdmin";
import { KINDS } from "@/lib/nostr-kinds";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export type HideGroupReason = "spam" | "illegal" | "malware" | "inappropriate" | "other";

export interface HideGroupOptions {
  communityId: string;
  reason: HideGroupReason;
  details: string;
}

/**
 * Hook for Site Admins to hide groups using 1984 events
 */
export function useHideGroup() {
  const { mutateAsync: publishEvent, isPending } = useNostrPublish();
  const { user } = useCurrentUser();
  const { isSiteAdmin } = useSiteAdmin();
  const queryClient = useQueryClient();

  const hideGroup = async (options: HideGroupOptions) => {
    if (!user) {
      toast.error("You must be logged in to hide groups");
      throw new Error("User not logged in");
    }

    if (!isSiteAdmin) {
      toast.error("You must be a Site Admin to hide groups");
      throw new Error("User is not a Site Admin");
    }

    const { communityId, reason, details } = options;

    const tags: string[][] = [
      ["a", communityId, reason]
    ];

    try {
      await publishEvent({
        kind: KINDS.REPORT,
        tags,
        content: details || "",
      });

      // Invalidate hidden groups query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["hidden-groups"] });

      toast.success("Group hidden successfully");
      return true;
    } catch (error) {
      console.error("Error hiding group:", error);
      toast.error("Failed to hide group. Please try again.");
      throw error;
    }
  };

  return {
    hideGroup,
    isPending,
    canHideGroups: isSiteAdmin
  };
}