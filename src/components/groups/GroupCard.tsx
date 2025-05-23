import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pin, PinOff, MessageSquare, Activity, MoreVertical, UserPlus, AlertTriangle, Globe, Lock } from "lucide-react";
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

  return (
    <Card 
      className={cn(
        "transition-colors group",
        isPinned && "border-primary/50 bg-primary/5"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <Link 
            to={`/group/${routeId}`} 
            className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
          >
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
                    <Badge variant="secondary" className="text-xs">Private Group</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Public Community</Badge>
                  )}
                  {displayRole && <RoleBadge role={displayRole} />}
                </div>
                {description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {description}
                  </p>
                )}
              </div>
            </div>
          </Link>
          
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
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

            {(showReportsIndicator || showJoinRequestsIndicator || displayRole === "owner" || displayRole === "moderator") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                    {(showReportsIndicator || showJoinRequestsIndicator) && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
                  {community.type === "nip72" && <JoinRequestMenuItem communityId={communityId} />}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
          {community.type === "nip29" && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs">
                NIP-29
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
