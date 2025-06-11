import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useNostr } from "@/hooks/useNostr";
import { useEnhancedNostr } from "@/components/EnhancedNostrProvider";
import { usePendingReplies } from "@/hooks/usePendingReplies";
import { usePendingPostsCount } from "@/hooks/usePendingPostsCount";
import { useOpenReportsCount } from "@/hooks/useOpenReportsCount";
import { usePendingJoinRequests } from "@/hooks/usePendingJoinRequests";
import { useApprovedMembers } from "@/hooks/useApprovedMembers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RichText } from "@/components/ui/RichText";
import { KINDS } from "@/lib/nostr-kinds";

import { CreatePostForm } from "@/components/groups/CreatePostForm";
import { PostList } from "@/components/groups/PostList";
import { JoinRequestButton } from "@/components/groups/JoinRequestButton";
import { SimpleMembersList } from "@/components/groups/SimpleMembersList";
import { GroupNutzapButton } from "@/components/groups/GroupNutzapButton";
import { GroupNutzapTotal } from "@/components/groups/GroupNutzapTotal";
import { GroupNutzapList } from "@/components/groups/GroupNutzapList";
import { Users, Settings, MessageSquare, CheckCircle, DollarSign, QrCode, FileText, Shield, UserPlus, Save, Trash2, FileWarning, MessageCircle, Server } from "lucide-react";
import { parseNostrAddress } from "@/lib/nostr-utils";
import Header from "@/components/ui/Header";
import { SafeImage } from "@/components/ui/SafeImage";
import type { Group } from "@/types/groups";
import { parseGroupRouteId, parseGroup, parseNip29Group } from "@/lib/group-utils";
import { MemberManagement } from "@/components/groups/MemberManagement";
import { ReportsList } from "@/components/groups/ReportsList";
import { Nip29ChatMessages } from "@/components/groups/Nip29ChatMessages";
import { useAuthor } from "@/hooks/useAuthor";
import { toast } from "sonner";
import { NostrEvent } from "@nostrify/nostrify";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { QRCodeModal } from "@/components/QRCodeModal";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGroup } from "@/hooks/useGroup";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { useIsGroupDeleted } from "@/hooks/useGroupDeletionRequests";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, AlertCircle } from "lucide-react";
import { GroupAvatar } from "@/components/ui/GroupAvatar";
import { useNip29GroupCreator } from "@/hooks/useNip29GroupCreator";

