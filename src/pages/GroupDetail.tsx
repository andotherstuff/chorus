import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useNostr } from "@/hooks/useNostr";
import { usePendingReplies } from "@/hooks/usePendingReplies";
import { usePendingPostsCount } from "@/hooks/usePendingPostsCount";
import { useOpenReportsCount } from "@/hooks/useOpenReportsCount";
import { usePendingJoinRequests } from "@/hooks/usePendingJoinRequests";
import { useGroupCustomization } from "@/hooks/useGroupCustomization";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import { CreatePostForm } from "@/components/groups/CreatePostForm";
import { PostList } from "@/components/groups/PostList";
import { JoinRequestButton } from "@/components/groups/JoinRequestButton";
import { SimpleMembersList } from "@/components/groups/SimpleMembersList";
import { GroupNutzapButton } from "@/components/groups/GroupNutzapButton";
import { GroupNutzapTotal } from "@/components/groups/GroupNutzapTotal";
import { GroupNutzapList } from "@/components/groups/GroupNutzapList";
import { Users, Settings, MessageSquare, CheckCircle, DollarSign, QrCode, FileText } from "lucide-react";
import { parseNostrAddress } from "@/lib/nostr-utils";
import Header from "@/components/ui/Header";
import { QRCodeModal } from "@/components/QRCodeModal";
import { CustomizationPreview } from "@/components/groups/CustomizationPreview";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const location = useLocation();
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const [parsedId, setParsedId] = useState<{ kind: number; pubkey: string; identifier: string } | null>(null);
  const [showOnlyApproved, setShowOnlyApproved] = useState(true);
  const [currentPostCount, setCurrentPostCount] = useState(0);
  const [activeTab, setActiveTab] = useState("posts");
  const [imageLoading, setImageLoading] = useState(true);
  const [showQRCode, setShowQRCode] = useState(false);

  
  const searchParams = new URLSearchParams(location.search);
  const reportId = searchParams.get('reportId');
  const hash = location.hash.replace('#', '');

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

  const isOwner = user && community && user.pubkey === community.pubkey;
  const isModerator = isOwner || (user && community?.tags
    .filter(tag => tag[0] === "p" && tag[3] === "moderator")
    .some(tag => tag[1] === user.pubkey));

  // Load group customization
  const { settings: customization, hasCustomization } = useGroupCustomization({
    communityPubkey: parsedId?.pubkey || '',
    communityIdentifier: parsedId?.identifier || '',
    enabled: !!parsedId
  });

  const { data: pendingPostsCount = 0 } = usePendingPostsCount(groupId || '');
  const { data: pendingReplies = [] } = usePendingReplies(groupId || '');
  const { data: openReportsCount = 0 } = useOpenReportsCount(groupId || '');
  const { pendingRequestsCount = 0 } = usePendingJoinRequests(groupId || '');
  const totalPendingCount = (pendingPostsCount || 0) + pendingReplies.length;

  // Set active tab based on URL hash only
  useEffect(() => {
    // Define valid tab values
    const validTabs = ["posts", "members", "ecash"];
    
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
  }, [hash]);

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

  const nameTag = community?.tags.find(tag => tag[0] === "name");
  const descriptionTag = community?.tags.find(tag => tag[0] === "description");
  const imageTag = community?.tags.find(tag => tag[0] === "image");
  const guidelinesTag = community?.tags.find(tag => tag[0] === "guidelines");

  const name = nameTag ? nameTag[1] : (parsedId?.identifier || "Unnamed Group");
  const description = descriptionTag ? descriptionTag[1] : "No description available";
  const image = imageTag ? imageTag[1] : undefined;
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

  if (isLoadingCommunity || !parsedId) {
    return (
      <div className="container mx-auto py-1 px-3 sm:px-4">
        <Header />
        <h1 className="text-2xl font-bold mb-4">Loading group...</h1>
        
        <div className="relative mb-6 mt-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Skeleton className="h-40 w-full rounded-lg mb-2" />
            </div>
            <div className="min-w-[140px]">
              <Skeleton className="h-10 w-full rounded-md mb-4" />
              <Skeleton className="h-10 w-full rounded-md" />
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

  if (!community) {
    return (
      <div className="container mx-auto py-1 px-3 sm:px-4">
        <h1 className="text-2xl font-bold mb-4">Group not found</h1>
        <p>The group you're looking for doesn't exist or has been deleted.</p>
        <Button asChild className="mt-2">
          <Link to="/groups">Back to Groups</Link>
        </Button>
      </div>
    );
  }

  // Apply customization class
  const containerClass = hasCustomization ? "group-customized" : "";
  const contentWidthClass = hasCustomization ? "custom-content-width" : "";

  return (
    <div className={`container mx-auto py-1 px-3 sm:px-4 ${containerClass}`}>
      <Header />

      <div className={`relative mb-6 mt-4 ${contentWidthClass}`}>
        {/* Custom Header Styles */}
        {(customization.headerStyle === 'banner' || !customization.headerStyle) && (
          <div className="flex gap-4">
            <div className="flex-1">
              <div className={`custom-banner rounded-lg overflow-hidden mb-2 relative ${customization.bannerImage ? '' : 'h-40'}`}>
                {imageLoading && (
                  <Skeleton className="absolute inset-0 w-full h-full z-10" />
                )}
                <img
                  src={customization.bannerImage || image}
                  alt={name}
                  className="w-full h-full object-cover object-center"
                  onLoad={() => setImageLoading(false)}
                  onError={(e) => {
                    setImageLoading(false);
                    e.currentTarget.src = "/placeholder-community.svg";
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col min-w-[140px] h-40 space-y-2 justify-between">
            {!isModerator ? (
              <>
                <Button
                  variant="outline"
                  size="default"
                  className={`w-full h-8 justify-start pl-3 ${hasCustomization ? 'custom-button-secondary' : ''}`}
                  onClick={() => setShowQRCode(true)}
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  QR Code
                </Button>
                {/* Make JoinRequestButton height consistent */}
                <div className="h-8">
                  <JoinRequestButton communityId={groupId || ''} isModerator={isModerator} />
                </div>
                {/* Add spacer to ensure buttons are distributed evenly */}
                <div className="flex-1" />
                {/* Ensure consistent height for GroupNutzapTotal */}
                <div className="h-8 flex items-center">
                  <GroupNutzapTotal groupId={`34550:${parsedId?.pubkey}:${parsedId?.identifier}`} />
                </div>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="default"
                  className={`w-full h-8 justify-start pl-3 ${hasCustomization ? 'custom-button-secondary' : ''}`}
                  onClick={() => setShowQRCode(true)}
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  QR Code
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button asChild variant="outline" size="default" className="relative h-8 w-full justify-start pl-3">
                        <Link 
                          to={`/group/${encodeURIComponent(groupId || '')}/settings${
                            openReportsCount > 0 ? '?tab=reports' : 
                            pendingRequestsCount > 0 ? '?tab=members' : ''
                          }`} 
                          className="flex items-center gap-2"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          <span>Manage Group</span>
                          {(openReportsCount > 0 || pendingRequestsCount > 0) && (
                            <Badge 
                              variant="destructive" 
                              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs z-10"
                            >
                              {(openReportsCount + pendingRequestsCount) > 99 ? '99+' : (openReportsCount + pendingRequestsCount)}
                            </Badge>
                          )}
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isOwner ? "Owner settings" : "Moderator settings"}
                      {openReportsCount > 0 && (
                        <div className="text-red-400 text-xs mt-1">
                          {openReportsCount} open report{openReportsCount !== 1 ? 's' : ''}
                        </div>
                      )}
                      {pendingRequestsCount > 0 && (
                        <div className="text-blue-400 text-xs mt-1">
                          {pendingRequestsCount} pending join request{pendingRequestsCount !== 1 ? 's' : ''}
                        </div>
                      )}
                      {(openReportsCount > 0 || pendingRequestsCount > 0) && (
                        <div className="text-xs mt-1 text-muted-foreground">
                          Click to review
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {/* Ensure consistent height for GroupNutzapButton */}
                <div className="h-8">
                  {user && community && (
                    <GroupNutzapButton
                      groupId={`34550:${parsedId?.pubkey}:${parsedId?.identifier}`}
                      ownerPubkey={community.pubkey}
                      variant="outline"
                      className="w-full h-8"
                    />
                  )}
                </div>
                {/* Ensure consistent height for GroupNutzapTotal */}
                <div className="h-8 flex items-center">
                  <GroupNutzapTotal groupId={`34550:${parsedId?.pubkey}:${parsedId?.identifier}`} />
                </div>
              </>
            )}
          </div>
        </div>
        )}
        
        {/* Title and description moved below image and buttons, full width */}
        <div className="w-full mt-4">
          <div className="flex items-center gap-4 mb-2">
            {customization.logoImage && (
              <img 
                src={customization.logoImage} 
                alt={`${name} logo`}
                className={`w-12 h-12 rounded-full object-cover custom-logo`}
              />
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{name}</h1>
              {customization.showGroupStats && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {currentPostCount} posts
                  </Badge>
                </div>
              )}
            </div>
          </div>
          {hasGuidelines && (
            <div className="mb-2">
              <Link 
                to={`/group/${encodeURIComponent(groupId || '')}/guidelines`}
                className={`text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 text-sm font-medium inline-flex items-center gap-1 ${hasCustomization ? 'custom-accent' : ''}`}
              >
                <FileText className="h-4 w-4" />
                Community Guidelines
              </Link>
            </div>
          )}
          <p className="text-base text-muted-foreground">{description}</p>
        </div>
        
        {/* Alternative header styles */}
        {customization.headerStyle === 'minimal' && (
          <div className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {customization.logoImage && (
                  <img 
                    src={customization.logoImage} 
                    alt={`${name} logo`}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                )}
                <h1 className="text-xl font-bold">{name}</h1>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={hasCustomization ? 'custom-button-secondary' : ''}
                  onClick={() => setShowQRCode(true)}
                >
                  <QrCode className="h-4 w-4" />
                </Button>
                <JoinRequestButton communityId={groupId || ''} isModerator={isModerator} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{description}</p>
          </div>
        )}
        
        {customization.headerStyle === 'overlay' && customization.bannerImage && (
          <div className="relative custom-banner rounded-lg overflow-hidden mb-4">
            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-end">
              <div className="p-6 text-white w-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {customization.logoImage && (
                      <img 
                        src={customization.logoImage} 
                        alt={`${name} logo`}
                        className="w-12 h-12 rounded-full object-cover border-2 border-white"
                      />
                    )}
                    <div>
                      <h1 className="text-2xl font-bold">{name}</h1>
                      <p className="text-sm opacity-90">{description}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                      onClick={() => setShowQRCode(true)}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <JoinRequestButton communityId={groupId || ''} isModerator={isModerator} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {customization.headerStyle === 'split' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                {customization.logoImage && (
                  <img 
                    src={customization.logoImage} 
                    alt={`${name} logo`}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                )}
                <h1 className="text-2xl font-bold">{name}</h1>
              </div>
              <p className="text-muted-foreground">{description}</p>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className={hasCustomization ? 'custom-button-secondary' : ''}
                  onClick={() => setShowQRCode(true)}
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  QR Code
                </Button>
                <JoinRequestButton communityId={groupId || ''} isModerator={isModerator} />
              </div>
            </div>
            {(customization.bannerImage || image) && (
              <div className="custom-banner rounded-lg overflow-hidden">
                <img
                  src={customization.bannerImage || image}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Only show default header if using banner style */}
      {customization.headerStyle !== 'banner' && (
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <div className="h-40 rounded-lg overflow-hidden mb-2 relative">
              {imageLoading && (
                <Skeleton className="absolute inset-0 w-full h-full z-10" />
              )}
              <img
                src={image}
                alt={name}
                className="w-full h-full object-cover object-center"
                onLoad={() => setImageLoading(false)}
                onError={(e) => {
                  setImageLoading(false);
                  e.currentTarget.src = "/placeholder-community.svg";
                }}
              />
            </div>
          </div>
          <div className="flex flex-col min-w-[140px] h-40 space-y-2 justify-between">
            {/* Buttons for non-banner styles */}
          </div>
        </div>
      )}

      <Tabs value={activeTab} defaultValue="posts" onValueChange={(value) => {
        setActiveTab(value);
        // Update URL hash without full page reload
        window.history.pushState(null, '', `#${value}`);
      }} className="w-full">
        <div className="md:flex md:justify-start">
          <TabsList className="mb-4 w-full md:w-auto grid grid-cols-3 gap-0">
            <TabsTrigger value="posts" className="flex items-center justify-center">
              <MessageSquare className="h-4 w-4 mr-2" />
              Posts
            </TabsTrigger>

            <TabsTrigger value="members" className="flex items-center justify-center">
              <Users className="h-4 w-4 mr-2" />
              Members
            </TabsTrigger>

            <TabsTrigger value="ecash" className="flex items-center justify-center">
              <DollarSign className="h-4 w-4 mr-2" />
              Send eCash
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="posts" className="space-y-4">
          {/* Show customization preview for group owners */}
          <div className={`${contentWidthClass} mx-auto`}>
            <CustomizationPreview 
              groupId={groupId || ''}
              hasCustomization={hasCustomization}
              isOwner={isOwner}
            />
          </div>

          {user && (
            <div className={`${contentWidthClass} mx-auto`}>
              <CreatePostForm communityId={groupId || ''} />
            </div>
          )}

          <div className={`flex items-center justify-end mb-4 gap-2 ${contentWidthClass} mx-auto`}>
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

          <div className={`${contentWidthClass} mx-auto`}>
            <PostList
              communityId={groupId || ''}
              showOnlyApproved={showOnlyApproved}
              onPostCountChange={setCurrentPostCount}
              customization={customization}
            />
          </div>
        </TabsContent>

        <TabsContent value="ecash" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Group eCash</h2>
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
          <div className={`${contentWidthClass} mx-auto`}>
            <SimpleMembersList communityId={groupId || ''} />
          </div>
        </TabsContent>
      </Tabs>

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQRCode}
        onClose={() => setShowQRCode(false)}
        profileUrl={`${window.location.origin}/group/${encodeURIComponent(groupId || '')}`}
        displayName={name}
      />
    </div>
  );
}

