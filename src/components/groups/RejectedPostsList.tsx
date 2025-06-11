import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { NostrEvent } from "@nostrify/nostrify";
import { KINDS } from "@/lib/nostr-kinds";
import { PostItem } from "./PostList";
import { Skeleton } from "@/components/ui/skeleton";
import { parseNostrAddress } from "@/lib/nostr-utils";

interface RejectedPostsListProps {
  communityId: string;
}

export function RejectedPostsList({ communityId }: RejectedPostsListProps) {
  const { nostr } = useNostr();

  // Convert the communityId to the proper format for queries
  const queryId = communityId.includes(":")
    ? communityId
    : `34550:${communityId}`;

  // Query for rejected posts
  const { data: rejectedPosts = [], isLoading } = useQuery({
    queryKey: ["rejected-posts", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Get all removal events for this community
      const removalEvents = await nostr.query([{
        kinds: [KINDS.GROUP_POST_REMOVAL],
        "#a": [queryId],
        limit: 100,
      }], { signal });

      // Extract the post IDs from removal events
      const removedPostIds = removalEvents.map(removal => {
        const eventTag = removal.tags.find(tag => tag[0] === "e");
        return eventTag ? eventTag[1] : null;
      }).filter((id): id is string => id !== null);

      if (removedPostIds.length === 0) return [];

      // Fetch the actual posts that were removed
      const posts = await nostr.query([{
        kinds: [1, 11, 42, 30023, 1111], // Be liberal in what kinds we accept
        ids: removedPostIds,
      }], { signal });

      // Add removal info to posts
      return posts.map(post => {
        const removalEvent = removalEvents.find(removal => {
          const eventTag = removal.tags.find(tag => tag[0] === "e");
          return eventTag && eventTag[1] === post.id;
        });

        return {
          ...post,
          removal: removalEvent ? {
            id: removalEvent.id,
            pubkey: removalEvent.pubkey,
            created_at: removalEvent.created_at,
          } : undefined
        };
      });
    },
    enabled: !!nostr && !!communityId,
  });

  // Get community details for moderator info
  const { data: communityEvent } = useQuery({
    queryKey: ["community-details", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      const parsedId = queryId.includes(':')
        ? parseNostrAddress(queryId)
        : null;
      if (!parsedId) return null;
      
      const events = await nostr.query([{
        kinds: [KINDS.GROUP],
        authors: [parsedId.pubkey],
        "#d": [parsedId.identifier],
      }], { signal });
      
      return events[0] || null;
    },
    enabled: !!nostr && !!communityId,
  });

  const moderators = communityEvent?.tags
    .filter(tag => tag[0] === "p" && tag[3] === "moderator")
    .map(tag => tag[1]) || [];

  if (isLoading) {
    return (
      <div className="space-y-0">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`py-4 ${i < 3 ? 'border-b-2 border-border/70' : ''}`}>
            <div className="px-3">
              <div className="flex flex-row items-center pb-2">
                <Skeleton className="h-9 w-9 rounded-md mr-2.5" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="pt-1 pb-2 pl-[2.875rem]">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (rejectedPosts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-0">
      {rejectedPosts.map((post, index) => (
        <PostItem
          key={post.id}
          post={post}
          communityId={communityId}
          isApproved={false}
          isModerator={true}
          isLastItem={index === rejectedPosts.length - 1}
          isPinned={false}
        />
      ))}
    </div>
  );
}