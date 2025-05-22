import React, { useState, useEffect, useRef } from "react";
import { useGroupReports, Report } from "@/hooks/useGroupReports";
import { useReportActions, ModeratorAction } from "@/hooks/useReportActions";
import { useAuthor } from "@/hooks/useAuthor";
import { usePostById } from "@/hooks/usePostById";
import { useApprovedMembers } from "@/hooks/useApprovedMembers";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle, XCircle, UserX, Ban, MoreHorizontal, User, Inbox as InboxIcon, Archive as ArchiveIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ReportsListProps {
  communityId: string;
}

export function ReportsList({ communityId }: ReportsListProps) {
  const location = useLocation();
  const { data: reports, isLoading, refetch } = useGroupReports(communityId);
  const { handleReportAction, isPending } = useReportActions();
  const { approvedMembers, isLoading: isLoadingApprovedMembers } = useApprovedMembers(communityId);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [actionType, setActionType] = useState<ModeratorAction | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("open");
  
  // Reference to the highlighted report element
  const highlightedReportRef = useRef<HTMLDivElement>(null);
  
  // Check URL parameters for reportId
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const reportId = searchParams.get('reportId');
    
    if (reportId && reports) {
      // Find the report with the matching ID
      const report = reports.find(r => r.id === reportId);
      
      if (report) {
        // Set the active tab based on whether the report is closed or open
        setActiveTab(report.isClosed ? "closed" : "open");
        
        // Set this report as selected to highlight it
        setSelectedReport(report);
        
        // Scroll to the report after rendering
        setTimeout(() => {
          if (highlightedReportRef.current) {
            highlightedReportRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  }, [reports, location.search]);

  const handleAction = async () => {
    if (!selectedReport || !actionType) return;

    try {
      await handleReportAction({
        reportId: selectedReport.id,
        communityId,
        pubkey: selectedReport.reportedPubkey,
        eventId: selectedReport.reportedEventId,
        action: actionType,
        reason: actionReason,
      });
      
      // Reset state and close dialog
      setSelectedReport(null);
      setActionType(null);
      setActionReason("");
      setIsDialogOpen(false);
      
      // Refresh the reports list
      refetch();
    } catch (error) {
      // Error is handled in the hook
    }
  };

  const openActionDialog = (report: Report, action: ModeratorAction) => {
    setSelectedReport(report);
    setActionType(action);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-24" />
            </CardHeader>
            <CardContent className="pb-2">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
            <CardFooter>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
        <p className="text-muted-foreground mb-2">No reports in this group</p>
        <p className="text-sm">When users report content, it will appear here for review.</p>
      </Card>
    );
  }

  // Separate reports into open and closed
  const openReports = reports.filter(report => !report.isClosed);
  const closedReports = reports.filter(report => report.isClosed);

  // Count for badges
  const openCount = openReports.length;
  const closedCount = closedReports.length;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="open" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="open" className="flex items-center gap-2">
            <InboxIcon className="h-4 w-4" /> 
            Open
            {openCount > 0 && (
              <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                {openCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="closed" className="flex items-center gap-2">
            <ArchiveIcon className="h-4 w-4" /> 
            Closed
            {closedCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {closedCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="open" className="space-y-4">
          {openReports.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
              <p className="text-muted-foreground mb-2">No open reports</p>
              <p className="text-sm">All reports have been handled. Great job!</p>
            </Card>
          ) : (
            openReports.map((report) => (
              <ReportItem 
                key={report.id} 
                report={report} 
                onAction={(action) => openActionDialog(report, action)}
                isHighlighted={selectedReport?.id === report.id}
                ref={selectedReport?.id === report.id ? highlightedReportRef : undefined}
              />
            ))
          )}
        </TabsContent>
        
        <TabsContent value="closed" className="space-y-4">
          {closedReports.length === 0 ? (
            <Card className="p-8 text-center">
              <ArchiveIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-2">No closed reports</p>
              <p className="text-sm">Closed reports will appear here after you take action on them.</p>
            </Card>
          ) : (
            closedReports.map((report) => (
              <ReportItem 
                key={report.id} 
                report={report} 
                onAction={(action) => openActionDialog(report, action)}
                isHighlighted={selectedReport?.id === report.id}
                ref={selectedReport?.id === report.id ? highlightedReportRef : undefined}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "remove_content" && "Remove Content"}
              {actionType === "remove_user" && "Remove User"}
              {actionType === "ban_user" && "Ban User"}
              {actionType === "no_action" && "Take No Action"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "remove_content" && 
                "This will remove the reported content from the group. The content will no longer be visible to members."}
              {actionType === "remove_user" && 
                "This will remove the user from the approved members list. They will need to request to join again."}
              {actionType === "ban_user" && 
                "This will ban the user from the group. All their content will be hidden and they won't be able to post."}
              {actionType === "no_action" && 
                "This will mark the report as reviewed with no action taken. The report will be archived."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {selectedReport?.reportedEventId && actionType === "remove_content" && (
            <div className="border border-muted rounded-md p-3 bg-muted/20 my-2">
              <p className="text-sm font-medium mb-1">Content to be removed:</p>
              <PostContentPreview eventId={selectedReport.reportedEventId} />
              <div className="mt-2 text-xs text-muted-foreground">
                <p>This will create a kind 4551 removal event that will hide this content from the community.</p>
                <p className="mt-1">Post ID: <code className="bg-muted px-1 py-0.5 rounded">{selectedReport.reportedEventId.slice(0, 8)}...{selectedReport.reportedEventId.slice(-4)}</code></p>
                <p>Author: <code className="bg-muted px-1 py-0.5 rounded">{selectedReport.reportedPubkey.slice(0, 8)}...{selectedReport.reportedPubkey.slice(-4)}</code></p>
              </div>
            </div>
          )}
          
          {selectedReport && actionType === "remove_user" && (
            <div className="border border-muted rounded-md p-3 bg-muted/20 my-2">
              <p className="text-sm font-medium mb-1">User to be removed:</p>
              <div className="flex items-center gap-2 my-2">
                <UserAvatar pubkey={selectedReport.reportedPubkey} />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                <p>This will update the Kind 14550 approved members list to remove this user.</p>
                {isLoadingApprovedMembers ? (
                  <p className="mt-1 italic">Checking membership status...</p>
                ) : approvedMembers?.includes(selectedReport.reportedPubkey) ? (
                  <p className="mt-1">User is currently in the approved members list.</p>
                ) : (
                  <p className="mt-1 text-amber-600 font-medium">Warning: This user is not currently in the approved members list. No action will be taken.</p>
                )}
                <p className="mt-1">User ID: <code className="bg-muted px-1 py-0.5 rounded">{selectedReport.reportedPubkey.slice(0, 8)}...{selectedReport.reportedPubkey.slice(-4)}</code></p>
              </div>
            </div>
          )}
          
          <div className="py-2">
            <Label htmlFor="action-reason">Reason (optional)</Label>
            <Textarea
              id="action-reason"
              placeholder="Add a reason for this action..."
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              className="mt-2"
            />
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleAction} 
              disabled={isPending}
              className={actionType === "ban_user" || actionType === "remove_content" ? 
                "bg-red-600 hover:bg-red-700" : undefined}
            >
              {isPending ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface PostContentPreviewProps {
  eventId: string;
}

function PostContentPreview({ eventId }: PostContentPreviewProps) {
  const { data: post, isLoading } = usePostById(eventId);
  
  if (isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }
  
  if (!post) {
    return <p className="text-sm text-muted-foreground italic">Content not found or has been deleted</p>;
  }
  
  return (
    <div className="text-sm whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
      {post.content}
    </div>
  );
}

interface UserAvatarProps {
  pubkey: string;
}

function UserAvatar({ pubkey }: UserAvatarProps) {
  const author = useAuthor(pubkey);
  const displayName = author.data?.metadata?.name || pubkey.slice(0, 8);
  const profileImage = author.data?.metadata?.picture;
  
  if (author.isLoading) {
    return <Skeleton className="h-10 w-10 rounded-full" />;
  }
  
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-10 w-10">
        <AvatarImage src={profileImage} />
        <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div>
        <Link to={`/profile/${pubkey}`} className="font-medium text-sm hover:underline">
          {displayName}
        </Link>
        <p className="text-xs text-muted-foreground">{pubkey.slice(0, 8)}...{pubkey.slice(-4)}</p>
      </div>
    </div>
  );
}

interface ReportItemProps {
  report: Report;
  onAction: (action: ModeratorAction) => void;
  isHighlighted?: boolean;
}

const ReportItem = React.forwardRef<HTMLDivElement, ReportItemProps>(
  ({ report, onAction, isHighlighted = false }, ref) => {
    const reporterAuthor = useAuthor(report.pubkey);
    const reportedAuthor = useAuthor(report.reportedPubkey);
    const { data: reportedPost, isLoading: isLoadingPost } = usePostById(report.reportedEventId);
    
    const reporterName = reporterAuthor.data?.metadata?.name || report.pubkey.slice(0, 8);
    const reporterImage = reporterAuthor.data?.metadata?.picture;
    
    const reportedName = reportedAuthor.data?.metadata?.name || report.reportedPubkey.slice(0, 8);
    const reportedImage = reportedAuthor.data?.metadata?.picture;
    
    const reportTime = formatDistanceToNow(new Date(report.created_at * 1000), { addSuffix: true });

    return (
      <Card 
        ref={ref}
        className={isHighlighted ? "ring-2 ring-primary ring-offset-2" : ""}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>
              Reported by <Link to={`/profile/${report.pubkey}`} className="underline">{reporterName}</Link>
            </CardDescription>
            <span className="text-xs text-muted-foreground">{reportTime}</span>
          </div>
        </CardHeader>
        
        <CardContent className="pb-2">
          <div className="flex items-center gap-3 mb-3 p-2 bg-muted/50 rounded-md">
            <Link to={`/profile/${report.reportedPubkey}`}>
              <Avatar className="h-8 w-8">
                <AvatarImage src={reportedImage} />
                <AvatarFallback>{reportedName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </Link>
            <div>
              <Link to={`/profile/${report.reportedPubkey}`} className="font-medium text-sm hover:underline">
                {reportedName}
              </Link>
              <p className="text-xs text-muted-foreground">Reported user</p>
            </div>
          </div>
          
          {report.reason && (
            <div className="mb-3">
              <p className="text-sm font-medium mb-1">Report reason:</p>
              <p className="text-sm bg-muted/30 p-2 rounded-md">{report.reason}</p>
            </div>
          )}
          
          {report.isClosed && (
            <div className="mb-3 border border-muted p-2 rounded-md bg-muted/20">
              <p className="text-sm font-medium mb-1 flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-500" /> 
                Resolution: <span className="font-normal">{report.resolutionAction}</span>
              </p>
              {report.resolutionReason && (
                <p className="text-sm mt-1">{report.resolutionReason}</p>
              )}
            </div>
          )}
          
          {report.reportedEventId && (
            <>
              {isLoadingPost ? (
                <div className="my-3">
                  <Skeleton className="h-20 w-full rounded-md" />
                </div>
              ) : reportedPost ? (
                <div className="my-3 border border-muted rounded-md p-3 bg-muted/20">
                  <p className="text-sm font-medium mb-1">Reported content:</p>
                  <div className="text-sm whitespace-pre-wrap break-words">{reportedPost.content}</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span>Posted: {formatDistanceToNow(new Date(reportedPost.created_at * 1000), { addSuffix: true })}</span>
                  </div>
                </div>
              ) : (
                <div className="my-3 border border-muted rounded-md p-3 bg-muted/20">
                  <p className="text-sm text-muted-foreground italic">Content not found or has been deleted</p>
                </div>
              )}
            </>
          )}
        </CardContent>
        
        <CardFooter className="pt-2 flex flex-wrap gap-2">
          {!report.isClosed ? (
            <>
              <Button 
                size="sm" 
                variant="outline" 
                className="text-green-600" 
                onClick={() => onAction("no_action")}
              >
                <CheckCircle className="h-4 w-4 mr-1" /> No Action
              </Button>
              
              {report.reportedEventId && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-amber-600" 
                  onClick={() => onAction("remove_content")}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Remove Content
                </Button>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <MoreHorizontal className="h-4 w-4 mr-1" /> More Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onAction("remove_user")}>
                    <UserX className="h-4 w-4 mr-2" /> Remove User
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onAction("ban_user")}
                    className="text-red-600"
                  >
                    <Ban className="h-4 w-4 mr-2" /> Ban User
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">This report has been resolved.</p>
          )}
        </CardFooter>
      </Card>
    );
  }
);

ReportItem.displayName = "ReportItem";