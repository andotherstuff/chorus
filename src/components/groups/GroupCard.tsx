import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pin, PinOff, MessageSquare, Activity, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/groups/RoleBadge";
import { useUserRole } from "@/hooks/useUserRole";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { NostrEvent } from "@nostrify/nostrify";
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
  stats?: {
    posts: number;
    participants: Set<string>;
  };
  isLoadingStats?: boolean;
}

export function GroupCard({ community, isPinned, pinGroup, unpinGroup, isUpdating, stats, isLoadingStats }: GroupCardProps) {
  const { user } = useCurrentUser();

  // Extract community data from tags
  const nameTag = community.tags.find(tag => tag[0] === "name");
  const descriptionTag = community.tags.find(tag => tag[0] === "description");
  const imageTag = community.tags.find(tag => tag[0] === "image");
  const dTag = community.tags.find(tag => tag[0] === "d");

  const name = nameTag ? nameTag[1] : (dTag ? dTag[1] : "Unnamed Group");
  const description = descriptionTag ? descriptionTag[1] : "No description available";
  const image = imageTag ? imageTag[1] : "/placeholder-community.svg";
  const communityId = `34550:${community.pubkey}:${dTag ? dTag[1] : ""}`;

  // Determine user's role in this group if logged in
  const { data: userRole, isLoading: isRoleLoading } = useUserRole(communityId);

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <Card
      className={cn(
        "overflow-hidden flex flex-col relative group h-full",
        isPinned && "ring-1 ring-primary/20"
      )}
    >
      {userRole && (
        <div className="absolute top-2 right-10 z-10">
          <RoleBadge role={userRole} />
        </div>
      )}

      <CardHeader className="flex flex-row items-center space-y-0 gap-3 pt-4 pb-2 px-3">
        <Link to={`/group/${encodeURIComponent(communityId)}`} className="flex items-center gap-3">
          <Avatar className="h-12 w-12 rounded-md">
            <AvatarImage src={image} alt={name} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <CardTitle className="text-sm font-medium leading-tight hover:underline">{name}</CardTitle>
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
        </Link>
      </CardHeader>
      
      <CardContent className="px-3 pb-3 pt-0">
        <div className="line-clamp-2 text-xs">{description}</div>
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
                    className="absolute top-2 right-2 h-6 w-6 rounded-full bg-background/80"
                    onClick={(e) => e.stopPropagation()}
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
          <DropdownMenuContent align="end" className="w-40">
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
            {!isRoleLoading && !userRole && <JoinRequestMenuItem communityId={communityId} />}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </Card>
  );
}