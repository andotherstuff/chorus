import { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useEnhancedNostr } from "@/components/EnhancedNostrProvider";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuthor } from "@/hooks/useAuthor";
import { toast } from "sonner";
import { ArrowLeft, Save, UserPlus, Users, Shield, Trash2, FileWarning, Upload, Loader2, Key, Settings, Lock, Unlock } from "lucide-react";
import type { NostrEvent } from "@nostrify/nostrify";
import type { Nip29Group } from "@/types/groups";
import Header from "@/components/ui/Header";
import { useNip29Group, useNip29GroupMembers } from "@/hooks/useNip29Groups";
import { Nip29MemberManagement } from "./Nip29MemberManagement";
import { Nip29ReportsList } from "./Nip29ReportsList";
import { Nip29InviteManagement } from "./Nip29InviteManagement";

interface Nip29GroupSettingsProps {
  groupId: string;
  relay: string;
}

export function Nip29GroupSettings({ groupId, relay }: Nip29GroupSettingsProps) {
  const location = useLocation();
  const { nostr } = useEnhancedNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploadingMedia } = useUploadFile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Get the tab parameter from URL
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabParam === 'reports' ? 'reports' : 
    tabParam === 'members' ? 'members' : 
    tabParam === 'invites' ? 'invites' :
    'general'
  );
  
  // Update active tab when URL parameters change
  useEffect(() => {
    const newTabParam = new URLSearchParams(location.search).get('tab');
    if (['reports', 'members', 'invites', 'general'].includes(newTabParam || '')) {
      setActiveTab(newTabParam || 'general');
    }
  }, [location.search]);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  // Fetch group data
  const { data: group, isLoading: isLoadingGroup } = useNip29Group(groupId, relay);
  const { data: membershipData, isLoading: isLoadingMembers } = useNip29GroupMembers(groupId, relay);

  // Handle group data changes
  useEffect(() => {
    if (group) {
      setName(group.name || "");
      setDescription(group.description || "");
      setImageUrl(group.image || "");
      setIsPrivate(!group.isPublic);
      setIsClosed(!group.isOpen);
    }
  }, [group]);

  const { members = [], admins = [], userRole } = membershipData || {};
  
  const isAdmin = userRole === 'admin';
  const isMember = userRole === 'member' || isAdmin;

  console.log("Current user pubkey:", user?.pubkey);
  console.log("User role in group:", userRole);
  console.log("Is admin:", isAdmin);

  // Handle media upload
  const handleMediaUpload = async (file: File) => {
    if (!file) return;
    
    // Check if it's an image, video, or audio
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    
    if (!isImage && !isVideo && !isAudio) {
      toast.error("Please select an image, video, or audio file");
      return;
    }

    // Check file size (e.g., 100MB limit for videos/audio, 10MB for images)
    const maxSize = (isVideo || isAudio) ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File size exceeds ${(isVideo || isAudio) ? '100MB' : '10MB'} limit`);
      return;
    }

    try {
      const [[_, url]] = await uploadFile(file);
      setImageUrl(url);
      const fileType = isVideo ? 'Video' : isAudio ? 'Audio' : 'Image';
      toast.success(`${fileType} uploaded successfully!`);
    } catch (error) {
      console.error("Error uploading media:", error);
      const fileType = isVideo ? 'video' : isAudio ? 'audio' : 'image';
      toast.error(`Failed to upload ${fileType}. Please try again.`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("You must be logged in to update group settings");
      return;
    }

    if (!isAdmin) {
      toast.error("Only group administrators can update group settings");
      return;
    }

    try {
      console.log('[NIP-29] Updating group metadata');
      
      // Create NIP-29 group edit metadata event (kind 9002)
      const tags: string[][] = [
        ["h", groupId], // Group identifier
        ["name", name],
        ["about", description]
      ];

      // Add image if provided
      if (imageUrl) {
        tags.push(["picture", imageUrl]);
      }

      // Add privacy settings
      if (isPrivate) {
        tags.push(["private", "add"]);
      } else {
        tags.push(["private", "remove"]);
      }

      if (isClosed) {
        tags.push(["closed", "add"]);
      } else {
        tags.push(["closed", "remove"]);
      }

      if (!nostr) {
        throw new Error("Nostr client not available");
      }

      const event = await user.signer.signEvent({
        kind: 9002, // GROUP_EDIT_METADATA
        tags,
        content: "",
        created_at: Math.floor(Date.now() / 1000),
      });

      await nostr.event(event, { relays: [relay] });

      // Invalidate relevant queries to update the UI
      queryClient.invalidateQueries({ queryKey: ["nip29-group", groupId, relay] });
      queryClient.invalidateQueries({ queryKey: ["nip29-groups"] });
      
      toast.success("Group settings updated successfully!");
      navigate(`/group/nip29/${relay}/${groupId}`);
    } catch (error) {
      console.error("Error updating group settings:", error);
      toast.error("Failed to update group settings. Please try again.");
    }
  };

  const handleAddAdmin = async (pubkey: string) => {
    if (!isAdmin) {
      toast.error("Only group administrators can add other admins");
      return;
    }

    if (!user) {
      toast.error("You must be logged in to add administrators");
      return;
    }

    if (!nostr) {
      toast.error("Nostr client not available");
      return;
    }

    try {
      console.log(`[NIP-29] Adding admin: ${pubkey}`);
      
      const event = await user.signer.signEvent({
        kind: 9006, // GROUP_SET_ROLES
        tags: [
          ["h", groupId],
          ["p", pubkey, "admin"]
        ],
        content: "",
        created_at: Math.floor(Date.now() / 1000),
      });

      await nostr.event(event, { relays: [relay] });

      // Invalidate relevant queries to update the UI
      queryClient.invalidateQueries({ queryKey: ["nip29-members", groupId, relay] });
      
      toast.success("Administrator added successfully!");
    } catch (error) {
      console.error("Error adding administrator:", error);
      toast.error("Failed to add administrator. Please try again.");
    }
  };

  const handleRemoveAdmin = async (pubkey: string) => {
    if (!isAdmin) {
      toast.error("Only group administrators can remove other admins");
      return;
    }

    if (pubkey === user?.pubkey) {
      toast.error("You cannot remove yourself as an administrator");
      return;
    }

    if (!user) {
      toast.error("You must be logged in to remove administrators");
      return;
    }

    if (!nostr) {
      toast.error("Nostr client not available");
      return;
    }

    try {
      console.log(`[NIP-29] Removing admin: ${pubkey}`);
      
      const event = await user.signer.signEvent({
        kind: 9006, // GROUP_SET_ROLES
        tags: [
          ["h", groupId],
          ["p", pubkey, "member"]
        ],
        content: "",
        created_at: Math.floor(Date.now() / 1000),
      });

      await nostr.event(event, { relays: [relay] });

      // Invalidate relevant queries to update the UI
      queryClient.invalidateQueries({ queryKey: ["nip29-members", groupId, relay] });
      
      toast.success("Administrator removed successfully!");
    } catch (error) {
      console.error("Error removing administrator:", error);
      toast.error("Failed to remove administrator. Please try again.");
    }
  };

  const handleRemoveMember = async (pubkey: string) => {
    if (!isAdmin) {
      toast.error("Only group administrators can remove members");
      return;
    }

    if (pubkey === user?.pubkey) {
      toast.error("You cannot remove yourself from the group");
      return;
    }

    if (!user) {
      toast.error("You must be logged in to remove members");
      return;
    }

    if (!nostr) {
      toast.error("Nostr client not available");
      return;
    }

    try {
      console.log(`[NIP-29] Removing member: ${pubkey}`);
      
      const event = await user.signer.signEvent({
        kind: 9001, // GROUP_REMOVE_USER
        tags: [
          ["h", groupId],
          ["p", pubkey]
        ],
        content: "",
        created_at: Math.floor(Date.now() / 1000),
      });

      await nostr.event(event, { relays: [relay] });

      // Invalidate relevant queries to update the UI
      queryClient.invalidateQueries({ queryKey: ["nip29-members", groupId, relay] });
      
      toast.success("Member removed successfully!");
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Failed to remove member. Please try again.");
    }
  };

  if (isLoadingGroup) {
    return (
      <div className="container mx-auto py-1 px-3 sm:px-4">
        <Header />
        <h1 className="text-2xl font-bold mb-4">Loading group settings...</h1>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="container mx-auto py-1 px-3 sm:px-4">
        <Header />
        <h1 className="text-2xl font-bold mb-4">Group not found</h1>
        <p>The group you're looking for doesn't exist or has been deleted.</p>
        <Button asChild className="mt-2">
          <Link to="/groups">Back to Groups</Link>
        </Button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-1 px-3 sm:px-4">
        <Header />
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p>You must be a group administrator to access group settings.</p>
        <Button asChild className="mt-2">
          <Link to={`/group/nip29/${encodeURIComponent(relay)}/${encodeURIComponent(groupId)}`}>Back to Group</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-1 px-3 sm:px-4">
      <Header />

      <div className="flex mb-6">
        <Button variant="ghost" asChild className="p-0 text-2xl">
          <Link to={`/group/nip29/${encodeURIComponent(relay)}/${encodeURIComponent(groupId)}`} className="flex flex-row items-center text-2xl font-bold">
            <ArrowLeft size={40} className="mr-3 w-10 h-10 shrink-0" />
            Back to Group
          </Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value);
        // Update URL query parameter without full page reload
        const newSearchParams = new URLSearchParams(location.search);
        if (value === 'general') {
          newSearchParams.delete('tab');
        } else {
          newSearchParams.set('tab', value);
        }
        const newUrl = `${location.pathname}${newSearchParams.toString() ? '?' + newSearchParams.toString() : ''}`;
        window.history.pushState(null, '', newUrl);
      }} className="w-full space-y-6">
        <div className="md:flex md:justify-start">
          <TabsList className="mb-4 w-full md:w-auto flex">
            <TabsTrigger value="general" className="flex-1 md:flex-none">
              <Settings className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="members" className="flex-1 md:flex-none">
                <Users className="h-4 w-4 mr-2" />
                Members
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="invites" className="flex-1 md:flex-none">
                <Key className="h-4 w-4 mr-2" />
                Invites
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="reports" className="flex-1 md:flex-none">
                <FileWarning className="h-4 w-4 mr-2" />
                Reports
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="general" className="space-y-6 mt-3">
          <form onSubmit={handleSubmit} className="w-full space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Update your group's basic information and privacy settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Group Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter group name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="media" className="flex items-center gap-2">
                    Group Media
                    {isUploadingMedia && <Loader2 className="h-4 w-4 animate-spin" />}
                  </Label>
                  
                  <div className="flex flex-col gap-4">
                    {/* Media upload button */}
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('media-upload')?.click()}
                        disabled={isUploadingMedia}
                        className="w-full sm:w-auto"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploadingMedia ? 'Uploading...' : 'Upload Media'}
                      </Button>
                      <input
                        id="media-upload"
                        type="file"
                        accept="image/*,video/*,audio/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleMediaUpload(file);
                          }
                        }}
                        className="hidden"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Supported: Images (max 10MB), videos and audio (max 100MB)
                      </p>
                    </div>

                    <div className="text-sm text-muted-foreground">or</div>

                    {/* URL input as fallback */}
                    <Input
                      id="image"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="Enter media URL"
                      disabled={isUploadingMedia}
                    />
                  </div>

                  {imageUrl && (
                    <div className="mt-4 rounded-lg overflow-hidden border max-w-full">
                      {/* Check if URL is likely a video */}
                      {imageUrl.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                        <video
                          src={imageUrl}
                          controls
                          className="w-full max-h-96 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        >
                          Your browser does not support the video tag.
                        </video>
                      ) : (
                        <img
                          src={imageUrl}
                          alt="Group preview"
                          className="w-full h-auto max-h-96 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter group description"
                    rows={4}
                  />
                </div>

                {/* Privacy Settings */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-medium">Privacy Settings</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="private">Private Group</Label>
                        <p className="text-sm text-muted-foreground">
                          Only members can read messages and see group content
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Lock className={`h-4 w-4 ${isPrivate ? 'text-red-500' : 'text-muted-foreground'}`} />
                        <Switch
                          id="private"
                          checked={isPrivate}
                          onCheckedChange={setIsPrivate}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="closed">Closed Group</Label>
                        <p className="text-sm text-muted-foreground">
                          Require invite codes or admin approval to join
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Unlock className={`h-4 w-4 ${isClosed ? 'text-orange-500' : 'text-muted-foreground'}`} />
                        <Switch
                          id="closed"
                          checked={isClosed}
                          onCheckedChange={setIsClosed}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <Button type="submit" disabled={isUploadingMedia}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Administrators section */}
            {isAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Shield className="h-5 w-5 mr-2" />
                      Group Administrators
                    </CardTitle>
                    <CardDescription>
                      Manage who can administer this group
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {admins.map((pubkey) => (
                        <AdminItem
                          key={pubkey}
                          pubkey={pubkey}
                          onRemove={() => handleRemoveAdmin(pubkey)}
                          isCurrentUser={user?.pubkey === pubkey}
                        />
                      ))}

                      {admins.length === 0 && (
                        <p className="text-muted-foreground">No administrators</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Users className="h-5 w-5 mr-2" />
                      Group Members
                    </CardTitle>
                    <CardDescription>
                      Promote members to administrators
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
                    ) : members.filter(pubkey => !admins.includes(pubkey)).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>No members to promote</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {members
                          .filter(pubkey => !admins.includes(pubkey)) // Only show non-admins
                          .map((pubkey) => (
                            <MemberItem
                              key={pubkey}
                              pubkey={pubkey}
                              onPromote={() => handleAddAdmin(pubkey)}
                              onRemove={() => handleRemoveMember(pubkey)}
                              isCurrentUser={user?.pubkey === pubkey}
                            />
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </form>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="members" className="mt-3">
            <Nip29MemberManagement groupId={groupId} relay={relay} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="invites" className="mt-3">
            <Nip29InviteManagement groupId={groupId} relay={relay} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="reports" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileWarning className="h-5 w-5 mr-2" />
                  Reports
                </CardTitle>
                <CardDescription>
                  Review and manage reported content in your group
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Nip29ReportsList groupId={groupId} relay={relay} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

interface AdminItemProps {
  pubkey: string;
  onRemove: () => void;
  isCurrentUser: boolean;
}

function AdminItem({ pubkey, onRemove, isCurrentUser }: AdminItemProps) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;

  const displayName = metadata?.name || pubkey.slice(0, 8);
  const profileImage = metadata?.picture;

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
            <span className="text-xs bg-purple-100 text-purple-600 rounded-full px-2 py-0.5">
              Administrator
            </span>
            {isCurrentUser && (
              <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                You
              </span>
            )}
          </div>
        </div>
      </div>
      {!isCurrentUser && (
        <Button
          variant="outline"
          size="sm"
          className="text-red-600"
          onClick={onRemove}
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
  onRemove: () => void;
  isCurrentUser: boolean;
}

function MemberItem({ pubkey, onPromote, onRemove, isCurrentUser }: MemberItemProps) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;

  const displayName = metadata?.name || pubkey.slice(0, 8);
  const profileImage = metadata?.picture;

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
      <div className="flex gap-2">
        {!isCurrentUser && (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600"
            onClick={onRemove}
            type="button"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Remove
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onPromote}
          disabled={isCurrentUser}
          type="button"
        >
          <UserPlus className="h-4 w-4 mr-1" />
          Make Admin
        </Button>
      </div>
    </div>
  );
}

