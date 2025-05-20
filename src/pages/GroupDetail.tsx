import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { LoginArea } from "@/components/auth/LoginArea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuthor } from "@/hooks/useAuthor";
import { CreatePostForm } from "@/components/groups/CreatePostForm";
import { PostList } from "@/components/groups/PostList";
import { JoinRequestButton } from "@/components/groups/JoinRequestButton";
import { MemberManagement } from "@/components/groups/MemberManagement";
import { ApprovedMembersList } from "@/components/groups/ApprovedMembersList";
import { Users, Settings, Info, MessageSquare, CheckCircle, UserPlus } from "lucide-react";
import { parseNostrAddress } from "@/lib/nostr-utils";

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const [parsedId, setParsedId] = useState<{ kind: number; pubkey: string; identifier: string } | null>(null);
  const [showOnlyApproved, setShowOnlyApproved] = useState(true);
  
  useEffect(() => {
    if (groupId) {
      const parsed = parseNostrAddress(decodeURIComponent(groupId));
      if (parsed) {
        setParsedId(parsed);
      }
    }
  }, [groupId]);
  
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
      
      if (events.length === 0) throw new Error("Community not found");
      return events[0];
    },
    enabled: !!nostr && !!parsedId,
  });
  
  // Check if user is a moderator
  const isModerator = user && community?.tags
    .filter(tag => tag[0] === "p" && tag[3] === "moderator")
    .some(tag => tag[1] === user.pubkey);
  
  // Extract community data from tags
  const nameTag = community?.tags.find(tag => tag[0] === "name");
  const descriptionTag = community?.tags.find(tag => tag[0] === "description");
  const imageTag = community?.tags.find(tag => tag[0] === "image");
  const moderatorTags = community?.tags.filter(tag => tag[0] === "p" && tag[3] === "moderator") || [];
  
  const name = nameTag ? nameTag[1] : (parsedId?.identifier || "Unnamed Community");
  const description = descriptionTag ? descriptionTag[1] : "No description available";
  const image = imageTag ? imageTag[1] : "/placeholder-community.jpg";
  
  if (isLoadingCommunity || !parsedId) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Loading community...</h1>
      </div>
    );
  }
  
  if (!community) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Community not found</h1>
        <p>The community you're looking for doesn't exist or has been deleted.</p>
        <Button asChild className="mt-4">
          <Link to="/groups">Back to Communities</Link>
        </Button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link to="/groups" className="text-sm text-muted-foreground hover:underline mb-2 inline-block">
            ← Back to Communities
          </Link>
          <h1 className="text-3xl font-bold">{name}</h1>
        </div>
        <div className="flex items-center gap-4">
          <JoinRequestButton communityId={groupId || ''} />
          <div className="ml-auto">
            <LoginArea />
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="md:col-span-2">
          <div className="h-60 rounded-lg overflow-hidden mb-4">
            <img 
              src={image} 
              alt={name} 
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = "https://placehold.co/1200x400?text=Community";
              }}
            />
          </div>
          <p className="text-lg mb-6">{description}</p>
        </div>
        
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <UserPlus className="h-5 w-5 mr-2" />
                Join this group
              </CardTitle>
              <CardDescription>
                Request to join this community to participate in discussions
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-4">
              <JoinRequestButton communityId={groupId || ''} />
            </CardContent>
            {isModerator && (
              <CardFooter>
                <Button asChild variant="outline" className="w-full">
                  <Link to={`/group/${encodeURIComponent(groupId || '')}/settings`}>
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Community
                  </Link>
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
      
      <Separator className="my-6" />
      
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="posts">
            <MessageSquare className="h-4 w-4 mr-2" />
            Posts
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="h-4 w-4 mr-2" />
            Members
          </TabsTrigger>
          <TabsTrigger value="about">
            <Info className="h-4 w-4 mr-2" />
            About
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="posts" className="space-y-6">
          {user && (
            <CreatePostForm communityId={groupId || ''} />
          )}
          
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
          
          <PostList communityId={groupId || ''} showOnlyApproved={showOnlyApproved} />
        </TabsContent>
        
        <TabsContent value="members" className="space-y-6">
          {isModerator && (
            <MemberManagement communityId={groupId || ''} isModerator={isModerator} />
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Moderators
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {moderatorTags.map((tag) => (
                    <ModeratorItem key={tag[1]} pubkey={tag[1]} />
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <ApprovedMembersList communityId={groupId || ''} />
          </div>
        </TabsContent>
        
        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle>About this Community</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium">Description</h3>
                <p>{description}</p>
              </div>
              
              <div>
                <h3 className="font-medium">Created by</h3>
                <ModeratorItem pubkey={community.pubkey} isCreator />
              </div>
              
              <div>
                <h3 className="font-medium">Created at</h3>
                <p>{new Date(community.created_at * 1000).toLocaleString()}</p>
              </div>
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
        <Avatar>
          <AvatarImage src={profileImage} />
          <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{displayName}</p>
          {isCreator && <p className="text-xs text-muted-foreground">Creator</p>}
        </div>
      </div>
    </Link>
  );
}