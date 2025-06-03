import { useNostr } from "@/hooks/useNostr";
import { useEnhancedNostr } from "@/components/EnhancedNostrProvider";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthor } from "@/hooks/useAuthor";
import { useApprovedMembers } from "@/hooks/useApprovedMembers";
import { DollarSign, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { parseNostrAddress } from "@/lib/nostr-utils";
import { parseGroupRouteId as parseGroupId } from "@/lib/group-utils";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { UserNutzapDialog } from "./UserNutzapDialog";
import { KINDS } from "@/lib/nostr-kinds";
import { useNip29GroupMembers } from "@/hooks/useNip29Groups";
import { useGroupPosters } from "@/hooks/useGroupPosters";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { RefreshCw } from "lucide-react";

interface SimpleMembersListProps {
  communityId: string;
  groupData?: any; // Optional: pass the already-fetched group data to ensure consistency
}

export function SimpleMembersList({ communityId, groupData }: SimpleMembersListProps) {
  const { nostr } = useNostr();
  const { nostr: enhancedNostr } = useEnhancedNostr();
  const { user } = useCurrentUser();
  const [showAllMembers, setShowAllMembers] = useState(false);
  
  // Parse the group ID to determine type
  const parsedGroup = parseGroupId(decodeURIComponent(communityId));
  const isNip29 = parsedGroup?.type === "nip29";
  
  // For NIP-72, parse the community ID to get the community details
  const parsedId = !isNip29 ? parseNostrAddress(decodeURIComponent(communityId)) : null;
  
  // Query for community details to get moderators
  // If groupData is passed from parent, use it to ensure consistency
  const { data: queriedCommunity, refetch: refetchCommunity } = useQuery({
    queryKey: ["community-simple", parsedId?.pubkey, parsedId?.identifier],
    queryFn: async (c) => {
      if (!parsedId) throw new Error("Invalid community ID");

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{
        kinds: [KINDS.GROUP],
        authors: [parsedId.pubkey],
        "#d": [parsedId.identifier]
      }], { signal });

      if (events.length === 0) throw new Error("Community not found");
      return events[0];
    },
    enabled: !!nostr && !!parsedId && !groupData, // Don't query if we already have groupData
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
  
  // For NIP-72 groups, we need the raw event with tags, not the parsed group
  // If groupData is passed and is NIP-72, we need to reconstruct the event format
  const community = !isNip29 ? queriedCommunity : null;
  
  // Get NIP-29 members if this is a NIP-29 group
  const { data: nip29MemberData } = useNip29GroupMembers(
    isNip29 ? parsedGroup.groupId : undefined,
    isNip29 ? parsedGroup.relay : undefined
  );

  // Get approved members using the centralized hook (for NIP-72)
  const { approvedMembers, isLoading: isLoadingNip72 } = useApprovedMembers(
    !isNip29 ? communityId : ''
  );
  
  // Get active posters as a fallback for NIP-72 groups without approved members
  const { data: activePosters = [], isLoading: isLoadingPosters } = useGroupPosters(
    !isNip29 && approvedMembers.length === 0 ? communityId : ''
  );

  // Combine member lists based on group type
  // For NIP-72: Use approved members if available, otherwise use active posters
  const allMembers = isNip29 
    ? (nip29MemberData?.members || [])
    : (approvedMembers.length > 0 ? approvedMembers : activePosters);
  
  const isLoading = isNip29 ? !nip29MemberData : (isLoadingNip72 || isLoadingPosters);

  console.log("[SimpleMembersList] Displaying members:", {
    communityId,
    isNip29,
    totalMembers: allMembers.length,
    isLoading,
    approvedMembers: approvedMembers.slice(0, 5),
    activePosters: activePosters.slice(0, 5),
    nip29Members: nip29MemberData?.members?.slice(0, 5),
    usingActivePosters: !isNip29 && approvedMembers.length === 0 && activePosters.length > 0
  });

  // Get moderators/admins based on group type
  const moderatorTags = isNip29
    ? (nip29MemberData?.admins || []).map(pubkey => ["p", pubkey, "", "admin"])
    : community?.tags.filter(tag => tag[0] === "p" && tag[3] === "moderator") || [];
  const moderators = moderatorTags.map(tag => tag[1]);
  
  // Debug logging for moderator tags
  console.log("[SimpleMembersList] Moderator extraction:", {
    communityId,
    isNip29,
    currentUserPubkey: user?.pubkey,
    communityPubkey: community?.pubkey,
    allTags: community?.tags,
    moderatorTags,
    moderators,
    pTagsWithModerator: community?.tags?.filter(tag => tag[0] === "p" && tag.length > 3),
    isCurrentUserInModeratorTags: moderators.includes(user?.pubkey || ''),
    isCurrentUserOwner: community?.pubkey === user?.pubkey,
  });
  
  // Check if we need to manually add the current user to moderator display
  // This helps debug cases where the moderator tag might be missing but the user is marked as moderator elsewhere
  useEffect(() => {
    if (user && community && !isNip29) {
      const userModeratorTag = community.tags?.find(
        tag => tag[0] === "p" && tag[1] === user.pubkey && tag[3] === "moderator"
      );
      if (!userModeratorTag) {
        console.log("[SimpleMembersList] Current user NOT found in moderator tags despite being marked as moderator");
      }
    }
  }, [user, community, isNip29]);
  
  // Filter out owner and moderators from members to show only regular members
  const regularMembers = allMembers.filter(member => 
    member !== community?.pubkey && !moderators.includes(member)
  );

  // Remove duplicates from regular members
  const uniqueRegularMembers = [...new Set(regularMembers)];
  
  // Determine how many members to show
  const membersToShow = showAllMembers ? uniqueRegularMembers : uniqueRegularMembers.slice(0, 10);
  const remainingCount = uniqueRegularMembers.length - 10;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="px-4 py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Group Owner & Moderators
            </CardTitle>
            {!isNip29 && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => refetchCommunity()}
                title="Refresh moderator list"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-3 pt-0 pb-3">
          <div className="space-y-1">
            {community && <ModeratorItem key={community.pubkey} pubkey={community.pubkey} isCreator />}
            {moderatorTags
              .filter(tag => tag[1] !== community?.pubkey)
              .map((tag) => (
                <ModeratorItem key={tag[1]} pubkey={tag[1]} />
              ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-lg flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Members ({uniqueRegularMembers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pt-0 pb-3">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : uniqueRegularMembers.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <p>No approved members yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {membersToShow.map((pubkey) => (
                <MemberItem key={pubkey} pubkey={pubkey} />
              ))}
              {!showAllMembers && remainingCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-sm text-muted-foreground hover:text-foreground mt-2"
                  onClick={() => setShowAllMembers(true)}
                >
                  + {remainingCount} more members
                </Button>
              )}
              {showAllMembers && uniqueRegularMembers.length > 10 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-sm text-muted-foreground hover:text-foreground mt-2"
                  onClick={() => setShowAllMembers(false)}
                >
                  Show less
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModeratorItem({ pubkey, isCreator = false }: { pubkey: string; isCreator?: boolean }) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const [nutzapOpen, setNutzapOpen] = useState(false);

  const displayName = metadata?.name || pubkey.slice(0, 8);
  const profileImage = metadata?.picture;

  return (
    <div className="flex items-center justify-between p-1.5 rounded-md hover:bg-muted transition-colors">
      <Link to={`/profile/${pubkey}`} className="flex items-center gap-3">
        <Avatar className="rounded-md h-9 w-9">
          <AvatarImage src={profileImage} />
          <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium leading-tight">{displayName}</p>
          {isCreator ? (
            <span className="text-xs bg-purple-100 text-purple-600 rounded-full px-2 py-0.5">
              Group Owner
            </span>
          ) : (
            <span className="text-xs bg-blue-100 text-blue-600 rounded-full px-2 py-0.5">
              Moderator
            </span>
          )}
        </div>
      </Link>
      
      <Button 
        variant="outline" 
        size="sm" 
        className="text-xs py-1 px-2 h-auto"
        onClick={(e) => {
          e.stopPropagation();
          setNutzapOpen(true);
        }}
      >
        <DollarSign className="h-3 w-3 mr-1" />
        Send eCash
      </Button>
      
      <UserNutzapDialog 
        open={nutzapOpen} 
        onOpenChange={setNutzapOpen} 
        pubkey={pubkey} 
      />
    </div>
  );
}

interface MemberItemProps {
  pubkey: string;
}

function MemberItem({ pubkey }: MemberItemProps) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const [nutzapOpen, setNutzapOpen] = useState(false);
  
  const displayName = metadata?.name || pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  
  return (
    <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors">
      <Link to={`/profile/${pubkey}`} className="flex items-center gap-3">
        <Avatar className="rounded-md h-9 w-9">
          <AvatarImage src={profileImage} />
          <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="font-medium">{displayName}</span>
      </Link>
      
      <Button 
        variant="outline" 
        size="sm" 
        className="text-xs py-1 px-2 h-auto"
        onClick={(e) => {
          e.stopPropagation();
          setNutzapOpen(true);
        }}
      >
        <DollarSign className="h-3 w-3 mr-1" />
        Send eCash
      </Button>
      
      <UserNutzapDialog 
        open={nutzapOpen} 
        onOpenChange={setNutzapOpen} 
        pubkey={pubkey} 
      />
    </div>
  );
}