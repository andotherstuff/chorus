import { useParams } from "react-router-dom";
import { useAuthor } from "@/hooks/useAuthor";
import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useFollowList } from "@/hooks/useFollowList";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { NoteContent } from "@/components/NoteContent";
import { Link } from "react-router-dom";
import { ExternalLink, Copy, UserPlus, UserMinus, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import type { NostrEvent } from "@nostrify/nostrify";
import { parseNostrAddress } from "@/lib/nostr-utils";
import Header from "@/components/ui/Header";
import { VerifiedNip05 } from "@/components/VerifiedNip05";

// Helper function to extract group information from a post
function extractGroupInfo(post: NostrEvent): { groupId: string; groupName: string } | null {
  // Find the "a" tag that matches the group format
  const groupTag = post.tags.find(tag => {
    return tag[0] === "a" && tag[1].startsWith("34550:");
  });

  if (!groupTag) return null;

  const groupId = groupTag[1];

  // Parse the Nostr address to extract components
  const parsedAddress = parseNostrAddress(groupId);

  if (parsedAddress && parsedAddress.kind === 34550) {
    return {
      groupId,
      groupName: parsedAddress.identifier // The identifier part is often the group name
    };
  }

  // Fallback to simple string splitting if parsing fails
  const parts = groupId.split(":");
  if (parts.length >= 3) {
    return {
      groupId,
      groupName: parts[2] // The identifier part is often the group name
    };
  }

  return {
    groupId,
    groupName: "Group" // Fallback name if we can't extract it
  };
}

// Component to display group information on a post
function PostGroupLink({ post }: { post: NostrEvent }) {
  const groupInfo = extractGroupInfo(post);

  if (!groupInfo) return null;

  return (
    <Link
      to={`/group/${encodeURIComponent(groupInfo.groupId)}`}
      className="flex items-center text-xs text-muted-foreground hover:text-primary"
    >
      <div className="flex items-center px-2 py-1 rounded-md bg-muted hover:bg-muted/80 transition-colors">
        <Users className="h-3 w-3 mr-1" />
        Posted in <span className="font-medium ml-1">{groupInfo.groupName}</span>
      </div>
    </Link>
  );
}

// Component to display the user's groups
interface UserGroup {
  id: string;
  name: string;
  description: string;
  image: string;
  membershipEvent: NostrEvent;
  groupEvent: NostrEvent;
}

function UserGroupsList({
  groups,
  isLoading
}: {
  groups: UserGroup[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-md" />
            <div>
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">This user is not a member of any groups yet</p>
      </Card>
    );
  }

  // Create a map to deduplicate groups by ID
  const uniqueGroups = new Map<string, UserGroup>();
  for (const group of groups) {
    // Only add if not already in the map, or replace with newer version
    if (
      !uniqueGroups.has(group.id) ||
      (group.groupEvent.created_at > (uniqueGroups.get(group.id)?.groupEvent.created_at ?? 0))
    ) {
      uniqueGroups.set(group.id, group);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from(uniqueGroups.values()).map((group) => (
        <Link
          key={group.id}
          to={`/group/${encodeURIComponent(group.id)}`}
          className="block"
        >
          <Card className="overflow-hidden h-full hover:bg-muted/50 transition-colors">
            <div className="flex p-4 h-full">
              <div className="h-16 w-16 rounded-md overflow-hidden mr-4 flex-shrink-0">
                <img
                  src={group.image}
                  alt={group.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder-community.svg";
                  }}
                />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">{group.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {group.description || "No description available"}
                </p>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default function Profile() {
  const { pubkey } = useParams<{ pubkey: string }>();
  const author = useAuthor(pubkey);
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const {
    isFollowing,
    followUser,
    unfollowUser,
    isPending: isFollowActionPending
  } = useFollowList(user?.pubkey);

  // Query for user's posts
  const { data: posts, isLoading: isLoadingPosts } = useQuery({
    queryKey: ["user-posts", pubkey],
    queryFn: async (c) => {
      if (!pubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Get posts by this user
      const userPosts = await nostr.query([{
        kinds: [11],
        authors: [pubkey],
        limit: 20,
      }], { signal });

      return userPosts.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!nostr && !!pubkey,
  });

  // Query for follower count
  const { data: followerCount, isLoading: isLoadingFollowers } = useQuery({
    queryKey: ["follower-count", pubkey],
    queryFn: async (c) => {
      if (!pubkey || !nostr) return 0;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Get kind 3 events that include this pubkey in their p tags
      const followerEvents = await nostr.query([{
        kinds: [3],
        "#p": [pubkey],
        limit: 100,
      }], { signal });

      // Count unique pubkeys that follow this user
      const uniqueFollowers = new Set(followerEvents.map(event => event.pubkey));
      return uniqueFollowers.size;
    },
    enabled: !!nostr && !!pubkey,
  });

  // Query for following count
  const { data: followingCount, isLoading: isLoadingFollowing } = useQuery({
    queryKey: ["following-count", pubkey],
    queryFn: async (c) => {
      if (!pubkey || !nostr) return 0;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Get the most recent kind 3 event for the user
      const [event] = await nostr.query(
        [{ kinds: [3], authors: [pubkey], limit: 1 }],
        { signal }
      );

      if (!event) return 0;

      // Count the number of p tags
      return event.tags.filter(tag => tag[0] === 'p').length;
    },
    enabled: !!nostr && !!pubkey,
  });

  // Query for groups the user is a part of
  const { data: userGroups, isLoading: isLoadingGroups } = useQuery({
    queryKey: ["user-groups-profile", pubkey],
    queryFn: async (c) => {
      if (!pubkey || !nostr) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // First, check if this is the current user - if so, we can use a more efficient approach
      const isCurrentUserProfile = user && pubkey === user.pubkey;

      const groupEvents: NostrEvent[] = [];

      if (isCurrentUserProfile) {
        // For current user, get all communities they're part of from various sources

        // Get communities where user is owner or moderator
        const ownedOrModeratedEvents = await nostr.query([{
          kinds: [34550],
          authors: [pubkey], // Communities they created
          limit: 50,
        }], { signal });

        groupEvents.push(...ownedOrModeratedEvents);

        // Get communities where user is a moderator but not owner
        const moderatedEvents = await nostr.query([{
          kinds: [34550],
          "#p": [pubkey],
          limit: 50,
        }], { signal });

        // Filter to only include events where user is tagged as moderator
        const moderatorEvents = moderatedEvents.filter(event =>
          event.pubkey !== pubkey && // Not already counted as owned
          event.tags.some(tag =>
            tag[0] === "p" &&
            tag[1] === pubkey &&
            tag[3] === "moderator"
          )
        );

        groupEvents.push(...moderatorEvents);

        // Get communities where user is a member
        const membershipEvents = await nostr.query([{
          kinds: [14550],
          "#p": [pubkey],
          limit: 50,
        }], { signal });

        // For each membership event, get the community details
        for (const event of membershipEvents) {
          const aTag = event.tags.find(tag => tag[0] === "a");
          if (!aTag || !aTag[1]) continue;

          const groupId = aTag[1];
          const parsedGroup = parseNostrAddress(groupId);

          if (!parsedGroup || parsedGroup.kind !== 34550) continue;

          // Fetch the group details if we don't already have it
          const existingGroup = groupEvents.find(g => {
            const dTag = g.tags.find(tag => tag[0] === "d");
            return g.pubkey === parsedGroup.pubkey && dTag && dTag[1] === parsedGroup.identifier;
          });

          if (!existingGroup) {
            const [groupEvent] = await nostr.query([{
              kinds: [34550],
              authors: [parsedGroup.pubkey],
              "#d": [parsedGroup.identifier],
              limit: 1,
            }], { signal: AbortSignal.timeout(3000) });

            if (groupEvent) {
              groupEvents.push(groupEvent);
            }
          }
        }
      } else {
        // For other users, get membership events
        const membershipEvents = await nostr.query([{
          kinds: [14550],
          "#p": [pubkey],
          limit: 50,
        }], { signal });

        // For each membership event, get the community details
        for (const event of membershipEvents) {
          const aTag = event.tags.find(tag => tag[0] === "a");
          if (!aTag || !aTag[1]) continue;

          const groupId = aTag[1];
          const parsedGroup = parseNostrAddress(groupId);

          if (!parsedGroup || parsedGroup.kind !== 34550) continue;

          // Fetch the group details
          const [groupEvent] = await nostr.query([{
            kinds: [34550],
            authors: [parsedGroup.pubkey],
            "#d": [parsedGroup.identifier],
            limit: 1,
          }], { signal: AbortSignal.timeout(3000) });

          if (groupEvent) {
            groupEvents.push(groupEvent);
          }
        }

        // Also get communities they created
        const ownedEvents = await nostr.query([{
          kinds: [34550],
          authors: [pubkey],
          limit: 50,
        }], { signal });

        groupEvents.push(...ownedEvents);
      }

      // Deduplicate groups by their unique ID
      const uniqueGroups = new Map<string, NostrEvent>();
      for (const event of groupEvents) {
        const dTag = event.tags.find(tag => tag[0] === "d");
        if (!dTag) continue;

        const groupId = `34550:${event.pubkey}:${dTag[1]}`;
        uniqueGroups.set(groupId, event);
      }

      // Convert to UserGroup format
      return Array.from(uniqueGroups.entries()).map(([id, event]) => {
        const nameTag = event.tags.find(tag => tag[0] === "name");
        const descriptionTag = event.tags.find(tag => tag[0] === "description");
        const imageTag = event.tags.find(tag => tag[0] === "image");
        const dTag = event.tags.find(tag => tag[0] === "d");

        return {
          id,
          name: nameTag ? nameTag[1] : (dTag ? dTag[1] : "Unnamed Group"),
          description: descriptionTag ? descriptionTag[1] : "",
          image: imageTag ? imageTag[1] : "/placeholder-group.jpg",
          membershipEvent: event, // Using the group event as membership event
          groupEvent: event,
        };
      });
    },
    enabled: !!nostr && !!pubkey,
  });

  const metadata = author.data?.metadata;
  const displayName = metadata?.name || pubkey?.slice(0, 8) || "";
  const displayNameFull = metadata?.display_name || displayName;
  const profileImage = metadata?.picture;
  const about = metadata?.about;
  const website = metadata?.website;
  const nip05 = metadata?.nip05;

  // Check if this is the current user's profile
  const isCurrentUser = user && pubkey === user.pubkey;

  // Check if the current user is following this profile
  const following = pubkey ? isFollowing(pubkey) : false;

  const handleFollowAction = () => {
    if (!pubkey || !user) return;

    if (following) {
      unfollowUser(pubkey);
    } else {
      followUser(pubkey);
    }
  };

  const copyPubkeyToClipboard = () => {
    if (pubkey) {
      navigator.clipboard.writeText(pubkey);
      toast.success("Public key copied to clipboard");
    }
  };

  if (author.isLoading) {
    return (
      <div className="container mx-auto py-3 px-3 sm:px-4">
        <Header />
        <div className="space-y-6 my-6">
          <Card className="mb-8">
            <CardHeader className="flex flex-row items-start gap-6">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <Skeleton className="h-6 w-48 mb-1" />
                    <Skeleton className="h-4 w-32 mb-2" />

                    <div className="mt-1">
                      <Skeleton className="h-4 w-32 mb-1" />
                    </div>

                    <div className="mt-1">
                      <Skeleton className="h-4 w-48 mb-2" />
                    </div>

                    <div className="flex items-center gap-4 mt-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>

                  <Skeleton className="h-9 w-24" />
                </div>

                <div className="mt-4">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Mobile loading state - Groups first, then Posts */}
          <div className="md:hidden space-y-8 mb-8">
            <div>
              <h2 className="text-xl font-semibold mb-4">Groups</h2>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-16 w-16 rounded-md" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Recent Posts</h2>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader className="flex flex-row items-start gap-4 pb-2">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                    <CardFooter className="pt-0 pb-3">
                      <Skeleton className="h-6 w-32" />
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Desktop loading state - Posts and Groups side by side */}
          <div className="hidden md:grid md:grid-cols-3 gap-6 mb-8">
            <div className="col-span-2">
              <h2 className="text-xl font-semibold mb-4">Recent Posts</h2>
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader className="flex flex-row items-start gap-4 pb-2">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <Skeleton className="h-4 w-32 mb-1" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                    <CardFooter className="pt-0 pb-3">
                      <Skeleton className="h-6 w-32" />
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Groups</h2>
              <div className="grid grid-cols-1 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="overflow-hidden">
                    <div className="flex p-4">
                      <Skeleton className="h-16 w-16 rounded-md mr-4 flex-shrink-0" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-3 px-3 sm:px-4">
      <Header />
      <div className="space-y-6 my-6">
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-start gap-6">
          <Avatar className="h-24 w-24 rounded-md">
            <AvatarImage src={profileImage} />
            <AvatarFallback className="text-xl">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold">{displayNameFull}</h1>
                {displayName !== displayNameFull && (
                  <p className="text-muted-foreground">@{displayName}</p>
                )}

                <div className="flex items-center mt-1 text-sm text-muted-foreground">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={copyPubkeyToClipboard}
                  >
                    <span className="truncate max-w-[120px]">{pubkey?.slice(0, 8)}...</span>
                    <Copy className="h-3 w-3 ml-1" />
                  </Button>
                </div>

                {nip05 && (
                  <div className="mt-1 text-sm">
                    <VerifiedNip05 nip05={nip05} pubkey={pubkey || ""} />
                  </div>
                )}

                {website && (
                  <div className="mt-2">
                    <a
                      href={website.startsWith('http') ? website : `https://${website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary flex items-center hover:underline"
                    >
                      {website}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-4 mt-3">
                  <div className="text-sm">
                    <span className="font-semibold">{isLoadingFollowing ? '...' : followingCount || 0}</span>{' '}
                    <span className="text-muted-foreground">Following</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold">{isLoadingFollowers ? '...' : followerCount || 0}</span>{' '}
                    <span className="text-muted-foreground">Followers</span>
                  </div>
                </div>
              </div>

              {user && !isCurrentUser && (
                <Button
                  variant={following ? "outline" : "default"}
                  size="sm"
                  onClick={handleFollowAction}
                  disabled={isFollowActionPending || !user}
                >
                  {isFollowActionPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : following ? (
                    <UserMinus className="h-4 w-4 mr-2" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  {following ? "Unfollow" : "Follow"}
                </Button>
              )}
            </div>

            {about && (
              <div className="mt-4 text-sm whitespace-pre-wrap">
                {about}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Mobile layout - Groups first, then Posts */}
      <div className="md:hidden space-y-8 mb-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Groups</h2>
          <UserGroupsList groups={userGroups} isLoading={isLoadingGroups} />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Posts</h2>

          {isLoadingPosts ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center gap-4 pb-2">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="space-y-6">
              {posts.map((post) => (
                <Card key={post.id}>
                  <CardHeader className="flex flex-row items-start gap-4 pb-2">
                    <Avatar className="rounded-md">
                      <AvatarImage src={profileImage} />
                      <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{displayNameFull}</p>
                          <div className="text-xs text-muted-foreground">
                            <span>{new Date(post.created_at * 1000).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pb-2">
                    <div className="whitespace-pre-wrap break-words">
                      <NoteContent event={post} className="text-sm" />
                    </div>
                  </CardContent>

                  {extractGroupInfo(post) && (
                    <CardFooter className="pt-0 pb-3">
                      <PostGroupLink post={post} />
                    </CardFooter>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No posts from this user yet</p>
            </Card>
          )}
        </div>
      </div>

      {/* Desktop layout - Posts and Groups side by side */}
      <div className="hidden md:grid md:grid-cols-3 gap-6 mb-8">
        <div className="col-span-2">
          <h2 className="text-xl font-semibold mb-4">Recent Posts</h2>

          {isLoadingPosts ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center gap-4 pb-2">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="space-y-6">
              {posts.map((post) => (
                <Card key={post.id}>
                  <CardHeader className="flex flex-row items-start gap-4 pb-2">
                    <Avatar className="rounded-md">
                      <AvatarImage src={profileImage} />
                      <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{displayNameFull}</p>
                          <div className="text-xs text-muted-foreground">
                            <span>{new Date(post.created_at * 1000).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pb-2">
                    <div className="whitespace-pre-wrap break-words">
                      <NoteContent event={post} className="text-sm" />
                    </div>
                  </CardContent>

                  {extractGroupInfo(post) && (
                    <CardFooter className="pt-0 pb-3">
                      <PostGroupLink post={post} />
                    </CardFooter>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No posts from this user yet</p>
            </Card>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Groups</h2>
          <UserGroupsList groups={userGroups} isLoading={isLoadingGroups} />
        </div>
      </div>
      </div>
    </div>
  );
}
