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
import { ArrowLeft, ExternalLink, Copy, UserPlus, UserMinus, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { NostrEvent } from "@nostrify/nostrify";
import { parseNostrAddress } from "@/lib/nostr-utils";

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
    groupName: "Community" // Fallback name if we can't extract it
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
        kinds: [1],
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
      <div className="container max-w-4xl py-8">
        <div className="mb-6">
          <Link to="/groups" className="flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Groups
          </Link>
        </div>
        
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center gap-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-2 flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-72 mt-2" />
                  <Skeleton className="h-4 w-32 mt-2" />
                  
                  <div className="flex items-center gap-4 mt-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
        
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
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <Link to="/groups" className="flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Groups
        </Link>
      </div>
      
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-start gap-6">
          <Avatar className="h-24 w-24">
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
                    <span className="text-muted-foreground">✓ {nip05}</span>
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
                <Avatar>
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
  );
}