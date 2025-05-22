import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Create a global state for the join dialog
let globalSetJoinDialogOpen: ((value: boolean) => void) | null = null;
let globalSetCommunityId: ((value: string) => void) | null = null;
let globalSetJoinReason: ((value: string) => void) | null = null;
let globalPublishJoinRequest: (() => Promise<void>) | null = null;
let globalIsPending = false;

// JoinDialog component to be rendered at app root level
export function JoinDialog() {
  const [open, setOpen] = useState(false);
  const [communityId, setCommunityId] = useState("");
  const [joinReason, setJoinReason] = useState("");
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent, isPending } = useNostrPublish();

  // Set up global handlers
  useEffect(() => {
    globalSetJoinDialogOpen = setOpen;
    globalSetCommunityId = setCommunityId;
    globalSetJoinReason = setJoinReason;
    globalIsPending = isPending;

    globalPublishJoinRequest = async () => {
      if (!user) {
        toast.error("You must be logged in to request to join a group");
        return;
      }

      try {
        // Create join request event (kind 4552)
        await publishEvent({
          kind: 4552,
          tags: [
            ["a", communityId],
          ],
          content: joinReason,
        });

        toast.success("Join request sent successfully!");
        setOpen(false);
      } catch (error) {
        console.error("Error sending join request:", error);
        toast.error("Failed to send join request. Please try again.");
      }
    };

    return () => {
      globalSetJoinDialogOpen = null;
      globalSetCommunityId = null;
      globalSetJoinReason = null;
      globalPublishJoinRequest = null;
    };
  }, [user, publishEvent, isPending, communityId, joinReason]);

  const handleRequestJoin = async () => {
    if (globalPublishJoinRequest) {
      await globalPublishJoinRequest();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request to join this group</DialogTitle>
          <DialogDescription>
            Your request will be reviewed by the group moderators.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label htmlFor="join-reason" className="text-sm font-medium mb-2 block">
            Why do you want to join this group? (optional)
          </label>
          <Textarea
            id="join-reason"
            placeholder="Tell the moderators why you'd like to join..."
            value={joinReason}
            onChange={(e) => setJoinReason(e.target.value)}
            className="min-h-[100px]"
          />
        </div>

        <DialogFooter className="flex flex-col gap-2">
          <Button onClick={handleRequestJoin} disabled={isPending}>
            {isPending ? "Sending..." : "Send request"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// The menu item component to trigger the global dialog
export function JoinRequestMenuItem({ communityId }: { communityId: string }) {
  const handleOpenDialog = () => {
    if (globalSetJoinDialogOpen && globalSetCommunityId) {
      globalSetCommunityId(communityId);
      if (globalSetJoinReason) {
        globalSetJoinReason("");
      }
      globalSetJoinDialogOpen(true);
    } else {
      toast.error("Cannot open dialog. Please try again.");
    }
  };

  return (
    <DropdownMenuItem onSelect={(e) => {
      e.preventDefault();
      handleOpenDialog();
    }}>
      <UserPlus className="h-4 w-4 mr-2" />
      Request to join
    </DropdownMenuItem>
  );
}