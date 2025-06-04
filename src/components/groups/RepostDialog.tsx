import { useState, useEffect } from "react";
import { useUserGroupsFiltered } from "@/hooks/useUserGroupsFiltered";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { NostrEvent } from "@nostrify/nostrify";
import { KINDS } from "@/lib/nostr-kinds";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Helper function to get community ID
const getCommunityId = (community: NostrEvent) => {
  const dTag = community.tags.find((tag) => tag[0] === "d");
  return `${KINDS.GROUP}:${community.pubkey}:${dTag ? dTag[1] : ""}`;
};

interface RepostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  post: NostrEvent & {
    approval?: {
      id: string;
      pubkey: string;
      created_at: number;
      autoApproved?: boolean;
      kind: number;
    };
  };
  sourceCommunityId: string;
}

export function RepostDialog({ isOpen, onClose, post, sourceCommunityId }: RepostDialogProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: userGroups, isLoading: isGroupsLoading } = useUserGroupsFiltered();
  const { mutateAsync: publishEvent } = useNostrPublish({
    invalidateQueries: [
      { queryKey: ["pending-posts"] },
      { queryKey: ["approved-posts"] }
    ]
  });

  // Reset selected group when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedGroupId("");
    }
  }, [isOpen]);

  // Filter out the source group to prevent reposting to the same group
  const availableGroups = userGroups?.allGroups.filter(group => {
    const groupId = getCommunityId(group);
    return groupId !== sourceCommunityId;
  }) || [];

  const handleRepost = async () => {
    if (!selectedGroupId) {
      toast.error("Please select a group to repost to");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Create a new post with the same content but for the selected group
      const repostEvent = {
        kind: KINDS.GROUP_POST,
        content: post.content,
        tags: [
          // Add selected group as the target
          ["a", selectedGroupId],
          // Add reference to the original post
          ["e", post.id, "", "mention"],
          // Add reference to the original author
          ["p", post.pubkey],
          // Add reference to the original source group
          ["r", sourceCommunityId],
          // Add repost tag to clearly mark this as a repost
          ["k", "repost"]
        ]
      };
      
      // Add any media tags from the original post
      post.tags
        .filter(tag => tag[0] === "media" || tag[0] === "imeta" || tag[0] === "image")
        .forEach(tag => {
          repostEvent.tags.push(tag);
        });
      
      // Add any hashtags from the original post
      post.tags
        .filter(tag => tag[0] === "t")
        .forEach(tag => {
          repostEvent.tags.push(tag);
        });

      await publishEvent(repostEvent);
      
      toast.success("Post has been reposted to the selected group");
      onClose();
    } catch (error) {
      console.error("Error reposting:", error);
      toast.error("Failed to repost. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Repost to Another Group</DialogTitle>
          <DialogDescription>
            Share this post to another group you belong to.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="group-select" className="text-sm font-medium">
                Select Group
              </label>
              
              {isGroupsLoading ? (
                <div className="h-10 w-full animate-pulse bg-muted rounded-md"></div>
              ) : availableGroups.length === 0 ? (
                <div className="text-muted-foreground text-sm p-2 border rounded-md">
                  You don't belong to any other groups. Join more groups to repost content.
                </div>
              ) : (
                <Select
                  value={selectedGroupId}
                  onValueChange={setSelectedGroupId}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full" id="group-select">
                    <SelectValue placeholder="Select a group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Your Groups</SelectLabel>
                      {availableGroups.map((group) => {
                        const groupId = getCommunityId(group);
                        const nameTag = group.tags.find((tag) => tag[0] === "name");
                        const name = nameTag ? nameTag[1] : "Unnamed Group";
                        
                        return (
                          <SelectItem key={groupId} value={groupId}>
                            {name}
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              
              <p className="text-xs text-muted-foreground mt-1">
                The post will appear as a new post in the selected group with reference to the original.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleRepost} 
            disabled={!selectedGroupId || isSubmitting || availableGroups.length === 0}
          >
            {isSubmitting ? "Reposting..." : "Repost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}