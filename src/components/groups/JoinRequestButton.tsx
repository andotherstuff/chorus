import { useState } from "react";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, CheckCircle, Clock } from "lucide-react";

interface JoinRequestButtonProps {
  communityId: string;
}

export function JoinRequestButton({ communityId }: JoinRequestButtonProps) {
  const [open, setOpen] = useState(false);
  const [joinReason, setJoinReason] = useState("");
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent, isPending } = useNostrPublish();

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

  if (!user) {
    return (
      <Button variant="outline" disabled>
        <UserPlus className="h-4 w-4 mr-2" />
        Log in to join
      </Button>
    );
  }

  if (isCheckingRequest || isCheckingApproval) {
    return (
      <Button variant="outline" disabled>
        <Clock className="h-4 w-4 mr-2 animate-spin" />
        Checking status...
      </Button>
    );
  }

  if (isApprovedMember) {
    return (
      <Button variant="outline" disabled className="text-green-600 border-green-600">
        <CheckCircle className="h-4 w-4 mr-2" />
        Member
      </Button>
    );
  }

  if (existingRequest) {
    return (
      <Button variant="outline" disabled>
        <Clock className="h-4 w-4 mr-2" />
        Request pending
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="h-4 w-4 mr-2" />
          Request to join
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
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleRequestJoin} disabled={isPending}>
            {isPending ? "Sending..." : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}