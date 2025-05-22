import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface JoinRequestMenuItemProps {
  communityId: string;
}

export function JoinRequestMenuItem({ communityId }: JoinRequestMenuItemProps) {
  const [open, setOpen] = useState(false);
  const [joinReason, setJoinReason] = useState("");
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent, isPending } = useNostrPublish();

  const handleOpenDialog = (e: React.MouseEvent) => {
    // Stop propagation to prevent the dropdown from closing
    e.preventDefault();
    e.stopPropagation();
    
    // Use setTimeout to open the dialog after the dropdown click event has been fully processed
    setTimeout(() => {
      setOpen(true);
    }, 100);
  };

  const handleRequestJoin = async () => {
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

  return (
    <>
      <DropdownMenuItem onSelect={(e) => {
        // Prevent the default onSelect behavior
        e.preventDefault();
        handleOpenDialog(e as unknown as React.MouseEvent); 
      }}>
        <UserPlus className="h-4 w-4 mr-2" />
        Request to join
      </DropdownMenuItem>

      {/* The Dialog is rendered at the root level to avoid dropdown-related conflicts */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onPointerDownOutside={(e) => { 
          // Prevent closing when clicking outside
          e.preventDefault();
        }}>
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
    </>
  );
}