import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthor } from "@/hooks/useAuthor";
import { Users } from "lucide-react";
import { Link } from "react-router-dom";
import { parseNostrAddress } from "@/lib/nostr-utils";

interface SimpleMembersListProps {
  communityId: string;
}

export function SimpleMembersList({ communityId }: SimpleMembersListProps) {
  const { nostr } = useNostr();
  
  // Parse the community ID to get the community details
  const parsedId = parseNostrAddress(decodeURIComponent(communityId));
  
  // Query for community details to get moderators
  const { data: community } = useQuery({
    queryKey: ["community-simple", parsedId?.pubkey, parsedId?.identifier],
    queryFn: async (c) => {
      if (!parsedId) throw new Error("Invalid community ID");

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{
        kinds: [34550],
        authors: [parsedId.pubkey],
        "#d": [parsedId.identifier]
      }], { signal });

      if (events.length === 0) throw new Error("Community not found");
      return events[0];
    },
    enabled: !!nostr && !!parsedId,
  });
  
  // Query for approved members
  const { data: approvedMembersEvents, isLoading } = useQuery({
    queryKey: ["approved-members-simple", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      const events = await nostr.query([{ 
        kinds: [14550],
        "#a": [communityId],
        limit: 50,
      }], { signal });
      
      return events;
    },
    enabled: !!nostr && !!communityId,
  });

  // Extract all approved member pubkeys from the events
  const approvedMembers = approvedMembersEvents?.flatMap(event => 
    event.tags.filter(tag => tag[0] === "p").map(tag => tag[1])
  ) || [];

  // Get moderators from community
  const moderatorTags = community?.tags.filter(tag => tag[0] === "p" && tag[3] === "moderator") || [];
  const moderators = moderatorTags.map(tag => tag[1]);
  
  // Filter out owner and moderators from approved members to show only regular members
  const regularMembers = approvedMembers.filter(member => 
    member !== community?.pubkey && !moderators.includes(member)
  );

  // Remove duplicates from regular members
  const uniqueRegularMembers = [...new Set(regularMembers)];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <Users className="h-4 w-4 mr-2" />
            Group Owner & Moderators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
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
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Members ({uniqueRegularMembers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
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
            <div className="space-y-3">
              {uniqueRegularMembers.slice(0, 10).map((pubkey) => (
                <MemberItem key={pubkey} pubkey={pubkey} />
              ))}
              {uniqueRegularMembers.length > 10 && (
                <div className="text-center text-sm text-muted-foreground pt-2">
                  + {uniqueRegularMembers.length - 10} more members
                </div>
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

  const displayName = metadata?.name || pubkey.slice(0, 8);
  const profileImage = metadata?.picture;

  return (
    <Link to={`/profile/${pubkey}`} className="block hover:bg-muted rounded-md transition-colors">
      <div className="flex items-center space-x-3 p-2">
        <Avatar className="rounded-md">
          <AvatarImage src={profileImage} />
          <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{displayName}</p>
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
      </div>
    </Link>
  );
}

interface MemberItemProps {
  pubkey: string;
}

function MemberItem({ pubkey }: MemberItemProps) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  
  const displayName = metadata?.name || pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  
  return (
    <Link to={`/profile/${pubkey}`} className="flex items-center gap-3 hover:bg-muted p-2 rounded-md transition-colors">
      <Avatar>
        <AvatarImage src={profileImage} />
        <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="font-medium">{displayName}</span>
    </Link>
  );
}