import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useNostr } from "@/hooks/useNostr";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthor } from "@/hooks/useAuthor";
import { toast } from "sonner";
import { ArrowLeft, Save, UserPlus, Users, Shield, Trash2 } from "lucide-react";
import { parseNostrAddress } from "@/lib/nostr-utils";
import { NostrEvent } from "@nostrify/nostrify";


export default function GroupSettings() {
  const { groupId } = useParams<{ groupId: string }>();
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const navigate = useNavigate();
  const [parsedId, setParsedId] = useState<{ kind: number; pubkey: string; identifier: string } | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [moderators, setModerators] = useState<string[]>([]);
  
  useEffect(() => {
    if (groupId) {
      const parsed = parseNostrAddress(decodeURIComponent(groupId));
      if (parsed) {
        setParsedId(parsed);
      }
    }
  }, [groupId]);
  
  // Query for community details
  const { data: community, isLoading: isLoadingCommunity } = useQuery<NostrEvent>({
    queryKey: ["community-settings", parsedId?.pubkey, parsedId?.identifier],
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
    enabled: !!nostr && !!parsedId
  });
  
  // Query for approved members
  const { data: approvedMembersEvents, isLoading: isLoadingMembers } = useQuery({
    queryKey: ["approved-members-settings", groupId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      const events = await nostr.query([{ 
        kinds: [14550],
        "#a": [groupId || ""],
        limit: 50,
      }], { signal });
      
      return events;
    },
    enabled: !!nostr && !!groupId,
  });

  // Handle community data changes
  useEffect(() => {
    if (community) {
      // Initialize form with current values
      const communityEvent = community as NostrEvent;
      const nameTag = communityEvent.tags.find(tag => tag[0] === "name");
      const descriptionTag = communityEvent.tags.find(tag => tag[0] === "description");
      const imageTag = communityEvent.tags.find(tag => tag[0] === "image");
      
      const modTags = communityEvent.tags.filter(tag => 
        tag[0] === "p" && (
          (tag.length > 3 && tag[3] === "moderator") ||
          (communityEvent.kind === 34550)
        )
      );
      
      setName(nameTag ? nameTag[1] : "");
      setDescription(descriptionTag ? descriptionTag[1] : "");
      setImageUrl(imageTag ? imageTag[1] : "");
      
      const modPubkeys = modTags.map(tag => tag[1]);
      
      if (!modPubkeys.includes(communityEvent.pubkey)) {
        modPubkeys.push(communityEvent.pubkey);
      }
      
      const uniqueModPubkeys = [...new Set(modPubkeys)];
      
      setModerators(uniqueModPubkeys);
    }
  }, [community]);
  
  const approvedMembers = approvedMembersEvents?.flatMap(event => 
    event.tags.filter(tag => tag[0] === "p").map(tag => tag[1])
  ) || [];
  
  const uniqueApprovedMembers = [...new Set(approvedMembers)];
  
  const isModerator = user && moderators.includes(user.pubkey);
  const isOwner = Boolean(user && community && user.pubkey === (community as NostrEvent).pubkey);
  
  console.log("Current user pubkey:", user?.pubkey);
  console.log("Community creator pubkey:", community?.pubkey);
  console.log("Is owner:", isOwner);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("You must be logged in to update community settings");
      return;
    }
    
    if (!parsedId) {
      toast.error("Invalid community ID");
      return;
    }
    
    const communityEvent = community as NostrEvent;
    const originalModPubkeys = communityEvent.tags
      .filter(tag => tag[0] === "p")
      .map(tag => tag[1]);
    
    const moderatorsChanged = moderators.some(mod => !originalModPubkeys.includes(mod)) || 
                             originalModPubkeys.some(mod => !moderators.includes(mod));
    
    if (moderatorsChanged && !isOwner) {
      toast.error("Only the group owner can add or remove moderators");
      return;
    }
    
    if (!isModerator && !isOwner) {
      toast.error("You must be a moderator or the group owner to update community settings");
      return;
    }
    
    try {
      const tags: string[][] = [];
      tags.push(["d", parsedId.identifier]);
      tags.push(["name", name]);
      tags.push(["description", description]);
      
      if (imageUrl) {
        const originalImageTag = communityEvent.tags.find(tag => tag[0] === "image");
        if (originalImageTag && originalImageTag.length > 2) {
          tags.push(["image", imageUrl, originalImageTag[2]]);
        } else {
          tags.push(["image", imageUrl]);
        }
      }
      
      communityEvent.tags.forEach(tag => {
        if (!["p", "d", "name", "description", "image"].includes(tag[0])) {
          tags.push([...tag]); 
        }
      });
      
      const allModerators = [...new Set([...moderators, communityEvent.pubkey])];
      
      allModerators.forEach(mod => {
        const originalModTag = communityEvent.tags.find(tag => 
          tag[0] === "p" && tag[1] === mod
        );
        
        if (originalModTag && originalModTag.length > 2 && originalModTag[2]) {
          tags.push(["p", mod, originalModTag[2], "moderator"]);
        } else {
          tags.push(["p", mod, "", "moderator"]);
        }
      });
      
      await publishEvent({
        kind: 34550,
        tags,
        content: "",
      });
      
      toast.success("Community settings updated successfully!");
      navigate(`/group/${encodeURIComponent(groupId || "")}`);
    } catch (error) {
      console.error("Error updating community settings:", error);
      toast.error("Failed to update community settings. Please try again.");
    }
  };
  
  const handleAddModerator = async (pubkey: string) => {
    if (!isOwner) {
      toast.error("Only the group owner can add moderators");
      return;
    }
    
    if (!moderators.includes(pubkey)) {
      try {
        const updatedModerators = [...moderators, pubkey];
        const tags: string[][] = [];
        if (parsedId) {
          tags.push(["d", parsedId.identifier]);
        }
        const communityEvent = community as NostrEvent;
        communityEvent?.tags.forEach(tag => {
          if (tag[0] !== "p" && tag[0] !== "d") {
            tags.push([...tag]);
          }
        });
        
        const uniqueModPubkeys = [...new Set(updatedModerators)];
        uniqueModPubkeys.forEach(mod => {
          const originalModTag = communityEvent?.tags.find(tag => 
            tag[0] === "p" && tag[1] === mod
          );
          if (originalModTag && originalModTag.length > 2 && originalModTag[2]) {
            tags.push(["p", mod, originalModTag[2], "moderator"]);
          } else {
            tags.push(["p", mod, "", "moderator"]);
          }
        });
        
        await publishEvent({
          kind: 34550,
          tags,
          content: "",
        });
        
        setModerators(uniqueModPubkeys);
        toast.success("Moderator added successfully!");
      } catch (error) {
        console.error("Error adding moderator:", error);
        toast.error("Failed to add moderator. Please try again.");
      }
    } else {
      toast.info("This user is already a moderator.");
    }
  };
  
  const handleRemoveModerator = async (pubkey: string) => {
    if (!isOwner) {
      toast.error("Only the group owner can remove moderators");
      return;
    }
    const communityEvent = community as NostrEvent;
    if (community && communityEvent.pubkey === pubkey) {
      toast.error("Cannot remove the group owner");
      return;
    }
    try {
      const tags: string[][] = [];
      communityEvent.tags.forEach(tag => {
        if (tag[0] === "p" && tag[1] === pubkey) {
          return;
        }
        tags.push([...tag]);
      });
      console.log(`Removing moderator: ${pubkey}`);
      console.log("Updated tags:", tags);
      await publishEvent({
        kind: 34550,
        tags,
        content: "",
      });
      setModerators(moderators.filter(mod => mod !== pubkey));
      toast.success("Moderator removed successfully!");
    } catch (error) {
      console.error("Error removing moderator:", error);
      toast.error("Failed to remove moderator. Please try again.");
    }
  };
  
  if (isLoadingCommunity) {
    return (
      <div className="container mx-auto py-4 px-6"> {/* Changed padding */}
        <h1 className="text-2xl font-bold mb-4">Loading community settings...</h1>
      </div>
    );
  }
  
  if (!community) {
    return (
      <div className="container mx-auto py-4 px-6"> {/* Changed padding */}
        <h1 className="text-2xl font-bold mb-4">Community not found</h1>
        <p>The community you're looking for doesn't exist or has been deleted.</p>
        <Button asChild className="mt-4">
          <Link to="/groups">Back to Communities</Link>
        </Button>
      </div>
    );
  }
  
  if (!isModerator && !isOwner) {
    return (
      <div className="container mx-auto py-4 px-6"> {/* Changed padding */}
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p>You must be a moderator or the group owner to access community settings.</p>
        <Button asChild className="mt-4">
          <Link to={`/group/${encodeURIComponent(groupId || "")}`}>Back to Community</Link>
        </Button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-4 px-6"> {/* Changed padding */}
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="sm" asChild className="mr-2">
          <Link to={`/group/${encodeURIComponent(groupId || "")}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Community
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Community Settings</h1>
      </div>
      
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          {isOwner && (
            <TabsTrigger value="moderators">Moderators</TabsTrigger>
          )}
        </TabsList>
        
        <form onSubmit={handleSubmit}>
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Update your community's basic information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Community Name</Label>
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Enter community name"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder="Enter community description"
                    rows={4}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="image">Image URL</Label>
                  <Input 
                    id="image" 
                    value={imageUrl} 
                    onChange={(e) => setImageUrl(e.target.value)} 
                    placeholder="Enter image URL"
                  />
                  
                  {imageUrl && (
                    <div className="mt-2 rounded-md overflow-hidden border w-full max-w-xs">
                      <img 
                        src={imageUrl} 
                        alt="Community preview" 
                        className="w-full h-auto"
                        onError={(e) => {
                          e.currentTarget.src = "https://placehold.co/400x200?text=Invalid+Image";
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="mt-4 p-3 bg-muted rounded-md">
                  <h3 className="text-sm font-medium mb-2">Current Community Information</h3>
                  <p className="text-xs text-muted-foreground mb-1">
                    <span className="font-medium">ID:</span> {parsedId?.identifier}
                  </p>
                  <p className="text-xs text-muted-foreground mb-1">
                    <span className="font-medium">Created by:</span> {(community as NostrEvent)?.pubkey.slice(0, 8)}...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Created at:</span> {new Date((community as NostrEvent)?.created_at * 1000).toLocaleString()}
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="ml-auto">
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="moderators">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    Group Owner & Moderators
                  </CardTitle>
                  <CardDescription>
                    {isOwner 
                      ? "As the group owner, you can manage who can moderate this community"
                      : "Only the group owner can add or remove moderators"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Always display the owner first */}
                    {community && (
                      <ModeratorItem 
                        key={(community as NostrEvent).pubkey} 
                        pubkey={(community as NostrEvent).pubkey} 
                        isCreator={true}
                        onRemove={() => {}} // Owner can't be removed
                      />
                    )}
                    
                    {/* Then display all moderators who are not the owner */}
                    {moderators
                      .filter(pubkey => pubkey !== (community as NostrEvent)?.pubkey) // Filter out the owner
                      .map((pubkey) => (
                        <ModeratorItem 
                          key={pubkey} 
                          pubkey={pubkey} 
                          isCreator={false}
                          onRemove={() => handleRemoveModerator(pubkey)}
                        />
                      ))
                    }
                    
                    {moderators.length === 0 && !community && (
                      <p className="text-muted-foreground">No moderators yet</p>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                </CardFooter>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Community Members
                  </CardTitle>
                  <CardDescription>
                    {isOwner 
                      ? "As the group owner, you can promote members to moderators"
                      : "Only the group owner can promote members to moderators"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingMembers ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between p-2 border rounded-md">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div>
                              <Skeleton className="h-4 w-32 mb-1" />
                            </div>
                          </div>
                          <Skeleton className="h-9 w-20" />
                        </div>
                      ))}
                    </div>
                  ) : uniqueApprovedMembers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>No approved members yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {uniqueApprovedMembers
                        .filter(pubkey => !moderators.includes(pubkey)) // Only show non-moderators
                        .map((pubkey) => (
                          <MemberItem 
                            key={pubkey} 
                            pubkey={pubkey} 
                            onPromote={() => handleAddModerator(pubkey)}
                            isOwner={isOwner}
                          />
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </form>
      </Tabs>

    </div>
  );
}

interface ModeratorItemProps {
  pubkey: string;
  isCreator?: boolean;
  onRemove: () => void;
}

function ModeratorItem({ pubkey, isCreator = false, onRemove }: ModeratorItemProps) {
  const author = useAuthor(pubkey);
  const { user } = useCurrentUser();
  const metadata = author.data?.metadata;
  
  const displayName = metadata?.name || pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  const isCurrentUser = user?.pubkey === pubkey;
  const isOwner = isCreator; // This is passed from the parent component
  
  return (
    <div className="flex items-center justify-between p-3 border rounded-md">
      <div className="flex items-center gap-3">
        <Link to={`/profile/${pubkey}`}>
          <Avatar>
            <AvatarImage src={profileImage} />
            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <div>
          <Link to={`/profile/${pubkey}`} className="font-medium hover:underline">
            {displayName}
          </Link>
          <div className="flex items-center gap-2">
            {isOwner ? (
              <span className="text-xs bg-purple-100 text-purple-600 rounded-full px-2 py-0.5">
                Group Owner
              </span>
            ) : (
              <span className="text-xs bg-blue-100 text-blue-600 rounded-full px-2 py-0.5">
                Moderator
              </span>
            )}
            {isCurrentUser && (
              <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                You
              </span>
            )}
          </div>
        </div>
      </div>
      {!isOwner && user && (
        <Button 
          variant="outline" 
          size="sm" 
          className="text-red-600"
          onClick={onRemove}
          disabled={!isCurrentUser && !user?.pubkey}
          title={isOwner ? "The group owner cannot be removed" : ""}
          type="button"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Remove
        </Button>
      )}
    </div>
  );
}

interface MemberItemProps {
  pubkey: string;
  onPromote: () => void;
  isOwner: boolean;
}

function MemberItem({ pubkey, onPromote, isOwner }: MemberItemProps) {
  const author = useAuthor(pubkey);
  const { user } = useCurrentUser();
  const metadata = author.data?.metadata;
  
  const displayName = metadata?.name || pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  const isCurrentUser = user?.pubkey === pubkey;
  
  return (
    <div className="flex items-center justify-between p-3 border rounded-md">
      <div className="flex items-center gap-3">
        <Link to={`/profile/${pubkey}`}>
          <Avatar>
            <AvatarImage src={profileImage} />
            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <div>
          <Link to={`/profile/${pubkey}`} className="font-medium hover:underline">
            {displayName}
          </Link>
          {isCurrentUser && (
            <span className="ml-2 text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
              You
            </span>
          )}
        </div>
      </div>
      <Button 
        variant="outline" 
        size="sm"
        onClick={onPromote}
        disabled={!isOwner}
        title={!isOwner ? "Only the group owner can add moderators" : "This will immediately update the group"}
        type="button"
      >
        <UserPlus className="h-4 w-4 mr-1" />
        Make Moderator
      </Button>
    </div>
  );
}
