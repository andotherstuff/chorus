import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pin, PinOff, MessageSquare, Activity, MoreVertical, UserPlus, AlertTriangle, Globe, Lock, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/groups/RoleBadge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RichText } from "@/components/ui/RichText";
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
  // Generate the correct URL based on group type  
  const getGroupUrl = (community: Group): string => {
    if (community.type === "nip29") {
      // For NIP-29 groups, use the new route format
      return `/group/nip29/${encodeURIComponent(community.relay)}/${encodeURIComponent(community.groupId)}`;
    } else {
      // For NIP-72 groups, use the traditional route format  
      const routeId = createGroupRouteId(community);
      return `/group/${routeId}`;
    }
  };

  const groupUrl = getGroupUrl(community);

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
      toast.error("Please log in to pin/unpin groups.");
      return;
    }

    if (isPinned) {
      unpinGroup(communityId);
    } else {
      pinGroup(communityId);
    }
  };

  // Get the first letter of the group name for avatar fallback
  const getInitials = () => {
    if (community.type === "nip29") return "";
    return name.charAt(0).toUpperCase();
  };

  // Determine if user is a member or owner of this group
  const isUserMember = isMember ?? Boolean(userRole);

  // Style adjustments based on membership
  const cardStyle = cn(
    "overflow-hidden flex flex-col relative group h-full transition-colors hover:bg-accent/5 cursor-pointer",
    isPinned && "ring-1 ring-primary/20",
    isUserMember && "bg-primary/5", // Subtle highlight for groups the user is a member of
    hasPendingRequest && !isUserMember && "bg-gray-50/50" // Different background for pending requests
  );

  const displayParticipants = stats?.participants.size || 0;
  const displayPosts = stats?.posts || 0;

  return (
    <Link to={groupUrl}>
      <Card className={cardStyle}>
        {displayRole && (
          <div className="absolute top-2 right-10 z-10">
            <RoleBadge role={displayRole} />
          </div>
        )}

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
                <div className="text-sm">
                  {openReportsCount > 0 && (
                    <div className="text-red-400">
                      {openReportsCount} open report{openReportsCount !== 1 ? 's' : ''}
                    </div>
                  )}
                  {pendingRequestsCount > 0 && (
                    <div className="text-blue-400">
                      {pendingRequestsCount} pending join request{pendingRequestsCount !== 1 ? 's' : ''}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    Click to manage group
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <CardHeader className="flex flex-row items-center space-y-0 gap-3 pt-4 pb-2 px-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 rounded-md">
              <AvatarImage src={image} alt={name} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {community.type === "nip29" ? <Lock className="h-5 w-5" /> : getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <CardTitle className="text-sm font-medium leading-tight">{name}</CardTitle>
              <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                {isLoadingStats ? (
                  <>
                    <div className="inline-flex items-center py-0.5 px-1.5 bg-muted rounded text-[10px] opacity-70">
                      <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
                      ...
                    </div>
                    <div className="inline-flex items-center py-0.5 px-1.5 bg-muted rounded text-[10px] opacity-70">
                      <Activity className="h-2.5 w-2.5 mr-0.5" />
                      ...
                    </div>
                  </>
                ) : stats ? (
                  <>
                    <div className="inline-flex items-center py-0.5 px-1.5 bg-muted rounded text-[10px]">
                      <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
                      {displayPosts}
                    </div>
                    <div className="inline-flex items-center py-0.5 px-1.5 bg-muted rounded text-[10px]">
                      <Activity className="h-2.5 w-2.5 mr-0.5" />
                      {displayParticipants}
                    </div>
                  </>
                ) : null}
                {community.type === "nip29" && (
                  <div className="inline-flex items-center py-0.5 px-1.5 bg-secondary rounded text-[10px]">
                    <Lock className="h-2.5 w-2.5 mr-0.5" />
                    Private
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-3 pb-3 pt-0">
          <RichText className="line-clamp-2 text-xs">{description}</RichText>
        </CardContent>

        {/* Pin/More menu buttons - positioned absolute */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          {isPinned ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleTogglePin}
                    disabled={isUpdating}
                  >
                    <PinOff className="h-3.5 w-3.5 text-primary" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Unpin group</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={handleTogglePin}>
                  <Pin className="h-4 w-4 mr-2" />
                  Pin group
                </DropdownMenuItem>
                {!isUserMember && community.type === "nip72" && (
                  <JoinRequestMenuItem communityId={communityId} hasPendingRequest={hasPendingRequest} />
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </Card>
    </Link>
  );
}