import { useState, useEffect, useMemo } from "react";
import { useNostr } from "@/hooks/useNostr";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserGroups } from "@/hooks/useUserGroups";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/ui/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { parseNostrAddress } from "@/lib/nostr-utils";
import { KINDS } from "@/lib/nostr-kinds";
import { NostrEvent } from "@nostrify/nostrify";
import { GroupPostItem } from "@/components/groups/GroupPostItem";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";

export default function GroupPostsFeed() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { data: userGroups } = useUserGroups();
  const [activeTab, setActiveTab] = useState<"all" | "approved">("approved");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Get a list of group IDs the user is a member of
  const groupIds = useMemo(() => {
    if (!userGroups?.allGroups) return [];
    
    return userGroups.allGroups.map(group => {
      const dTag = group.tags.find((tag) => tag[0] === "d");
      return `${KINDS.GROUP}:${group.pubkey}:${dTag ? dTag[1] : ""}`;
    });
  }, [userGroups]);

  // Create a list to track banned users from all groups
  const [bannedUsersList, setBannedUsersList] = useState<Set<string>>(new Set());

  // Fetch posts from all groups the user is a member of
  const { data: groupPosts, isLoading: isPostsLoading, refetch } = useQuery({
    queryKey: ["group-posts-feed", groupIds, activeTab, refreshTrigger],
    queryFn: async () => {
      if (!nostr || !groupIds.length) return [];

      // Array to hold all posts
      let allPosts: Array<NostrEvent & {
        communityId: string;
        approval?: {
          id: string;
          pubkey: string;
          created_at: number;
          kind: number;
        }
      }> = [];

      // Process each group sequentially to avoid overwhelming relays
      for (const communityId of groupIds) {
        try {
          const parsedId = communityId.includes(':') ? parseNostrAddress(communityId) : null;
          if (!parsedId) continue;

          // Fetch approved posts for this group
          const approvalEvents = await nostr.query([{
            kinds: [KINDS.GROUP_POST_APPROVAL],
            "#a": [communityId],
            limit: 20,
          }], { signal: AbortSignal.timeout(5000) });

          // Only fetch all posts if we're viewing the "all" tab
          let postEvents: NostrEvent[] = [];
          if (activeTab === "all") {
            postEvents = await nostr.query([{
              kinds: [KINDS.GROUP_POST],
              "#a": [communityId],
              limit: 20,
            }], { signal: AbortSignal.timeout(5000) });
          }

          // Fetch removals for this group
          const removalEvents = await nostr.query([{
            kinds: [KINDS.GROUP_POST_REMOVAL],
            "#a": [communityId],
            limit: 50,
          }], { signal: AbortSignal.timeout(5000) });

          // Fetch community details to get moderators
          const communityEvents = await nostr.query([{
            kinds: [KINDS.GROUP],
            authors: [parsedId.pubkey],
            "#d": [parsedId.identifier],
          }], { signal: AbortSignal.timeout(5000) });

          const communityEvent = communityEvents?.[0];

          // Get moderators from community event
          const moderators = communityEvent?.tags
            .filter(tag => tag[0] === "p" && tag[3] === "moderator")
            .map(tag => tag[1]) || [];

          // Get approved member pubkeys - using GROUP_APPROVED_MEMBERS_LIST instead of GROUP_MEMBER_APPROVAL
          const approvedMembersResponse = await nostr.query([{
            kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST],
            "#a": [communityId],
            limit: 100,
          }], { signal: AbortSignal.timeout(5000) });

          // Extract approved member pubkeys from events
          const approvedMembers = approvedMembersResponse.map(event => {
            const pTag = event.tags.find(tag => tag[0] === "p");
            return pTag?.[1];
          }).filter((pubkey): pubkey is string => !!pubkey);

          // Create a set of removed post IDs
          const removedPostIds = new Set(
            removalEvents.map(removal => {
              const eventTag = removal.tags.find(tag => tag[0] === "e");
              return eventTag ? eventTag[1] : null;
            }).filter((id): id is string => id !== null)
          );

          // Process approved posts
          const processedApprovedPosts = approvalEvents.map(approval => {
            try {
              const approvedPost = JSON.parse(approval.content) as NostrEvent;
              
              // Skip if the post is removed
              if (removedPostIds.has(approvedPost.id)) return null;
              
              // Skip if this is a reply (kind 1111)
              const kindTag = approval.tags.find(tag => tag[0] === "k");
              const kind = kindTag ? Number.parseInt(kindTag[1]) : null;
              if (kind === KINDS.GROUP_POST_REPLY) return null;

              // Skip if the post itself is a reply
              if (approvedPost.kind === KINDS.GROUP_POST_REPLY) return null;

              // Add the community ID and approval information
              return {
                ...approvedPost,
                communityId,
                approval: {
                  id: approval.id,
                  pubkey: approval.pubkey,
                  created_at: approval.created_at,
                  kind: kind || approvedPost.kind
                }
              };
            } catch (error) {
              console.error("Error parsing approved post:", error);
              return null;
            }
          }).filter((post): post is NostrEvent & {
            communityId: string;
            approval: {
              id: string;
              pubkey: string;
              created_at: number;
              kind: number;
            }
          } => post !== null);

          // Add approved posts to our result array
          allPosts = [...allPosts, ...processedApprovedPosts];

          // If we only want approved posts, skip processing regular posts
          if (activeTab === "approved") continue;

          // Process all posts (for the "all" tab)
          const allGroupPosts = postEvents.map(post => {
            // Skip if removed
            if (removedPostIds.has(post.id)) return null;

            // Skip if this is a reply (kind 1111)
            if (post.kind === KINDS.GROUP_POST_REPLY) return null;

            // Skip if it has a reply marker in tags
            const hasReplyTag = post.tags.some(tag =>
              tag[0] === 'e' && (tag[3] === 'reply' || tag[3] === 'root')
            );
            if (hasReplyTag) return null;

            // Check if the post is already in approved posts
            const isAlreadyApproved = processedApprovedPosts.some(
              approvedPost => approvedPost.id === post.id
            );
            if (isAlreadyApproved) return null;

            // Auto-approve for approved members and moderators
            const isApprovedMember = approvedMembers.includes(post.pubkey);
            const isModerator = moderators.includes(post.pubkey);
            
            if (isApprovedMember || isModerator) {
              return {
                ...post,
                communityId,
                approval: {
                  id: `auto-approved-${post.id}`,
                  pubkey: post.pubkey,
                  created_at: post.created_at,
                  kind: post.kind
                }
              };
            }
            
            // For non-approved posts, just add the communityId
            return {
              ...post,
              communityId
            };
          }).filter((post): post is NostrEvent & {
            communityId: string;
            approval?: {
              id: string;
              pubkey: string;
              created_at: number;
              kind: number;
            }
          } => post !== null);

          // Add all posts to the array
          allPosts = [...allPosts, ...allGroupPosts];
        } catch (error) {
          console.error(`Error fetching posts for group ${communityId}:`, error);
        }
      }
      
      return allPosts;
    },
    enabled: !!nostr && groupIds.length > 0,
    refetchOnWindowFocus: true,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });

  // Fetch banned users from all groups
  useEffect(() => {
    if (!groupIds.length || !nostr) return;

    const fetchBannedUsers = async () => {
      const allBannedUsers = new Set<string>();

      for (const groupId of groupIds) {
        try {
          const banEvents = await nostr.query([{
            kinds: [KINDS.GROUP_BANNED_MEMBERS_LIST],
            "#a": [groupId],
            limit: 50,
          }], { signal: AbortSignal.timeout(3000) });
          
          banEvents.forEach(event => {
            const pTag = event.tags.find(tag => tag[0] === "p");
            if (pTag && pTag[1]) {
              allBannedUsers.add(pTag[1]);
            }
          });
        } catch (error) {
          console.error(`Error getting banned users for ${groupId}:`, error);
        }
      }

      setBannedUsersList(allBannedUsers);
    };

    fetchBannedUsers();
  }, [groupIds, nostr]);

  // Filter out posts from banned users
  const filteredPosts = useMemo(() => {
    const posts = groupPosts || [];
    return posts.filter(post => !bannedUsersList.has(post.pubkey));
  }, [groupPosts, bannedUsersList]);

  // Sort posts by timestamp (most recent first)
  const sortedPosts = useMemo(() => {
    return [...filteredPosts].sort((a, b) => b.created_at - a.created_at);
  }, [filteredPosts]);

  // Handle manual refresh
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    refetch();
  };

  // Show a loading state when fetching posts
  if (isPostsLoading) {
    return (
      <div className="container mx-auto py-1 px-3 sm:px-4">
        <Header />
        
        <Tabs defaultValue="approved" className="w-full mt-2">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Group Posts</h1>
            <TabsList>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="approved" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="border-b pb-4">
                      <div className="flex items-start gap-2 mb-2">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <div className="pl-12">
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="border-b pb-4">
                      <div className="flex items-start gap-2 mb-2">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <div className="pl-12">
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Check if user is a member of any groups
  if (!groupIds.length) {
    return (
      <div className="container mx-auto py-1 px-3 sm:px-4">
        <Header />
        
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>No Groups Found</CardTitle>
              <CardDescription>You need to join groups to see posts.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="mb-4">Browse available groups and join ones that interest you</p>
                <Button asChild>
                  <Link to="/groups">
                    <Icon name="Plus" size={16} className="mr-2" />
                    Browse Groups
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show empty state if no posts found
  if (!sortedPosts.length) {
    return (
      <div className="container mx-auto py-1 px-3 sm:px-4">
        <Header />
        
        <Tabs 
          value={activeTab} 
          onValueChange={(val) => setActiveTab(val as "all" | "approved")} 
          className="w-full mt-2"
        >
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Group Posts</h1>
            <TabsList>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={activeTab} className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>No Posts Found</CardTitle>
                  <Button variant="outline" size="sm" onClick={handleRefresh}>
                    <Icon name="RefreshCcw" size={16} className="mr-2" />
                    Refresh
                  </Button>
                </div>
                <CardDescription>
                  {activeTab === "approved" 
                    ? "There are no approved posts in your groups yet."
                    : "There are no posts in your groups yet."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-sm mt-4 mb-4">
                    Join more groups or start posting in your existing groups!
                  </p>
                  <Button asChild>
                    <Link to="/groups">
                      <Icon name="Plus" size={16} className="mr-2" />
                      Browse Groups
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-1 px-3 sm:px-4">
      <Header />
      
      <Tabs 
        value={activeTab} 
        onValueChange={(val) => setActiveTab(val as "all" | "approved")} 
        className="w-full mt-2"
      >
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Group Posts</h1>
          <TabsList>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Recent Posts from Your Groups</CardTitle>
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  <Icon name="RefreshCcw" size={16} className="mr-2" />
                  Refresh
                </Button>
              </div>
              <CardDescription>
                {activeTab === "approved" 
                  ? "Showing approved posts from groups you've joined"
                  : "Showing all posts from groups you've joined"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                {sortedPosts.map((post) => (
                  <GroupPostItem key={post.id} post={post} />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}