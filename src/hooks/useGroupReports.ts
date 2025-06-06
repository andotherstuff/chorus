import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { NostrEvent } from "@jsr/nostrify__nostrify";
import { KINDS } from "@/lib/nostr-kinds";

export interface Report extends NostrEvent {
  reportType: string;
  reportedPubkey: string;
  reportedEventId?: string;
  reason: string;
  isClosed: boolean;
  resolutionAction?: string;
  resolutionReason?: string;
}

export function useGroupReports(communityId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ["group-reports", communityId],
    queryFn: async (c) => {
      if (!communityId) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Query for reports that have the community's a-tag
      const reports = await nostr.query([{
        kinds: [KINDS.REPORT],
        "#a": [communityId],
        limit: 100,
      }], { signal });

      // Query for resolution events (Kind 4554) that reference reports
      const reportIds = reports.map(report => report.id);
      const resolutionEvents = reportIds.length > 0 ? await nostr.query([{
        kinds: [KINDS.GROUP_CLOSE_REPORT],
        "#e": reportIds,
        "#a": [communityId],
      }], { signal }) : [];

      // Create a map of report IDs to resolution events
      const resolutionMap = new Map();
      for (const resolution of resolutionEvents) {
        const reportId = resolution.tags.find(tag => tag[0] === "e")?.[1];
        if (reportId) {
          resolutionMap.set(reportId, resolution);
        }
      }

      // Process the reports to extract relevant information
      return reports.map(report => {
        const pTag = report.tags.find(tag => tag[0] === "p");
        const eTag = report.tags.find(tag => tag[0] === "e");
        
        const reportType = pTag && pTag[2] ? pTag[2] : 
                          (eTag && eTag[2] ? eTag[2] : "other");
        
        const reportedPubkey = pTag ? pTag[1] : "";
        const reportedEventId = eTag ? eTag[1] : undefined;
        
        // Check if this report has a resolution event
        const resolution = resolutionMap.get(report.id);
        const isClosed = !!resolution;
        const resolutionAction = resolution?.tags.find(tag => tag[0] === "t")?.[1];
        
        return {
          ...report,
          reportType,
          reportedPubkey,
          reportedEventId,
          reason: report.content,
          isClosed,
          resolutionAction,
          resolutionReason: resolution?.content
        } as Report;
      });
    },
    enabled: !!nostr && !!communityId,
  });
}