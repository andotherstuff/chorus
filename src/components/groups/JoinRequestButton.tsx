import { useState } from "react";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, CheckCircle, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface JoinRequestButtonProps {
  communityId: string;
  isModerator?: boolean;
  initialOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function JoinRequestButton({ communityId, isModerator = false, initialOpen = false, onOpenChange, className }: JoinRequestButtonProps) {
  const [open, setOpen] = useState(initialOpen);
  const [joinReason, setJoinReason] = useState("");
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent, isPending } = useNostrPublish();
  
  const handleOpenChange = (newState: boolean) => {
    setOpen(newState);
    if (onOpenChange) {
      onOpenChange(newState);
    }
  };

  // Check if user has already requested to join
  const { data: existingRequest, isLoading: isCheckingRequest } = useQuery({
    queryKey: ["join-request", communityId, user?.pubkey],
    queryFn: async (c) => {
      if (!user) return null;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{
        kinds: [4552],
        authors: [user.pubkey],
        "#a": [communityId]
      }], { signal });

      return events.length > 0 ? events[0] : null;
    },
    enabled: !!nostr && !!user && !!communityId,
  });

  // Check if user is already an approved member
  const { data: isApprovedMember, isLoading: isCheckingApproval } = useQuery({
    queryKey: ["approved-member", communityId, user?.pubkey],
    queryFn: async (c) => {
      if (!user) return false;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{
        kinds: [14550],
        "#a": [communityId]
      }], { signal });

      // Check if any of the approval lists include the user's pubkey
      return events.some(event =>
        event.tags.some(tag => tag[0] === "p" && tag[1] === user.pubkey)
      );
    },
    enabled: !!nostr && !!user && !!communityId,
  });
  
  // Check if user is in the declined list
  const { data: isDeclinedUser, isLoading: isCheckingDeclined } = useQuery({
    queryKey: ["declined-user", communityId, user?.pubkey],
    queryFn: async (c) => {
      if (!user) return false;
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{ 
        kinds: [14551], 
        "#a": [communityId],
        "#p": [user.pubkey]
      }], { signal });
      
      return events.length > 0;
    },
    enabled: !!nostr && !!user && !!communityId,
  });

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
      handleOpenChange(false);
    } catch (error) {
      console.error("Error sending join request:", error);
      toast.error("Failed to send join request. Please try again.");
    }
  };

  // If the user is a moderator, don't show the join button at all
  if (isModerator) {
    return null;
  }

  if (!user) {
    return (
      <Button variant="outline" disabled className={cn("w-full h-full justify-start pl-3 text-xs", className)}>
        <UserPlus className="h-4 w-4 mr-1" />
        <span className="text-left">Log in to join</span>
      </Button>
    );
  }

  if (isCheckingRequest || isCheckingApproval || isCheckingDeclined) {
    return (
      <Button variant="outline" disabled className={cn("w-full h-full justify-start pl-3 text-xs", className)}>
        <Clock className="h-4 w-4 mr-1 animate-spin" />
        Checking status...
      </Button>
    );
  }

  // If user is in both approved and declined lists, treat them as approved
  if (isApprovedMember) {
    return (
      <Button variant="outline" disabled className={cn("text-green-600 border-green-600 w-full h-full justify-start pl-3 text-xs", className)}>
        <CheckCircle className="h-4 w-4 mr-1" />
        Member
      </Button>
    );
  }

  if (existingRequest) {
    return (
      <Button variant="outline" disabled className={cn("w-full h-full justify-start pl-3 text-xs", className)}>
        <Clock className="h-4 w-4 mr-1" />
        Request pending
      </Button>
    );
  }
  
  if (isDeclinedUser) {
    return (
      <Button variant="outline" disabled className={cn("text-red-600 border-red-600 w-full h-full justify-start pl-3 text-xs", className)}>
        <XCircle className="h-4 w-4 mr-1" />
        Request declined
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className={cn("w-full h-full justify-start pl-3 text-xs", className)}>
          <UserPlus className="h-4 w-4 mr-1" />
          Join
        </Button>
      </DialogTrigger>
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

        <DialogFooter className="flex flex-col  gap-2">
          <Button onClick={handleRequestJoin} disabled={isPending}>
            {isPending ? "Sending..." : "Send request"}
          </Button>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