export default function GroupDetail() {
  const { groupId, relay } = useParams<{ groupId: string; relay?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { nostr } = useNostr();
  const { nostr: enhancedNostr } = useEnhancedNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const [parsedRouteId, setParsedRouteId] = useState<ReturnType<typeof parseGroupRouteId>>(null);
  const [showOnlyApproved, setShowOnlyApproved] = useState(true);
  const [currentPostCount, setCurrentPostCount] = useState(0);
  const [activeTab, setActiveTab] = useState("posts");
  const [imageLoading, setImageLoading] = useState(true);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  
  // Reduced logging for performance

  // Form state for management tab
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formGuidelines, setFormGuidelines] = useState("");
  const [formModerators, setFormModerators] = useState<string[]>([]);

  const searchParams = new URLSearchParams(location.search);
  const reportId = searchParams.get('reportId');
  const hash = location.hash.replace('#', '');

  useEffect(() => {
    if (groupId) {
      // Handle NIP-29 routes directly
      if (relay) {
        // This is a NIP-29 route: /group/nip29/:relay/:groupId
        const decodedRelay = decodeURIComponent(relay);
        const decodedGroupId = decodeURIComponent(groupId);
        // NIP-29 route detected
        setParsedRouteId({
          type: "nip29",
          groupId: decodedGroupId,
          relay: decodedRelay
        });
      } else {
        // This is a legacy route: /group/:groupId (could be NIP-72 or encoded NIP-29)
        const parsed = parseGroupRouteId(decodeURIComponent(groupId));
        // Legacy route parsed
        setParsedRouteId(parsed);
      }
    }
  }, [groupId, relay]);

  const { data: groupData, isLoading: isLoadingCommunity } = useQuery({
    queryKey: ["group", parsedRouteId],
    queryFn: async (c) => {
      if (!parsedRouteId) throw new Error("Invalid group ID");

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      if (parsedRouteId.type === "nip72") {
        // Fetch NIP-72 community
        const events = await nostr.query([{
          kinds: [KINDS.GROUP],
          authors: [parsedRouteId.pubkey!],
          "#d": [parsedRouteId.identifier!]
        }], { signal });

        if (events.length === 0) throw new Error("Community not found");
        return parseGroup(events[0]);
      } else if (parsedRouteId.type === "nip29") {
        // Fetch NIP-29 group metadata from the specific relay
        const relayUrl = parsedRouteId.relay!;
        const groupId = parsedRouteId.groupId!;
        
        // Fetching NIP-29 group from relay
        
        // Fetch both group metadata and member list
        if (!enhancedNostr) throw new Error("Enhanced Nostr provider not available");
        
        const [groupEvents, memberEvents] = await Promise.all([
          enhancedNostr.query([{
            kinds: [39000], // NIP-29 relay-generated group metadata
            "#d": [groupId]
          }], { 
            signal,
            relays: [relayUrl]
          }),
          enhancedNostr.query([{
            kinds: [39002], // NIP-29 relay-generated member lists
            "#d": [groupId]
          }], { 
            signal,
            relays: [relayUrl]
          })
        ]);

        if (groupEvents.length === 0) throw new Error("Group not found");
        
        const group = parseNip29Group(groupEvents[0], relayUrl);
        if (!group) throw new Error("Failed to parse group");
        
        // Parse member list if available
        if (memberEvents.length > 0) {
          const memberEvent = memberEvents[0];
          const memberPubkeys = memberEvent.tags
            .filter(tag => tag[0] === "p" && tag[1])
            .map(tag => tag[1]);
          
          // Separate admins from regular members
          const adminTags = memberEvent.tags.filter(tag => 
            tag[0] === "p" && tag[3] === "admin"
          );
          const adminPubkeys = adminTags.map(tag => tag[1]);
          
          group.members = memberPubkeys;
          group.admins = adminPubkeys;
          
          // Group loaded with members and admins
        }
        
        return group;
      }
      
      throw new Error("Unknown group type");
    },
    enabled: !!nostr && !!enhancedNostr && !!parsedRouteId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Check if group has been deleted
  const { isDeleted: isGroupDeleted, deletionRequest } = useIsGroupDeleted(
    parsedRouteId?.type === "nip72" ? groupId : undefined
  );

  // Get approved members using the centralized hook
  const { approvedMembers } = useApprovedMembers(groupId || '');

  // For NIP-29 groups, find the actual creator
  const { data: creatorInfo } = useNip29GroupCreator(
    parsedRouteId?.type === "nip29" ? parsedRouteId.groupId : undefined,
    parsedRouteId?.type === "nip29" ? parsedRouteId.relay : undefined
  );

  // Determine ownership based on group type
  const isOwner = user && groupData && (
    parsedRouteId?.type === "nip29" 
      ? (creatorInfo?.creatorPubkey === user.pubkey)
      : (user.pubkey === groupData.pubkey)
  );
  
  // Get the actual owner pubkey for eCash
  const ownerPubkey = parsedRouteId?.type === "nip29"
    ? (creatorInfo?.creatorPubkey || groupData?.pubkey || '')
    : (groupData?.pubkey || '');
  
  // Get moderators/admins based on group type
  const moderators = groupData?.type === "nip72" 
    ? groupData.moderators 
    : groupData?.admins || [];
  const isModerator = isOwner || (user && moderators.includes(user.pubkey));

  // Initialize form state from group data
  useEffect(() => {
    if (groupData) {
      setFormName(groupData.name || "");
      setFormDescription(groupData.description || "");
      setFormImageUrl(groupData.image || "");
      
      // Guidelines are stored in tags for NIP-72
      if (groupData.type === "nip72" && groupData.tags) {
        const guidelinesTag = groupData.tags.find(tag => tag[0] === "guidelines");
        setFormGuidelines(guidelinesTag ? guidelinesTag[1] : "");
      } else {
        setFormGuidelines("");
      }

      // Set moderators based on group type
      const modPubkeys = groupData.type === "nip72" 
        ? [...groupData.moderators] 
        : [...groupData.admins];

      if (!modPubkeys.includes(groupData.pubkey)) {
        modPubkeys.push(groupData.pubkey);
      }

      const uniqueModPubkeys = [...new Set(modPubkeys)];

      setFormModerators(uniqueModPubkeys);
    }
  }, [groupData]);

  // Handler to ensure unapproved posts are visible when user posts
  const handlePostSuccess = () => {
    // If the user is not an approved member or moderator, show all posts
    if (user && !isModerator && approvedMembers && !approvedMembers.includes(user.pubkey)) {
      setShowOnlyApproved(false);
    }
  };

  const { data: pendingPostsCount = 0 } = usePendingPostsCount(groupId || '');
  const { data: pendingReplies = [] } = usePendingReplies(groupId || '');
  const { data: openReportsCount = 0 } = useOpenReportsCount(groupId || '');
  const { pendingRequestsCount = 0 } = usePendingJoinRequests(groupId || '');
  const totalPendingCount = (pendingPostsCount || 0) + pendingReplies.length;

  // Handler functions for management
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("You must be logged in to update group settings");
      return;
    }

    // NIP-29 groups cannot be updated through this interface
    if (parsedRouteId?.type === "nip29") {
      toast.error("NIP-29 groups cannot be updated through this interface");
      return;
    }

    if (!parsedRouteId || parsedRouteId.type !== "nip72" || !groupData) {
      toast.error("Invalid group data");
      return;
    }

    const parsedId = { 
      pubkey: parsedRouteId.pubkey!, 
      identifier: parsedRouteId.identifier! 
    };
    
    // Create a mock community event from groupData for compatibility
    const communityEvent = {
      pubkey: groupData.pubkey,
      tags: groupData.tags || []
    } as NostrEvent;
    const originalModPubkeys = communityEvent.tags
      .filter(tag => tag[0] === "p")
      .map(tag => tag[1]);

    const moderatorsChanged = formModerators.some(mod => !originalModPubkeys.includes(mod)) ||
                             originalModPubkeys.some(mod => !formModerators.includes(mod));

    if (moderatorsChanged && !isOwner) {
      toast.error("Only the group owner can add or remove moderators");
      return;
    }

    if (!isModerator && !isOwner) {
      toast.error("You must be a moderator or the group owner to update group settings");
      return;
    }

    if (!parsedRouteId) {
      toast.error("Invalid group ID");
      return;
    }

    try {
      // Create a new tags array with only unique tag types
      const tags: string[][] = [];

      // Always include identifier
      if (parsedRouteId.type === "nip72") {
        tags.push(["d", parsedRouteId.identifier!]);
      }

      // Add form values
      tags.push(["name", formName]);
      tags.push(["description", formDescription]);

      // Only add guidelines if there's content
      if (formGuidelines) {
        tags.push(["guidelines", formGuidelines]);
      }

      // Handle image separately to preserve dimensions if they exist
      if (formImageUrl) {
        const originalImageTag = communityEvent.tags.find(tag => tag[0] === "image");
        if (originalImageTag && originalImageTag.length > 2) {
          tags.push(["image", formImageUrl, originalImageTag[2]]);
        } else {
          tags.push(["image", formImageUrl]);
        }
      }

      // Preserve other tag types (except for name, description, guidelines, d, image, and p)
      const preservedTagTypes = ["name", "description", "guidelines", "d", "image", "p"];
      for (const tag of communityEvent?.tags || []) {
        if (!preservedTagTypes.includes(tag[0])) {
          tags.push([...tag]);
        }
      }

      // Add moderators
      const allModerators = [...new Set([...formModerators, communityEvent.pubkey])];

      for (const mod of allModerators) {
        const originalModTag = communityEvent.tags.find(tag =>
          tag[0] === "p" && tag[1] === mod
        );

        if (originalModTag && originalModTag.length > 2 && originalModTag[2]) {
          tags.push(["p", mod, originalModTag[2], "moderator"]);
        } else {
          tags.push(["p", mod, "", "moderator"]);
        }
      }

      await publishEvent({
        kind: KINDS.GROUP,
        tags,
        content: "",
      });

      // Invalidate relevant queries to update the UI
      queryClient.invalidateQueries({ queryKey: ["community-settings", parsedId?.pubkey, parsedId?.identifier] });
      queryClient.invalidateQueries({ queryKey: ["community", parsedId?.pubkey, parsedId?.identifier] });
      queryClient.invalidateQueries({ queryKey: ["user-groups", user?.pubkey] });

      toast.success("Group settings updated successfully!");
    } catch (error) {
      console.error("Error updating community settings:", error);
      toast.error("Failed to update group settings. Please try again.");
    }
  };

  const handleAddModerator = async (pubkey: string) => {
    if (!isOwner) {
      toast.error("Only the group owner can add moderators");
      return;
    }

    // NIP-29 groups cannot be updated through this interface
    if (parsedRouteId?.type === "nip29") {
      toast.error("NIP-29 groups cannot be updated through this interface");
      return;
    }

    if (!parsedRouteId || parsedRouteId.type !== "nip72" || !groupData) {
      toast.error("Invalid group data");
      return;
    }

    const parsedId = { 
      pubkey: parsedRouteId.pubkey!, 
      identifier: parsedRouteId.identifier! 
    };

    if (!formModerators.includes(pubkey)) {
      try {
        const updatedModerators = [...formModerators, pubkey];
        const communityEvent = {
          pubkey: groupData.pubkey,
          tags: groupData.tags || []
        } as NostrEvent;

        // Create a new tags array with only unique tag types
        const tags: string[][] = [];

        // Always include identifier
        if (parsedId) {
          tags.push(["d", parsedId.identifier]);
        }

        // Preserve existing tags except for p and d tags
        const tagTypesToExclude = ["p", "d"];
        for (const tag of communityEvent?.tags || []) {
          if (!tagTypesToExclude.includes(tag[0])) {
            // Only add this tag if we haven't already added a tag of this type
            if (!tags.some(existingTag => existingTag[0] === tag[0])) {
              tags.push([...tag]);
            }
          }
        }

        // Add all moderators including the new one
        const uniqueModPubkeys = [...new Set(updatedModerators)];
        for (const mod of uniqueModPubkeys) {
          const originalModTag = communityEvent?.tags.find(tag =>
            tag[0] === "p" && tag[1] === mod
          );
          if (originalModTag && originalModTag.length > 2 && originalModTag[2]) {
            tags.push(["p", mod, originalModTag[2], "moderator"]);
          } else {
            tags.push(["p", mod, "", "moderator"]);
          }
        }

        await publishEvent({
          kind: KINDS.GROUP,
          tags,
          content: "",
        });

        setFormModerators(uniqueModPubkeys);

        // Invalidate relevant queries to update the UI
        queryClient.invalidateQueries({ queryKey: ["community-settings", parsedId?.pubkey, parsedId?.identifier] });
        queryClient.invalidateQueries({ queryKey: ["community", parsedId?.pubkey, parsedId?.identifier] });
        queryClient.invalidateQueries({ queryKey: ["user-groups", user?.pubkey] });

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

    // NIP-29 groups cannot be updated through this interface
    if (parsedRouteId?.type === "nip29") {
      toast.error("NIP-29 groups cannot be updated through this interface");
      return;
    }

    if (!parsedRouteId || parsedRouteId.type !== "nip72" || !groupData) {
      toast.error("Invalid group data");
      return;
    }

    const parsedId = { 
      pubkey: parsedRouteId.pubkey!, 
      identifier: parsedRouteId.identifier! 
    };

    if (groupData && groupData.pubkey === pubkey) {
      toast.error("Cannot remove the group owner");
      return;
    }
    try {
      // Create a new tags array with only unique tag types
      const tags: string[][] = [];

      // Always include identifier
      if (parsedId) {
        tags.push(["d", parsedId.identifier]);
      }

      // Track which tag types we've already added
      const addedTagTypes = new Set(["d"]);

      // Add all tags except the moderator to be removed
      const communityEvent = {
        pubkey: groupData.pubkey,
        tags: groupData.tags || []
      } as NostrEvent;
      
      for (const tag of communityEvent.tags) {
        // Skip the moderator we're removing
        if (tag[0] === "p" && tag[1] === pubkey) {
          continue;
        }

        // Skip duplicate tag types
        if (addedTagTypes.has(tag[0])) {
          continue;
        }

        // Add the tag and mark type as added
        tags.push([...tag]);
        addedTagTypes.add(tag[0]);
      }

      await publishEvent({
        kind: KINDS.GROUP,
        tags,
        content: "",
      });
      setFormModerators(formModerators.filter(mod => mod !== pubkey));

      // Invalidate relevant queries to update the UI
      queryClient.invalidateQueries({ queryKey: ["community-settings", parsedId?.pubkey, parsedId?.identifier] });
      queryClient.invalidateQueries({ queryKey: ["community", parsedId?.pubkey, parsedId?.identifier] });
      queryClient.invalidateQueries({ queryKey: ["user-groups", user?.pubkey] });

      toast.success("Moderator removed successfully!");
    } catch (error) {
      console.error("Error removing moderator:", error);
      toast.error("Failed to remove moderator. Please try again.");
    }
  };

  const handleDeleteGroup = async () => {
    if (!isOwner) {
      toast.error("Only the group owner can delete the group");
      return;
    }

    if (!groupData || !parsedRouteId || parsedRouteId.type !== "nip72") {
      toast.error("Group information not available");
      return;
    }

    try {
      // Create a kind 5 deletion event referencing the group
      // Include both 'a' tag (addressable event) and 'e' tag (event ID) for maximum relay compatibility
      await publishEvent({
        kind: KINDS.DELETION,
        tags: [
          ["a", `${KINDS.GROUP}:${groupData.pubkey}:${parsedRouteId.identifier}`],
          ["e", groupData.id],
          ["k", KINDS.GROUP.toString()]
        ],
        content: "Requesting deletion of this group",
      });

      toast.success("Group deletion requested successfully!");
      
      // Navigate back to groups page after successful deletion request
      navigate("/groups");
    } catch (error) {
      console.error("Error requesting group deletion:", error);
      toast.error("Failed to request group deletion. Please try again.");
    }
  };

  // Set active tab based on URL hash only
  useEffect(() => {
    // Define valid tab values - include chat for NIP-29 groups
    const validTabs = parsedRouteId?.type === "nip29" 
      ? ["posts", "chat", "members", "ecash", "manage"]
      : ["posts", "members", "ecash", "manage"];

    if (hash && validTabs.includes(hash)) {
      setActiveTab(hash);
    }
    // If the hash references an invalid tab, default to "posts"
    else if (hash) {
      // Only update if not already on posts tab to avoid unnecessary re-renders
      if (activeTab !== "posts") {
        setActiveTab("posts");
      }
    }
    // Only set these fallbacks on initial mount to avoid constantly resetting
    else if (!activeTab || !validTabs.includes(activeTab)) {
      setActiveTab("posts");
    }

    // Deliberately not including activeTab in the dependencies to prevent loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, parsedRouteId?.type]);

  // Handle initial load for special cases (reports, pending items) without affecting normal tab operation
  useEffect(() => {
    // Only run once on mount and if hash is not already set
    if (!hash) {
      // For backward compatibility, try to handle old parameters
      if (reportId && isModerator) {
        setActiveTab("posts");
      }
      else if (isModerator && totalPendingCount > 0) {
        setActiveTab("posts");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Extract display values from group data
  const name = groupData?.name || "Unnamed Group";
  const description = groupData?.description || "No description available";
  const image = groupData?.image;
  
  // Guidelines are stored in tags for NIP-72
  const guidelinesTag = groupData?.type === "nip72" && groupData?.tags 
    ? groupData.tags.find(tag => tag[0] === "guidelines")
    : null;
  const hasGuidelines = guidelinesTag && guidelinesTag[1].trim().length > 0;

  useEffect(() => {
    if (name && name !== "Unnamed Group") {
      document.title = `+chorus - ${name}`;
    } else {
      document.title = "+chorus";
    }
    return () => {
      document.title = "+chorus";
    };
  }, [name]);

  // Reset image loading state when image URL changes
  useEffect(() => {
    setImageLoading(true);
  }, [image]);

  if (isLoadingCommunity || !parsedRouteId) {
    return (
      <div className="container mx-auto py-1 px-3 sm:px-4">
        <Header />
        <h1 className="text-2xl font-bold mb-4">Loading group...</h1>

        <div className="relative mb-6 mt-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Skeleton className="h-40 w-full rounded-lg mb-2" />
            </div>
            <div className="min-w-[140px] flex flex-col justify-start">
              <Skeleton className="h-8 w-full rounded-md mb-2" />
              <Skeleton className="h-8 w-full rounded-md mb-2" />
            </div>
          </div>

          <div className="w-full mt-4">
            <Skeleton className="h-8 w-3/4 rounded-md mb-2" />
            <Skeleton className="h-4 w-full rounded-md mb-1" />
            <Skeleton className="h-4 w-5/6 rounded-md mb-1" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  if (!groupData) {
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

  // Show deletion notice if group has been deleted
  if (isGroupDeleted && deletionRequest) {
    return (
      <div className="container mx-auto py-1 px-3 sm:px-4">
        <Header />
        
        <div className="max-w-3xl mx-auto mt-8">
          <Alert className="border-destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <div className="font-semibold">This group has been deleted</div>
              <p>
                The group owner has requested deletion of this group on{" "}
                {new Date(deletionRequest.deletionEvent.created_at * 1000).toLocaleDateString()}.
              </p>
              {deletionRequest.reason && (
                <p className="text-sm text-muted-foreground">
                  <strong>Reason:</strong> {deletionRequest.reason}
                </p>
              )}
              <div className="pt-2">
                <Button asChild>
                  <Link to="/groups">Browse Other Groups</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-1 px-3 sm:px-4">
      <Header />

      <div className="relative mb-6 mt-4 max-w-3xl mx-auto">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="h-40 rounded-lg overflow-hidden mb-2 relative">
              {imageLoading && (
                <Skeleton className="absolute inset-0 w-full h-full z-10" />
              )}
              {/* Check if the image URL is likely a video */}
              {image && image.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                <video
                  src={image}
                  className="w-full h-full object-cover object-center"
                  autoPlay
                  muted
                  loop
                  playsInline
                  onLoadedData={() => setImageLoading(false)}
                  onError={(e) => {
                    setImageLoading(false);
                    // Fall back to placeholder if video fails
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.innerHTML = '<img src="/placeholder-community.svg" class="w-full h-full object-cover object-center" />';
                    }
                  }}
                />
              ) : (
                <SafeImage
                  src={image}
                  alt={name}
                  className="w-full h-full object-cover object-center"
                  fallbackSrc="/placeholder-community.svg"
                  onLoadSuccess={() => setImageLoading(false)}
                  onLoadError={() => setImageLoading(false)}
                />
              )}
            </div>
          </div>

          <div className="flex flex-col min-w-[140px] h-40 space-y-2">
            <div className="h-8">
              <JoinRequestButton communityId={groupId || ''} isModerator={isModerator || false} />
            </div>
            {/* Ensure consistent height for GroupNutzapButton */}
            <div className="h-8">
              {user && groupData && (
                <GroupNutzapButton
                  groupId={groupData.id}
                  ownerPubkey={ownerPubkey}
                  variant="outline"
                  className="w-full h-full"
                  groupType={parsedRouteId?.type === "nip29" ? "nip29" : "nip72"}
                  relayUrl={parsedRouteId?.type === "nip29" ? parsedRouteId.relay : undefined}
                />
              )}
            </div>
            {/* Ensure consistent height for GroupNutzapTotal - always show for all users */}
            <div className="h-8 flex items-center">
              <GroupNutzapTotal 
                groupId={groupData?.id || groupId || ''}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="w-full mt-4">
          <div className="flex items-center mb-2">
            <h1 className="text-2xl font-bold">{name}</h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 ml-2"
                    onClick={() => setShowQRCode(true)}
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Share group QR code
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {hasGuidelines && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 ml-1"
                      onClick={() => setShowGuidelines(true)}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Community guidelines
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex items-center mb-3">
            <span className="text-sm text-muted-foreground mr-2 whitespace-nowrap">Sent to the group</span>
            <GroupNutzapTotal
              groupId={groupData?.id || groupId || ''}
              className="w-auto max-w-[180px]"
            />
          </div>
          {parsedRouteId?.type === "nip29" && parsedRouteId.relay && (
            <div className="flex items-center gap-2 mb-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Relay: {(() => {
                  try {
                    const url = new URL(parsedRouteId.relay);
                    return url.hostname;
                  } catch {
                    return parsedRouteId.relay;
                  }
                })()}
              </span>
            </div>
          )}
          <RichText className="text-xs text-muted-foreground">{description}</RichText>
        </div>
      </div>

      <Tabs value={activeTab} defaultValue="posts" onValueChange={(value) => {
        setActiveTab(value);
        // Update URL hash without full page reload
        window.history.pushState(null, '', `#${value}`);
      }} className="w-full">
        <div className="flex justify-center">
          <TabsList className={`mb-4 w-full md:w-auto grid ${
            parsedRouteId?.type === "nip29" 
              ? (isModerator ? 'grid-cols-5' : 'grid-cols-4')
              : (isModerator ? 'grid-cols-4' : 'grid-cols-3')
          } gap-0`}>
            <TabsTrigger value="posts" className="flex items-center justify-center">
              <MessageSquare className="h-4 w-4 mr-1" />
              Posts
            </TabsTrigger>

            {parsedRouteId?.type === "nip29" && (
              <TabsTrigger value="chat" className="flex items-center justify-center">
                <MessageCircle className="h-4 w-4 mr-1" />
                Chat
              </TabsTrigger>
            )}

            <TabsTrigger value="members" className="flex items-center justify-center">
              <Users className="h-4 w-4 mr-1" />
              Members
            </TabsTrigger>

            <TabsTrigger value="ecash" className="flex items-center justify-center">
              <DollarSign className="h-4 w-4 mr-1" />
              Send eCash
            </TabsTrigger>

            {isModerator && (
              <TabsTrigger value="manage" className="flex items-center justify-center relative">
                <Settings className="h-4 w-4 mr-1" />
                Manage
                {(openReportsCount > 0 || pendingRequestsCount > 0) && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs z-10"
                  >
                    {(openReportsCount + pendingRequestsCount) > 99 ? '99+' : (openReportsCount + pendingRequestsCount)}
                  </Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="posts" className="space-y-4">
          {user && (
            <div className="max-w-3xl mx-auto">
              <CreatePostForm communityId={groupId || ''} onPostSuccess={handlePostSuccess} />
            </div>
          )}

          {parsedRouteId?.type === "nip72" && (
            <div className="flex items-center justify-between mb-4 gap-2 max-w-3xl mx-auto">
              {isModerator && pendingPostsCount > 0 && showOnlyApproved && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOnlyApproved(false)}
                  className="flex items-center gap-2"
                >
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  Review {pendingPostsCount} Pending {pendingPostsCount === 1 ? 'Post' : 'Posts'}
                </Button>
              )}
              <div className="flex items-center space-x-2">
                <Switch
                  id="approved-only"
                  checked={showOnlyApproved}
                  onCheckedChange={setShowOnlyApproved}
                />
                <Label htmlFor="approved-only" className="flex items-center cursor-pointer text-sm">
                  <CheckCircle className="h-3.5 w-3.5 mr-1 text-green-500" />
                  Show only approved posts
                </Label>
              </div>
            </div>
          )}

          <div className="max-w-3xl mx-auto">
            <PostList
              communityId={groupId || ''}
              showOnlyApproved={parsedRouteId?.type === "nip72" ? showOnlyApproved : false}
              onPostCountChange={setCurrentPostCount}
            />
          </div>
        </TabsContent>

        {parsedRouteId?.type === "nip29" && (
          <TabsContent value="chat" className="space-y-4">
            <div className="max-w-3xl mx-auto">
              {parsedRouteId.groupId && parsedRouteId.relay && (
                <Nip29ChatMessages
                  groupId={parsedRouteId.groupId}
                  relayUrl={parsedRouteId.relay}
                />
              )}
            </div>
          </TabsContent>
        )}

        <TabsContent value="ecash" className="space-y-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Group eCash</h2>
              {user && groupData && (
                <div className="flex-shrink-0">
                  <GroupNutzapButton
                    groupId={groupData.id}
                    ownerPubkey={ownerPubkey}
                    className="w-auto"
                    groupType={parsedRouteId?.type === "nip29" ? "nip29" : "nip72"}
                    relayUrl={parsedRouteId?.type === "nip29" ? parsedRouteId.relay : undefined}
                  />
                </div>
              )}
            </div>
            <GroupNutzapList groupId={groupData?.id || groupId || ''} />
          </div>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <div className="max-w-3xl mx-auto">
            <SimpleMembersList communityId={
              parsedRouteId?.type === 'nip29' 
                ? `nip29:${encodeURIComponent(parsedRouteId.relay!)}:${parsedRouteId.groupId}`
                : groupId || ''
            } />
          </div>
        </TabsContent>

        {isModerator && (
          <TabsContent value="manage" className="space-y-4">
            <div className="max-w-3xl mx-auto">
              <Tabs defaultValue={isOwner ? "general" : "member-management"} className="w-full space-y-6">
                <TabsList className="grid grid-cols-3 mb-4">
                  <TabsTrigger value="general" className="flex items-center gap-2" disabled={!isOwner}>
                    <Shield className="h-4 w-4" />
                    General {!isOwner && <span className="text-xs">(Owner Only)</span>}
                  </TabsTrigger>
                  <TabsTrigger value="member-management" className="flex items-center gap-2 relative">
                    <Users className="h-4 w-4" />
                    Members
                    {pendingRequestsCount > 0 && (
                      <Badge
                        className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs bg-blue-500 hover:bg-blue-600 z-10"
                      >
                        {pendingRequestsCount > 99 ? '99+' : pendingRequestsCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="flex items-center gap-2 relative">
                    <FileWarning className="h-4 w-4" />
                    Reports
                    {openReportsCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs z-10"
                      >
                        {openReportsCount > 99 ? '99+' : openReportsCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-6 mt-3">
                  {!isOwner ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>General Settings</CardTitle>
                        <CardDescription>
                          Only the group owner can modify general settings
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-8 text-muted-foreground">
                          <Shield className="h-12 w-12 mx-auto mb-3 opacity-20" />
                          <p>You don't have permission to modify general settings.</p>
                          <p className="text-sm mt-2">Only the group owner can update the group's basic information, as these changes require updating the community definition event.</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <form onSubmit={handleSubmit} className="w-full space-y-8">
                      <Card>
                        <CardHeader>
                          <CardTitle>General Settings</CardTitle>
                          <CardDescription>
                            Update your group's basic information
                          </CardDescription>
                        </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Group Name</Label>
                          <Input
                            id="name"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder="Enter group name"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="image">Image URL</Label>
                          <Input
                            id="image"
                            value={formImageUrl}
                            onChange={(e) => setFormImageUrl(e.target.value)}
                            placeholder="Enter image URL"
                          />

                          {formImageUrl && (
                            <div className="mt-2 rounded-md overflow-hidden border w-full">
                              <SafeImage
                                src={formImageUrl}
                                alt="Group preview"
                                className="w-full h-auto"
                                fallbackSrc="/placeholder-community.svg"
                              />
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={formDescription}
                            onChange={(e) => setFormDescription(e.target.value)}
                            placeholder="Enter group description"
                            rows={4}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="guidelines">Community Guidelines (Optional)</Label>
                          <Textarea
                            id="guidelines"
                            value={formGuidelines}
                            onChange={(e) => setFormGuidelines(e.target.value)}
                            placeholder="Enter community guidelines"
                            rows={4}
                          />
                        </div>

                        <div className="mt-3 flex justify-between">
                          {isOwner && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" type="button">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Group
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Group</AlertDialogTitle>
                                  <AlertDialogDescription className="space-y-2">
                                    <p>
                                      Are you sure you want to request deletion of this group? This action will:
                                    </p>
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                      <li>Submit a deletion request to the network</li>
                                      <li>Signal to relays that this group should be removed</li>
                                      <li>Make the group inaccessible to new users</li>
                                    </ul>
                                    <p className="text-sm font-medium text-destructive">
                                      Note: This is a request for deletion. Individual relays may choose whether to honor this request. This does not delete individual posts within the group.
                                    </p>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={handleDeleteGroup}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete Group
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          <Button type="submit">
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Moderators section - only shown to owners */}
                    {isOwner && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center">
                              <Shield className="h-5 w-5 mr-2" />
                              Group Owner & Moderators
                            </CardTitle>
                            <CardDescription>
                              As the group owner, you can manage who can moderate this group
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {/* Always display the owner first */}
                              {groupData && (
                                <ModeratorItem
                                  key={groupData.pubkey}
                                  pubkey={groupData.pubkey}
                                  isCreator={true}
                                  onRemove={() => {}} // Owner can't be removed
                                />
                              )}

                              {/* Then display all moderators who are not the owner */}
                              {formModerators
                                .filter(pubkey => pubkey !== groupData?.pubkey) // Filter out the owner
                                .map((pubkey) => (
                                  <ModeratorItem
                                    key={pubkey}
                                    pubkey={pubkey}
                                    isCreator={false}
                                    onRemove={() => handleRemoveModerator(pubkey)}
                                  />
                                ))
                              }

                              {formModerators.length === 0 && !groupData && (
                                <p className="text-muted-foreground">No moderators yet</p>
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
                              As the group owner, you can promote members to moderators
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            {approvedMembers.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                <p>No approved members yet</p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {approvedMembers
                                  .filter(pubkey => !formModerators.includes(pubkey)) // Only show non-moderators
                                  .map((pubkey) => (
                                    <MemberItem
                                      key={pubkey}
                                      pubkey={pubkey}
                                      onPromote={() => handleAddModerator(pubkey)}
                                      isOwner={isOwner}
                                    />
                                  ))
                                }
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                    </form>
                  )}
                </TabsContent>

                <TabsContent value="member-management" className="mt-3">
                  <MemberManagement communityId={groupId || ""} isModerator={isModerator || false} />
                </TabsContent>

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
                      <ReportsList communityId={groupId || ""} />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQRCode}
        onClose={() => setShowQRCode(false)}
        profileUrl={`${window.location.origin}/group/${encodeURIComponent(groupId || '')}`}
        displayName={name}
        title="Share Group"
        description={`Scan this QR code to view ${name}'s group`}
        downloadPrefix="group"
      />

      {/* Community Guidelines Modal */}
      <Dialog open={showGuidelines} onOpenChange={setShowGuidelines}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Community Guidelines</DialogTitle>
            <DialogDescription>
              Guidelines for {name}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="mt-4 max-h-[60vh] pr-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <RichText>{guidelinesTag?.[1] || "No guidelines available."}</RichText>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
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
          <Avatar className="rounded-md">
            {profileImage && <AvatarImage src={profileImage} />}
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
          <Avatar className="rounded-md">
            {profileImage && <AvatarImage src={profileImage} />}
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

