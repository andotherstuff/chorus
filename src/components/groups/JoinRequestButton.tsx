import { useState } from "react";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostr } from "@/hooks/useNostr";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApprovedMembers } from "@/hooks/useApprovedMembers";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, CheckCircle, Clock, XCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { KINDS } from "@/lib/nostr-kinds";

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
  const queryClient = useQueryClient();
  
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
        kinds: [KINDS.GROUP_JOIN_REQUEST],
        authors: [user.pubkey],
        "#a": [communityId]
      }], { signal });

      return events.length > 0 ? events[0] : null;
    },
    enabled: !!nostr && !!user && !!communityId,
  });

  // Check if user is already an approved member using the centralized hook
  const { isApprovedMember, isLoading: isCheckingApproval } = useApprovedMembers(communityId);
  const isUserApprovedMember = user ? isApprovedMember(user.pubkey) : false;
  
  // Check if user is in the declined list
  const { data: isDeclinedUser, isLoading: isCheckingDeclined } = useQuery({
    queryKey: ["declined-user", communityId, user?.pubkey],
    queryFn: async (c) => {
      if (!user) return false;
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{ 
        kinds: [KINDS.GROUP_DECLINED_MEMBERS_LIST], 
        "#d": [communityId],
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
        kind: KINDS.GROUP_JOIN_REQUEST,
        tags: [
          ["a", communityId],
        ],
        content: joinReason,
      });

      toast.success("Join request sent successfully!");
      handleOpenChange(false);

      // Invalidate relevant queries after 2 seconds to check for auto-approval
      setTimeout(() => {
        // Invalidate the approved members query to check if user was auto-approved
        queryClient.invalidateQueries({
          queryKey: ["approved-members-list", communityId]
        });
        
        // Invalidate the join request query to refresh the status
        queryClient.invalidateQueries({
          queryKey: ["join-request", communityId, user.pubkey]
        });
        
        // Invalidate the declined user query in case status changed
        queryClient.invalidateQueries({
          queryKey: ["declined-user", communityId, user.pubkey]
        });
      }, 2000);
    } catch (error) {
      console.error("Error sending join request:", error);
      toast.error("Failed to send join request. Please try again.");
    }
  };

  // If the user is a moderator, show a moderator badge instead of returning null
  if (isModerator && user) {
    return (
      <Button variant="outline" disabled className={cn("text-purple-600 border-purple-600 dark:text-purple-400 dark:border-purple-400 w-full h-full justify-start pl-3 text-xs", className)}>
        <Shield className="h-4 w-4 mr-1" />
        Moderator
      </Button>
    );
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
  if (isUserApprovedMember) {
    return (
      <Button variant="outline" disabled className={cn("text-green-600 border-green-600 dark:text-green-400 dark:border-green-400 w-full h-full justify-start pl-3 text-xs", className)}>
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
      <Button variant="outline" disabled className={cn("text-red-600 border-red-600 dark:text-red-400 dark:border-red-400 w-full h-full justify-start pl-3 text-xs", className)}>
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
