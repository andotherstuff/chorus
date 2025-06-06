import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pin, PinOff, MessageSquare, Activity, MoreVertical, UserPlus, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/groups/RoleBadge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RichText } from "@/components/ui/RichText";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/hooks/useUserRole";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOpenReportsCount } from "@/hooks/useOpenReportsCount";
import { usePendingJoinRequests } from "@/hooks/usePendingJoinRequests";
import { toast } from "sonner";
import type { NostrEvent } from "@jsr/nostrify__nostrify";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { JoinRequestMenuItem } from "@/components/groups/JoinRequestMenuItem";

interface GroupCardProps {
  community: NostrEvent;
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
  const navigate = useNavigate();
  const [preventNavigation, setPreventNavigation] = useState(false);

  // Extract community data from tags
  const nameTag = community.tags.find((tag) => tag[0] === "name");
  const descriptionTag = community.tags.find((tag) => tag[0] === "description");
  const imageTag = community.tags.find((tag) => tag[0] === "image");
  const dTag = community.tags.find((tag) => tag[0] === "d");

  const name = nameTag ? nameTag[1] : dTag ? dTag[1] : "Unnamed Group";
  const description = descriptionTag ? descriptionTag[1] : "No description available";
  const image = imageTag ? imageTag[1] : undefined;
  const communityId = `34550:${community.pubkey}:${dTag ? dTag[1] : ""}`;

  // Check if user is owner or moderator
  const isOwnerOrModerator = userRole === "owner" || userRole === "moderator";

  // Get pending reports and join requests counts for owners/moderators
  const { data: openReportsCount = 0 } = useOpenReportsCount(
    isOwnerOrModerator ? communityId : ""
  );
  const { pendingRequestsCount = 0 } = usePendingJoinRequests(
    isOwnerOrModerator ? communityId : ""
  );

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setPreventNavigation(true);

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
  
  // Handle card click to navigate
  const handleCardClick = (e: React.MouseEvent) => {
    if (preventNavigation) {
      setPreventNavigation(false);
      return;
    }
    
    e.preventDefault();
    navigate(`/group/${encodeURIComponent(communityId)}`);
  };

  return (
    <Card className={cardStyle} onClick={handleCardClick}>
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

      <CardHeader className="flex flex-row items-start space-y-0 gap-3 pt-4 pb-2 px-3">
        <div className="flex-shrink-0">
          <Avatar className="h-12 w-12 rounded-md">
            <AvatarImage src={image} alt={name} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1 min-w-0 pr-6"> {/* Added right padding to make room for menu button */}
          <div className="flex items-start justify-between">
            <CardTitle className="text-sm font-medium leading-tight truncate max-w-[50%]"> {/* Reduced max-width */}
              {name}
            </CardTitle>
            {userRole && (
              <div className="flex-shrink-0">
                <RoleBadge role={userRole} className="ml-auto mr-2" /> {/* Added right margin */}
              </div>
            )}
            {hasPendingRequest && !userRole && (
              <div className="flex-shrink-0">
                <div className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 ml-auto mr-2"> {/* Added right margin */}
                  <Clock className="h-3 w-3" />
                  <span>Pending</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1 text-xs text-muted-foreground mt-1">
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
                  {stats.posts}
                </div>
                <div className="inline-flex items-center py-0.5 px-1.5 bg-muted rounded text-[10px]">
                  <Activity className="h-2.5 w-2.5 mr-0.5" />
                  {stats.participants.size}
                </div>
              </>
            ) : (
              <>
                <div className="inline-flex items-center py-0.5 px-1.5 bg-muted rounded text-[10px]">
                  <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
                  0
                </div>
                <div className="inline-flex items-center py-0.5 px-1.5 bg-muted rounded text-[10px]">
                  <Activity className="h-2.5 w-2.5 mr-0.5" />
                  0
                </div>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3 pt-0">
        <RichText className="line-clamp-2 text-xs">{description}</RichText>
      </CardContent>

      {user && (
        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-2 h-6 w-6 rounded-full bg-background/80 z-20" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreventNavigation(true);
                    }}
                    disabled={isUpdating}
                  >
                    <MoreVertical className="h-3 w-3" />
                    <span className="sr-only">Group options</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                Group options
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent 
            align="end" 
            className="w-40" 
            onClick={(e) => {
              e.stopPropagation();
              setPreventNavigation(true);
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              setPreventNavigation(false);
            }}
          >
            {isPinned ? (
              <DropdownMenuItem onClick={handleTogglePin}>
                <PinOff className="h-4 w-4 mr-2" />
                Unpin group
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={handleTogglePin}>
                <Pin className="h-4 w-4 mr-2" />
                Pin group
              </DropdownMenuItem>
            )}
            {!isUserMember && <JoinRequestMenuItem communityId={communityId} hasPendingRequest={hasPendingRequest} />}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </Card>
  );
}