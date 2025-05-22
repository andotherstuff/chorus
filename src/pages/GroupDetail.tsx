import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useNostr } from "@/hooks/useNostr";
import { usePendingReplies } from "@/hooks/usePendingReplies";
import { usePendingPostsCount } from "@/hooks/usePendingPostsCount";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { Separator } from "@/components/ui/separator"; // Removed
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuthor } from "@/hooks/useAuthor";
import { CreatePostForm } from "@/components/groups/CreatePostForm";
import { PostList } from "@/components/groups/PostList";
import { PendingPostsList } from "@/components/groups/PendingPostsList";
import { ReportsList } from "@/components/groups/ReportsList";
import { JoinRequestButton } from "@/components/groups/JoinRequestButton";
import { MemberManagement } from "@/components/groups/MemberManagement";
import { ApprovedMembersList } from "@/components/groups/ApprovedMembersList";
import { Users, Settings, Info, MessageSquare, CheckCircle, UserPlus, Clock, Pin, PinOff, Flag } from "lucide-react";
import { parseNostrAddress } from "@/lib/nostr-utils";
import Header from "@/components/ui/Header";
import { usePinnedGroups } from "@/hooks/usePinnedGroups";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator"; // Added Separator import

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const [parsedId, setParsedId] = useState<{ kind: number; pubkey: string; identifier: string } | null>(null);
  const [showOnlyApproved, setShowOnlyApproved] = useState(true);
  const [currentPostCount, setCurrentPostCount] = useState(0); // State for post count
  const [activeTab, setActiveTab] = useState("posts");
  const { pinGroup, unpinGroup, isGroupPinned, isUpdating } = usePinnedGroups();

  useEffect(() => {
    if (groupId) {
      const parsed = parseNostrAddress(decodeURIComponent(groupId));
      if (parsed) {
        setParsedId(parsed);
      }
    }
  }, [groupId]);

  // We'll move the pending posts count query after isModerator is defined

  const { data: community, isLoading: isLoadingCommunity } = useQuery({
    queryKey: ["community", parsedId?.pubkey, parsedId?.identifier],
    queryFn: async (c) => {
      if (!parsedId) throw new Error("Invalid community ID");

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{
        kinds: [34550],
        authors: [parsedId.pubkey],
        "#d": [parsedId.identifier]
      }], { signal });

      if (events.length === 0) throw new Error("Community not found"); // This error message is internal, can stay
      return events[0];
    },
    enabled: !!nostr && !!parsedId,
  });

  const isOwner = user && community && user.pubkey === community.pubkey;
  const isModerator = isOwner || (user && community?.tags
    .filter(tag => tag[0] === "p" && tag[3] === "moderator")
    .some(tag => tag[1] === user.pubkey));

  // Query for pending posts count using our custom hook
  const { data: pendingPostsCount = 0 } = usePendingPostsCount(groupId || '');

  // Query for pending replies
  const { data: pendingReplies = [] } = usePendingReplies(groupId || '');

  // Calculate total pending items (posts + replies)
  const totalPendingCount = (pendingPostsCount || 0) + pendingReplies.length;

  // Set active tab to "pending" if there are pending posts/replies and user is a moderator
  useEffect(() => {
    // Only change tab if we have pending items and user is a moderator
    if (isModerator && totalPendingCount > 0) {
      setActiveTab("pending");
    }
  }, [isModerator, totalPendingCount]);

  const nameTag = community?.tags.find(tag => tag[0] === "name");
  const descriptionTag = community?.tags.find(tag => tag[0] === "description");
  const imageTag = community?.tags.find(tag => tag[0] === "image");
  const moderatorTags = community?.tags.filter(tag => tag[0] === "p" && tag[3] === "moderator") || [];

  const name = nameTag ? nameTag[1] : (parsedId?.identifier || "Unnamed Group");
  const description = descriptionTag ? descriptionTag[1] : "No description available";
  const image = imageTag ? imageTag[1] : "/placeholder-community.svg"; // Placeholder image path, might not need changing

  useEffect(() => {
    if (name && name !== "Unnamed Group") { // Adjusted check
      document.title = `+chorus - ${name}`;
    } else {
      document.title = "+chorus"; // Default if name isn't available
    }
    // Optional: Reset title when component unmounts
    return () => {
      document.title = "+chorus";
    };
  }, [name]); // Dependency array ensures this runs when 'name' changes


  if (isLoadingCommunity || !parsedId) {
    return (
      <div className="container mx-auto py-3 px-3 sm:px-4">
        <Header />
        <Separator className="my-4" />
        <h1 className="text-2xl font-bold mb-4">Loading group...</h1>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="container mx-auto py-3 px-3 sm:px-4">
        <h1 className="text-2xl font-bold mb-4">Group not found</h1>
        <p>The group you're looking for doesn't exist or has been deleted.</p>
        <Button asChild className="mt-4">
          <Link to="/groups">Back to Groups</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-3 px-3 sm:px-4">
      <Header />
      <Separator className="my-4" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="md:col-span-2">
          <div className="h-48 rounded-lg overflow-hidden mb-4 relative group"> {/* Added relative and group */}
            <img
              src={image}
              alt={name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = "/placeholder-community.svg";
              }}
            />

            {/* Pin/Unpin Button */}
            {user && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute top-3 right-3 h-9 w-9 rounded-full bg-background/80 shadow-md"
                      onClick={() => {
                        const communityId = `34550:${parsedId?.pubkey}:${parsedId?.identifier}`; // Keep communityId for protocol consistency
                        if (isGroupPinned(communityId)) {
                          unpinGroup(communityId);
                        } else {
                          pinGroup(communityId);
                        }
                      }}
                      disabled={isUpdating}
                    >
                      {isGroupPinned(`34550:${parsedId?.pubkey}:${parsedId?.identifier}`) ? (
                        <PinOff className="h-5 w-5" />
                      ) : (
                        <Pin className="h-5 w-5" />
                      )}
                      <span className="sr-only">
                        {isGroupPinned(`34550:${parsedId?.pubkey}:${parsedId?.identifier}`)
                          ? "Unpin from My Groups"
                          : "Pin to My Groups"}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isGroupPinned(`34550:${parsedId?.pubkey}:${parsedId?.identifier}`)
                      ? "Unpin from My Groups"
                      : "Pin to My Groups"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <p className="text-lg mb-3">{description}</p>
        </div>

        <div>
          {isModerator ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  {isOwner ? "Owner Controls" : "Moderator Controls"}
                </CardTitle>
                <CardDescription>
                  {isOwner
                    ? "You are the owner of this group"
                    : "You are a moderator of this group"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-4">
                <Button asChild variant="outline" className="w-full">
                  <Link to={`/group/${encodeURIComponent(groupId || '')}/settings`} className="w-full flex items-center justify-center gap-2">
                    <Settings className="h-4 w-4" />
                    Manage Group
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <UserPlus className="h-5 w-5 mr-2" />
                  Join this group
                </CardTitle>
                <CardDescription>
                  Request to join this group to participate in discussions
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-4">
                <JoinRequestButton communityId={groupId || ''} isModerator={isModerator} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="posts">
            <MessageSquare className="h-4 w-4 mr-2" />
            Posts
          </TabsTrigger>
          {isModerator && (
            <TabsTrigger value="pending" className="relative">
              <Clock className="h-4 w-4 mr-2" />
              Pending Approval
              {totalPendingCount > 0 && (
                <span className="ml-2 bg-amber-500 text-white text-xs rounded-full px-2 py-0.5">
                  {totalPendingCount}
                </span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="members">
            <Users className="h-4 w-4 mr-2" />
            Members
          </TabsTrigger>
          {isModerator && (
            <TabsTrigger value="reports">
              <Flag className="h-4 w-4 mr-2" />
              Reports
            </TabsTrigger>
          )}
          <TabsTrigger value="about">
            <Info className="h-4 w-4 mr-2" />
            About
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-4">
          {user && (
            <CreatePostForm communityId={groupId || ''} />
          )}

          {/* Modified section for toggle only */}
          <div className="flex items-center justify-end mb-4 gap-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="approved-only"
                checked={showOnlyApproved}
                onCheckedChange={setShowOnlyApproved}
              />
              <Label htmlFor="approved-only" className="flex items-center cursor-pointer">
                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                Show only approved posts
              </Label>
            </div>
          </div>

          <PostList
            communityId={groupId || ''}
            showOnlyApproved={showOnlyApproved}
            onPostCountChange={setCurrentPostCount} // Passed callback
          />
        </TabsContent>

        {isModerator && (
          <TabsContent value="pending" className="space-y-6">
            <PendingPostsList communityId={groupId || ''} />
          </TabsContent>
        )}

        <TabsContent value="members" className="space-y-4">
          {isModerator && (
            <MemberManagement communityId={groupId || ''} isModerator={isModerator} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Group Owner & Moderators
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {community && <ModeratorItem key={community.pubkey} pubkey={community.pubkey} isCreator />}
                  {moderatorTags
                    .filter(tag => tag[1] !== community?.pubkey)
                    .map((tag) => (
                      <ModeratorItem key={tag[1]} pubkey={tag[1]} />
                    ))}
                </div>
              </CardContent>
            </Card>

            <ApprovedMembersList communityId={groupId || ''} />
          </div>
        </TabsContent>

        {isModerator && (
          <TabsContent value="reports" className="space-y-4">
            <ReportsList communityId={groupId || ''} />
          </TabsContent>
        )}
        
        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle>About this Group</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium">Description</h3>
                <p>{description}</p>
              </div>
              {community && (
                <>
                  <div>
                    <h3 className="font-medium">Created by</h3>
                    <ModeratorItem pubkey={community.pubkey} isCreator />
                  </div>
                  <div>
                    <h3 className="font-medium">Created at</h3>
                    <p>{new Date(community.created_at * 1000).toLocaleString()}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
