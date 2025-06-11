import { useNostr } from "@/hooks/useNostr";
import { usePendingPostsCount } from "@/hooks/usePendingPostsCount";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PostList } from "./PostList";
import { PendingRepliesList } from "./PendingRepliesList";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { KINDS } from "@/lib/nostr-kinds";
import { RejectedPostsList } from "./RejectedPostsList";

interface PendingPostsListProps {
  communityId: string;
}

export function PendingPostsList({ communityId }: PendingPostsListProps) {
  const { nostr } = useNostr();
  
  // Query for pending posts count using our custom hook
  const { data: pendingPostsCount = 0, isLoading } = usePendingPostsCount(communityId);
  
  // Query for rejected posts count
  const { data: rejectedPostsCount = 0 } = useQuery({
    queryKey: ["rejected-posts-count", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      // Get all removal events for this community
      const removalEvents = await nostr.query([{
        kinds: [KINDS.GROUP_POST_REMOVAL],
        "#a": [communityId],
        limit: 100,
      }], { signal });
      
      return removalEvents.length;
    },
    enabled: !!nostr && !!communityId,
  });
  
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
      <Tabs defaultValue="pending" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Post Moderation</h2>
          <TabsList>
            <TabsTrigger value="pending" className="relative">
              Pending
              {pendingPostsCount > 0 && (
                <Badge className="ml-2 h-5 px-1.5 bg-amber-500 text-white">
                  {pendingPostsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rejected" className="relative">
              Rejected
              {rejectedPostsCount > 0 && (
                <Badge className="ml-2 h-5 px-1.5 bg-red-500 text-white">
                  {rejectedPostsCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="pending" className="space-y-4">
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
        </TabsContent>
        
        <TabsContent value="rejected" className="space-y-4">
          {rejectedPostsCount === 0 ? (
            <Alert className="bg-muted">
              <XCircle className="h-4 w-4" />
              <AlertTitle>No rejected posts</AlertTitle>
              <AlertDescription>
                There are no rejected posts in this group.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert className="bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Rejected Posts</AlertTitle>
                <AlertDescription>
                  These posts have been rejected and are not visible to group members. You can approve them if you change your mind.
                </AlertDescription>
              </Alert>
              
              <RejectedPostsList communityId={communityId} />
            </>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Separator between posts and replies */}
      <Separator className="my-8" />
      
      {/* Pending Replies Section */}
      <PendingRepliesList communityId={communityId} />
    </div>
  );
}