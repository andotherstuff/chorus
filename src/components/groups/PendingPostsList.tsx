
import { usePendingPostsCount } from "@/hooks/usePendingPostsCount";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PostList } from "./PostList";
import { PendingRepliesList } from "./PendingRepliesList";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface PendingPostsListProps {
  communityId: string;
}

export function PendingPostsList({ communityId }: PendingPostsListProps) {
  
  // Query for pending posts count using our custom hook
  const { data: pendingPostsCount = 0, isLoading } = usePendingPostsCount(communityId);
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64 mb-4" />
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Pending Posts</h2>
        <div className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-3 py-1 rounded-full text-sm font-medium">
          {pendingPostsCount} pending
        </div>
      </div>
      
      {!pendingPostsCount || pendingPostsCount === 0 ? (
        <Alert className="bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>No pending posts</AlertTitle>
          <AlertDescription>
            All posts have been reviewed. There are currently no posts waiting for approval in this group.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Alert className="bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Pending Approval</AlertTitle>
            <AlertDescription>
              These posts are from users who are not approved members, moderators, or the group owner.
              They need your approval before they will be visible to all group members.
            </AlertDescription>
          </Alert>
          
          <PostList 
            communityId={communityId} 
            showOnlyApproved={false} 
            pendingOnly={true}
          />
        </>
      )}
      
      {/* Separator between posts and replies */}
      <Separator className="my-8" />
      
      {/* Pending Replies Section */}
      <PendingRepliesList communityId={communityId} />
    </div>
  );
}