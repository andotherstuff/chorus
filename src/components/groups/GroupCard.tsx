import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pin, PinOff, MessageSquare, Activity, MoreVertical, UserPlus, AlertTriangle, Globe, Lock, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/groups/RoleBadge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Group } from "@/types/groups";
import type { UserRole } from "@/hooks/useUserRole";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOpenReportsCount } from "@/hooks/useOpenReportsCount";
import { usePendingJoinRequests } from "@/hooks/usePendingJoinRequests";
import { toast } from "sonner";
import { getCommunityId, createGroupRouteId } from "@/lib/group-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { JoinRequestMenuItem } from "@/components/groups/JoinRequestMenuItem";
import { useReliableGroupMembership } from "@/hooks/useReliableGroupMembership";

interface GroupCardProps {
  community: Group;
  isPinned: boolean;
  pinGroup: (communityId: string) => void;
  unpinGroup: (communityId: string) => void;
  isUpdating: boolean;
  isMember?: boolean;
  userRole?: UserRole;
  hasPendingRequest?: boolean;
  stats?: {
    posts: number;
    participants: Set<string>;
  };
  isLoadingStats?: boolean;
}

export function GroupCard({
  community,
  isPinned,
  pinGroup,
  unpinGroup,
  isUpdating,
  isMember,
  userRole,
  hasPendingRequest,
  stats,
  isLoadingStats,
}: GroupCardProps) {
  const { user } = useCurrentUser();

  // Extract community data from the Group interface
  const name = community.name || "Unnamed Group";
  const description = community.description || "No description available";
  const image = community.image;
  const communityId = getCommunityId(community);
  const routeId = createGroupRouteId(community);

  // Use the reliable membership hook to determine the user's role if not passed directly
  const { data: membership } = useReliableGroupMembership(
    user != null && userRole === undefined && community.type === "nip72" ? communityId : undefined
  );

  // Check if user is owner or moderator
  const isOwnerOrModerator = userRole === "owner" || userRole === "moderator";

  // Get pending reports and join requests counts for owners/moderators (only for NIP-72)
  const { data: openReportsCount = 0 } = useOpenReportsCount(
    isOwnerOrModerator && community.type === "nip72" ? communityId : ""
  );
  const { pendingRequestsCount = 0 } = usePendingJoinRequests(
    isOwnerOrModerator && community.type === "nip72" ? communityId : ""
  );

  // Determine role from props or from membership data
  const displayRole = userRole ??
    (membership?.isOwner ? "owner" :
    membership?.isModerator ? "moderator" :
    membership?.isMember ? "member" :
    null);

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!user) {
      toast.error("Please log in to pin groups");
      return;
    }

    if (isUpdating) return;

    if (isPinned) {
      unpinGroup(communityId);
    } else {
      pinGroup(communityId);
    }
  };

  const displayParticipants = stats?.participants.size || 0;
  const displayPosts = stats?.posts || 0;

  // Show notification indicators for owners/moderators (only for NIP-72)
  const showReportsIndicator = community.type === "nip72" && openReportsCount > 0;
  const showJoinRequestsIndicator = community.type === "nip72" && pendingRequestsCount > 0;

  // Determine if user is a member or owner of this group
  const isUserMember = isMember ?? Boolean(userRole);

  // Style adjustments based on membership and group type
  const cardStyle = cn(
    "overflow-hidden flex flex-col relative group h-full transition-colors hover:bg-accent/5",
    isPinned && "ring-1 ring-primary/20",
    isUserMember && "bg-primary/5", // Subtle highlight for groups the user is a member of
    hasPendingRequest && !isUserMember && "bg-gray-50/50" // Different background for pending requests
  );

  return (
    <Card className={cardStyle}>
      <Link to={`/group/${routeId}`} className="flex-1 flex flex-col">
        {/* Role badge for user's groups */}
        {displayRole && (
          <div className="absolute top-2 right-10 z-10">
            <RoleBadge role={displayRole} />
          </div>
        )}

        {/* Pending request badge */}
        {hasPendingRequest && !displayRole && (
          <div className="absolute top-2 right-10 z-10">
            <div className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
              <Clock className="h-3 w-3" />
              <span>Pending</span>
            </div>
          </div>
        )}

        {/* Notification badges for owners/moderators */}
        {isOwnerOrModerator && (openReportsCount > 0 || pendingRequestsCount > 0) && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute bottom-2 right-2 z-10 flex gap-1">
                  {openReportsCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="h-6 w-auto px-1.5 py-0 flex items-center justify-center text-xs gap-1"
                    >
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {openReportsCount > 99 ? '99+' : openReportsCount}
                    </Badge>
                  )}
                  {pendingRequestsCount > 0 && (
                    <Badge 
                      className="h-6 w-auto px-1.5 py-0 flex items-center justify-center text-xs gap-1 bg-blue-500 hover:bg-blue-600"
                    >
                      <UserPlus className="h-2.5 w-2.5" />
                      {pendingRequestsCount > 99 ? '99+' : pendingRequestsCount}
                    </Badge>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {openReportsCount > 0 && `${openReportsCount} open report${openReportsCount !== 1 ? 's' : ''}`}
                  {openReportsCount > 0 && pendingRequestsCount > 0 && ', '}
                  {pendingRequestsCount > 0 && `${pendingRequestsCount} join request${pendingRequestsCount !== 1 ? 's' : ''}`}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={image} alt={name} />
                  <AvatarFallback className="bg-muted">
                    {community.type === "nip29" ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base leading-tight truncate">
                      {name}
                    </CardTitle>
                    {community.type === "nip29" ? (
                      <Badge variant="secondary" className="text-xs">Private</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Public</Badge>
                    )}
                  </div>
                  {description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              <span>
                {isLoadingStats ? "..." : displayPosts} post{displayPosts !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
              <span>
                {isLoadingStats ? "..." : displayParticipants} participant{displayParticipants !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </CardContent>
      </Link>

      {/* Pin/More actions buttons */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleTogglePin}
                disabled={isUpdating}
                className="h-8 w-8 p-0"
              >
                {isPinned ? (
                  <PinOff className="h-4 w-4 text-primary" />
                ) : (
                  <Pin className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isPinned ? "Unpin group" : "Pin group"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Dropdown menu for additional actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
              {(showReportsIndicator || showJoinRequestsIndicator) && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
            {showJoinRequestsIndicator && (
              <DropdownMenuItem asChild>
                <Link to={`/group/${routeId}/settings`} className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Join Requests ({pendingRequestsCount})
                </Link>
              </DropdownMenuItem>
            )}
            {showReportsIndicator && (
              <DropdownMenuItem asChild>
                <Link to={`/group/${routeId}/settings`} className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Reports ({openReportsCount})
                </Link>
              </DropdownMenuItem>
            )}
            {/* Join request menu item for non-members */}
            {!isUserMember && community.type === "nip72" && (
              <JoinRequestMenuItem communityId={communityId} hasPendingRequest={hasPendingRequest} />
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}