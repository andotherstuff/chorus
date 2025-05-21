import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Pin, PinOff, MessageSquare, Activity } from "lucide-react";
import { RoleBadge } from "@/components/groups/RoleBadge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { NostrEvent } from "@nostrify/nostrify";
import { UserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { useReliableGroupMembership } from "@/hooks/useReliableGroupMembership";

interface MyGroupCardProps {
  community: NostrEvent;
  role: "pinned" | "owner" | "moderator" | "member";
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

export function MyGroupCard({ community, role, isPinned, pinGroup, unpinGroup, isUpdating, stats, isLoadingStats }: MyGroupCardProps) {
  const { user } = useCurrentUser();
  
  if (!user) return null;
  
  // Extract community data from tags
  const nameTag = community.tags.find((tag: string[]) => tag[0] === "name");
  const descriptionTag = community.tags.find((tag: string[]) => tag[0] === "description");
  const imageTag = community.tags.find((tag: string[]) => tag[0] === "image");
  const dTag = community.tags.find((tag: string[]) => tag[0] === "d");
  const moderatorTags = community.tags.filter((tag: string[]) => tag[0] === "p" && tag[3] === "moderator");

  const name = nameTag ? nameTag[1] : (dTag ? dTag[1] : "Unnamed Group");
  const description = descriptionTag ? descriptionTag[1] : "No description available";
  const image = imageTag ? imageTag[1] : "/placeholder-community.jpg"; 
  const communityId = `34550:${community.pubkey}:${dTag ? dTag[1] : ""}`;
  
  // Use the reliable membership hook to determine the user's role
  const { data: membership, isLoading: isMembershipLoading } = useReliableGroupMembership(communityId);
  
  // Determine the actual role based on membership data
  let displayRole: UserRole = null;
  
  if (membership?.isOwner) {
    displayRole = "owner";
  } else if (membership?.isModerator) {
    displayRole = "moderator";
  } else if (membership?.isMember) {
    displayRole = "member";
  }

  const handleTogglePin = (e: React.MouseEvent) => {
    e.preventDefault();
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

  return (
    <Card className={cn(
      "overflow-hidden flex flex-col relative group",
      role === "pinned" && "ring-1 ring-primary/20"
    )}>
      <div className="h-40 overflow-hidden relative">
        {image && (
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://placehold.co/600x400?text=Group";
            }}
          />
        )}
        
        {/* Role indicator badge - only shown if user has a role */}
        {displayRole && (
          <div className="absolute top-2 left-2">
            <RoleBadge role={displayRole} />
          </div>
        )}
      </div>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>
          <span className="flex items-center">
            <Users className="h-4 w-4 mr-1" />
            {moderatorTags.length} moderator{moderatorTags.length !== 1 ? 's' : ''}
          </span>
          <div className="flex flex-wrap gap-2 mt-1">
            {isLoadingStats ? (
              <>
                <div className="inline-flex items-center px-2 py-1 bg-muted rounded-md text-xs opacity-70">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Loading...
                </div>
                <div className="inline-flex items-center px-2 py-1 bg-muted rounded-md text-xs opacity-70">
                  <Activity className="h-3 w-3 mr-1" />
                  Loading...
                </div>
              </>
            ) : stats ? (
              <>
                <div className="inline-flex items-center px-2 py-1 bg-muted rounded-md text-xs">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  {stats.posts} post{stats.posts !== 1 ? 's' : ''}
                </div>
                <div className="inline-flex items-center px-2 py-1 bg-muted rounded-md text-xs">
                  <Activity className="h-3 w-3 mr-1" />
                  {stats.participants.size} participant{stats.participants.size !== 1 ? 's' : ''}
                </div>
              </>
            ) : (
              <>
                <div className="inline-flex items-center px-2 py-1 bg-muted rounded-md text-xs">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  0 posts
                </div>
                <div className="inline-flex items-center px-2 py-1 bg-muted rounded-md text-xs">
                  <Activity className="h-3 w-3 mr-1" />
                  0 participants
                </div>
              </>
            )}
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="line-clamp-3">{description}</p>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full">
          <Link to={`/group/${encodeURIComponent(communityId)}`}>
            View Group
          </Link>
        </Button>
      </CardFooter>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn(
                "absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity",
                isPinned && "opacity-100"
              )}
              onClick={handleTogglePin}
              disabled={isUpdating}
            >
              {isPinned ? (
                <PinOff className="h-4 w-4" />
              ) : (
                <Pin className="h-4 w-4" />
              )}
              <span className="sr-only">{isPinned ? "Unpin group" : "Pin group"}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isPinned ? "Unpin from My Groups" : "Pin to My Groups"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </Card>
  );
}