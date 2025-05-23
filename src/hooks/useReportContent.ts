import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { KINDS } from "@/lib/nostr-kinds";
import { toast } from "sonner";

export type ReportType = "nudity" | "malware" | "profanity" | "illegal" | "spam" | "impersonation" | "other";

export interface ReportOptions {
  pubkey: string;
  eventId?: string;
  communityId?: string;
  reportType: ReportType;
  reason: string;
}

export function useReportContent() {
  const { mutateAsync: publishEvent, isPending } = useNostrPublish();
  const { user } = useCurrentUser();

  const reportContent = async (options: ReportOptions) => {
    if (!user) {
      toast.error("You must be logged in to report content");
      throw new Error("User not logged in");
    }

    const { pubkey, eventId, communityId, reportType, reason } = options;

    const tags: string[][] = [
      ["p", pubkey, reportType]
    ];

    if (eventId) {
      tags.push(["e", eventId, reportType]);
    }

    if (communityId) {
      tags.push(["a", communityId]);
    }

    try {
      await publishEvent({
        kind: KINDS.REPORT,
        tags,
        content: reason || "",
      });

      toast.success("Report submitted successfully");
      return true;
    } catch (error) {
      console.error("Error reporting content:", error);
      toast.error("Failed to submit report. Please try again.");
      throw error;
    }
  };

  return {
    reportContent,
    isPending
  };
}