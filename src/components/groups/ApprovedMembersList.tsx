import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthor } from "@/hooks/useAuthor";
import { useApprovedMembers } from "@/hooks/useApprovedMembers";
import { Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ApprovedMembersListProps {
  communityId: string;
}

export function ApprovedMembersList({ communityId }: ApprovedMembersListProps) {
  const { approvedMembers, isLoading } = useApprovedMembers(communityId);
  const [showAllMembers, setShowAllMembers] = useState(false);
  
  // Remove duplicates (though useApprovedMembers should already handle this)
  const uniqueApprovedMembers = [...new Set(approvedMembers)];
  
  // Determine how many members to show
  const membersToShow = showAllMembers ? uniqueApprovedMembers : uniqueApprovedMembers.slice(0, 10);
  const remainingCount = uniqueApprovedMembers.length - 10;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Users className="h-5 w-5 mr-2" />
          Members ({uniqueApprovedMembers.length})
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
        ) : uniqueApprovedMembers.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <p>No approved members yet</p>
          </div>
        ) : (
          <div className="space-y-3">
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
            {showAllMembers && uniqueApprovedMembers.length > 10 && (
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