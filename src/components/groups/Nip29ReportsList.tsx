import { useState } from "react";
import { useEnhancedNostr } from "@/components/EnhancedNostrProvider";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthor } from "@/hooks/useAuthor";
import { toast } from "sonner";
import { Trash2, Eye, MessageSquare, AlertTriangle, CheckCircle, XCircle, Shield } from "lucide-react";
import type { NostrEvent } from "@nostrify/nostrify";
import { Link } from "react-router-dom";

interface Nip29ReportsListProps {
  groupId: string;
  relay: string;
}

export function Nip29ReportsList({ groupId, relay }: Nip29ReportsListProps) {
  const { nostr } = useEnhancedNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  // Query for reports (we'll use kind 1984 with group-specific tags)
  const { data: reports, isLoading: isLoadingReports, refetch: refetchReports } = useQuery({
    queryKey: ["nip29-reports", groupId, relay, filter],
    queryFn: async (c) => {
      if (!nostr) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      console.log(`[NIP-29] Fetching reports for group ${groupId} from ${relay}`);
      
      // Query for reports that reference events in this group
      const events = await nostr.query([{ 
        kinds: [1984], // Report events
        "#h": [groupId], // Group-specific reports (user event)
        limit: 100,
      }], { 
        signal,
        relays: [relay]
      });
      
      console.log(`[NIP-29] Found ${events.length} reports`);
      
      // Filter based on status if needed
      let filteredReports = events;
      if (filter === 'open') {
        filteredReports = events.filter(report => {
          // Check if this report has been resolved (look for resolution events)
          return !report.tags.some(tag => tag[0] === 'status' && tag[1] === 'resolved');
        });
      } else if (filter === 'resolved') {
        filteredReports = events.filter(report => {
          return report.tags.some(tag => tag[0] === 'status' && tag[1] === 'resolved');
        });
      }
      
      return filteredReports.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!nostr && !!groupId && !!relay,
    staleTime: 30000,
  });

  const handleResolveReport = async (reportId: string, action: 'dismiss' | 'remove') => {
    if (!user) {
      toast.error("You must be logged in to handle reports");
      return;
    }

    try {
      console.log(`[NIP-29] ${action === 'dismiss' ? 'Dismissing' : 'Acting on'} report: ${reportId}`);
      
      if (action === 'remove') {
        // For remove action, we need to delete the reported event
        const report = reports?.find(r => r.id === reportId);
        if (report) {
          const reportedEventId = report.tags.find(tag => tag[0] === 'e')?.[1];
          if (reportedEventId) {
            // Create NIP-29 delete event (kind 9005)
            const event = await user!.signer.signEvent({
              kind: 9005, // GROUP_DELETE_EVENT
              tags: [
                ["h", groupId],
                ["e", reportedEventId]
              ],
              content: "Event removed due to report",
              created_at: Math.floor(Date.now() / 1000),
            });
            
            if (!nostr) {
              throw new Error("Nostr client not available");
            }
            
            await nostr.event(event, { relays: [relay] });
          }
        }
      }
      
      // Mark report as resolved
      const event = await user!.signer.signEvent({
        kind: 1984, // Report event
        tags: [
          ["e", reportId],
          ["h", groupId],
          ["status", "resolved"],
          ["action", action],
          ["resolve-reason", action === 'dismiss' ? 'No action needed' : 'Content removed']
        ],
        content: `Report ${action === 'dismiss' ? 'dismissed' : 'resolved with content removal'}`,
        created_at: Math.floor(Date.now() / 1000),
      });
      
      if (!nostr) {
        throw new Error("Nostr client not available");
      }
      
      await nostr.event(event, { relays: [relay] });
      
      toast.success(`Report ${action === 'dismiss' ? 'dismissed' : 'resolved'} successfully!`);
      
      // Refresh reports
      refetchReports();
    } catch (error) {
      console.error("Error resolving report:", error);
      toast.error(`Failed to ${action === 'dismiss' ? 'dismiss' : 'resolve'} report. Please try again.`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter controls */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Reports</h3>
          <p className="text-sm text-muted-foreground">
            Reports from group members about content
          </p>
        </div>
        <Select value={filter} onValueChange={(value: 'all' | 'open' | 'resolved') => setFilter(value)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reports</SelectItem>
            <SelectItem value="open">Open Reports</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reports list */}
      {isLoadingReports ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
              <Skeleton className="h-16 w-full mb-3" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : !reports || reports.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>No reports found</p>
          <p className="text-sm">
            {filter === 'open' ? 'No open reports' : 
             filter === 'resolved' ? 'No resolved reports' : 
             'No reports submitted yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <ReportItem
              key={report.id}
              report={report}
              groupId={groupId}
              relay={relay}
              onResolve={(action) => handleResolveReport(report.id, action)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ReportItemProps {
  report: NostrEvent;
  groupId: string;
  relay: string;
  onResolve: (action: 'dismiss' | 'remove') => void;
}

function ReportItem({ report, groupId, relay, onResolve }: ReportItemProps) {
  const { nostr } = useEnhancedNostr();
  const author = useAuthor(report.pubkey);
  const [showReportedContent, setShowReportedContent] = useState(false);
  const [reportedEvent, setReportedEvent] = useState<NostrEvent | null>(null);
  const [loadingReportedEvent, setLoadingReportedEvent] = useState(false);
  
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || report.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  
  // Extract report details
  const reportedEventId = report.tags.find(tag => tag[0] === 'e')?.[1];
  const reportReason = report.content;
  const reportType = report.tags.find(tag => tag[0] === 'report')?.[1] || 'other';
  const isResolved = report.tags.some(tag => tag[0] === 'status' && tag[1] === 'resolved');
  const resolveAction = report.tags.find(tag => tag[0] === 'action')?.[1];
  
  // Fetch reported event when needed
  const fetchReportedEvent = async () => {
    if (!reportedEventId || !nostr || reportedEvent) return;
    
    setLoadingReportedEvent(true);
    try {
      const signal = AbortSignal.timeout(3000);
      const events = await nostr.query([{
        ids: [reportedEventId]
      }], { 
        signal,
        relays: [relay]
      });
      
      if (events.length > 0) {
        setReportedEvent(events[0]);
      }
    } catch (error) {
      console.error("Error fetching reported event:", error);
    } finally {
      setLoadingReportedEvent(false);
    }
  };

  const handleShowContent = () => {
    setShowReportedContent(true);
    if (!reportedEvent) {
      fetchReportedEvent();
    }
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'spam':
        return <AlertTriangle className="h-4 w-4" />;
      case 'inappropriate':
        return <Eye className="h-4 w-4" />;
      case 'other':
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getReportTypeBadge = (type: string) => {
    const colors = {
      spam: 'bg-red-100 text-red-600',
      inappropriate: 'bg-orange-100 text-orange-600',
      other: 'bg-gray-100 text-gray-600'
    };
    
    return (
      <Badge className={`${colors[type as keyof typeof colors] || colors.other} text-xs`}>
        {getReportTypeIcon(type)}
        <span className="ml-1 capitalize">{type}</span>
      </Badge>
    );
  };

  return (
    <div className={`border rounded-lg p-4 ${isResolved ? 'bg-muted/50' : ''}`}>
      {/* Report header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${report.pubkey}`}>
            <Avatar>
              <AvatarImage src={profileImage} />
              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>
          <div>
            <Link to={`/profile/${report.pubkey}`} className="font-medium hover:underline">
              {displayName}
            </Link>
            <p className="text-xs text-muted-foreground">
              {new Date(report.created_at * 1000).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getReportTypeBadge(reportType)}
          {isResolved && (
            <Badge className="bg-green-100 text-green-600 text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              {resolveAction === 'dismiss' ? 'Dismissed' : 'Removed'}
            </Badge>
          )}
        </div>
      </div>

      {/* Report reason */}
      {reportReason && (
        <div className="mb-3 p-3 bg-muted rounded-md">
          <p className="text-sm font-medium mb-1">Report Reason:</p>
          <p className="text-sm">{reportReason}</p>
        </div>
      )}

      {/* Reported content section */}
      {reportedEventId && (
        <div className="mb-3">
          {!showReportedContent ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleShowContent}
              className="text-xs"
            >
              <Eye className="h-3 w-3 mr-1" />
              Show Reported Content
            </Button>
          ) : (
            <div className="border rounded-md p-3 bg-red-50">
              <p className="text-xs font-medium text-red-600 mb-2">Reported Content:</p>
              {loadingReportedEvent ? (
                <Skeleton className="h-16 w-full" />
              ) : reportedEvent ? (
                <ReportedEventContent event={reportedEvent} />
              ) : (
                <p className="text-xs text-muted-foreground">Content not found or deleted</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {!isResolved && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onResolve('dismiss')}
            className="text-green-600"
          >
            <XCircle className="h-4 w-4 mr-1" />
            Dismiss
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onResolve('remove')}
            className="text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Remove Content
          </Button>
        </div>
      )}
    </div>
  );
}

function ReportedEventContent({ event }: { event: NostrEvent }) {
  const author = useAuthor(event.pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || event.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          <AvatarImage src={profileImage} />
          <AvatarFallback className="text-xs">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <Link to={`/profile/${event.pubkey}`} className="text-xs font-medium hover:underline">
          {displayName}
        </Link>
        <span className="text-xs text-muted-foreground">
          {new Date(event.created_at * 1000).toLocaleString()}
        </span>
      </div>
      <div className="text-sm bg-white border rounded p-2 max-h-32 overflow-y-auto">
        {event.content || <span className="text-muted-foreground italic">No content</span>}
      </div>
    </div>
  );
}