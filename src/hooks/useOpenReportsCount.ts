import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { KINDS } from "@/lib/nostr-kinds";

export function useOpenReportsCount(communityId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ["open-reports-count", communityId],
    queryFn: async (c) => {
      if (!communityId) return 0;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Query for reports that have the community's a-tag
      const reports = await nostr.query([{
        kinds: [KINDS.REPORT],
        "#a": [communityId],
        limit: 100,
      }], { signal });

      if (reports.length === 0) return 0;

      // Query for resolution events (Kind 4554) that reference reports
      const reportIds = reports.map(report => report.id);
      const resolutionEvents = await nostr.query([{
        kinds: [KINDS.GROUP_CLOSE_REPORT],
        "#e": reportIds,
        "#a": [communityId],
      }], { signal });

      // Create a set of resolved report IDs
      const resolvedReportIds = new Set();
      for (const resolution of resolutionEvents) {
        const reportId = resolution.tags.find(tag => tag[0] === "e")?.[1];
        if (reportId) {
          resolvedReportIds.add(reportId);
        }
      }

      // Count reports that don't have a resolution event
      const openReportsCount = reports.filter(report => !resolvedReportIds.has(report.id)).length;
      
      return openReportsCount;
    },
    enabled: !!nostr && !!communityId,
    refetchInterval: 30000, // Refetch every 30 seconds to keep the count updated
  });
}