import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useNostr } from "@/hooks/useNostr";
import { usePendingReplies } from "@/hooks/usePendingReplies";
import { usePendingPostsCount } from "@/hooks/usePendingPostsCount";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuthor } from "@/hooks/useAuthor";
import { CreatePostForm } from "@/components/groups/CreatePostForm";
import { PostList } from "@/components/groups/PostList";
import { JoinRequestButton } from "@/components/groups/JoinRequestButton";
import { MemberManagement } from "@/components/groups/MemberManagement";
import { ApprovedMembersList } from "@/components/groups/ApprovedMembersList";
import { GroupNutzapButton } from "@/components/groups/GroupNutzapButton";
import { GroupNutzapTotal } from "@/components/groups/GroupNutzapTotal";
import { GroupNutzapList } from "@/components/groups/GroupNutzapList";
import { Users, Settings, Info, MessageSquare, CheckCircle, UserPlus, Clock, Pin, PinOff, Flag, Zap } from "lucide-react";
import { parseNostrAddress } from "@/lib/nostr-utils";
import Header from "@/components/ui/Header";
import { usePinnedGroups } from "@/hooks/usePinnedGroups";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

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

      <div className="relative mb-6">
        <div className="h-36 rounded-lg overflow-hidden mb-2 relative group">
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover object-center"
            onError={(e) => {
              e.currentTarget.src = "/placeholder-community.svg";
            }}
          />
        </div>

        <div className="flex flex-row items-start justify-between gap-4 mb-2">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold">{name}</h1>
            <p className="text-base mb-4">{description}</p>
          </div>
          <div className="flex items-center gap-2">
            {isModerator && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/group/${encodeURIComponent(groupId || '')}/settings`} className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Manage Group
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isOwner ? "Owner settings" : "Moderator settings"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <GroupNutzapTotal groupId={`34550:${parsedId?.pubkey}:${parsedId?.identifier}`} />
            {user && community && (
              <GroupNutzapButton
                groupId={`34550:${parsedId?.pubkey}:${parsedId?.identifier}`}
                ownerPubkey={community.pubkey}
                variant="outline"
                size="sm"
              />
            )}
          </div>
          {!isModerator && (
            <JoinRequestButton communityId={groupId || ''} isModerator={isModerator} />
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="md:flex md:justify-start">
          <TabsList className="mb-4 w-full md:w-auto flex">
            <TabsTrigger value="posts" className="flex-1 md:flex-none">
              <MessageSquare className="h-4 w-4 mr-2" />
              Posts
            </TabsTrigger>

            <TabsTrigger value="members" className="flex-1 md:flex-none">
              <Users className="h-4 w-4 mr-2" />
              Members
            </TabsTrigger>

            <TabsTrigger value="nutzaps">
              <Zap className="h-4 w-4 mr-2" />
              Nutzaps
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="posts" className="space-y-4">
          {/* Emphasize the create post form if user is logged in */}
          {user && (
            <div className="max-w-3xl mx-auto">
              <CreatePostForm communityId={groupId || ''} />
            </div>
          )}

          {/* Move toggle to top and align to the right for easy access */}
          <div className="flex items-center justify-end mb-4 gap-2 max-w-3xl mx-auto">
            <div className="flex items-center space-x-2">
              <Switch
                id="approved-only"
                checked={showOnlyApproved}
                onCheckedChange={setShowOnlyApproved}
              />
              <Label htmlFor="approved-only" className="flex items-center cursor-pointer text-sm">
                <CheckCircle className="h-3.5 w-3.5 mr-1.5 text-green-500" />
                Show only approved posts
              </Label>
            </div>
          </div>

          {/* Center and limit width for better readability */}
          <div className="max-w-3xl mx-auto">
            <PostList
              communityId={groupId || ''}
              showOnlyApproved={showOnlyApproved}
              onPostCountChange={setCurrentPostCount}
            />
          </div>
        </TabsContent>

        <TabsContent value="nutzaps" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Group Nutzaps</h2>
            {user && community && (
              <GroupNutzapButton
                groupId={`34550:${parsedId?.pubkey}:${parsedId?.identifier}`}
                ownerPubkey={community.pubkey}
              />
            )}
          </div>
          <GroupNutzapList groupId={`34550:${parsedId?.pubkey}:${parsedId?.identifier}`} />
        </TabsContent>


        <TabsContent value="members" className="space-y-4">
          <div className="max-w-3xl mx-auto">
            {isModerator && (
              <div className="mb-6">
                <MemberManagement communityId={groupId || ''} isModerator={isModerator} />
              </div>
            )}

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

              <ApprovedMembersList communityId={groupId || ''} />
            </div>
          </div>
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
