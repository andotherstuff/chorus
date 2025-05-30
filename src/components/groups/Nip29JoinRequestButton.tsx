import { useState } from "react";
import { useEnhancedNostr } from "@/components/EnhancedNostrProvider";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { UserPlus, Key, Users, MessageSquare } from "lucide-react";
import { useNip29GroupMembers } from "@/hooks/useNip29Groups";
import type { Nip29Group } from "@/types/groups";

interface Nip29JoinRequestButtonProps {
  group: Nip29Group;
  className?: string;
  children?: React.ReactNode;
  size?: "default" | "sm" | "lg";
}

export function Nip29JoinRequestButton({ 
  group, 
  className = "", 
  children, 
  size = "default"
}: Nip29JoinRequestButtonProps) {
  const { nostr } = useEnhancedNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const [isJoining, setIsJoining] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joinMessage, setJoinMessage] = useState("");

  // Check if user is already a member
  const { data: membershipData } = useNip29GroupMembers(group.groupId, group.relay);
  const { members = [], admins = [], userRole } = membershipData || {};
  
  const isAlreadyMember = user && (
    members.includes(user.pubkey) || 
    admins.includes(user.pubkey) ||
    userRole === 'member' || 
    userRole === 'admin'
  );

  const handleJoinRequest = async () => {
    if (!user) {
      toast.error("You must be logged in to join a group");
      return;
    }

    if (isAlreadyMember) {
      toast.info("You are already a member of this group");
      return;
    }

    // For closed groups, require invite code
    if (!group.isOpen && !inviteCode.trim()) {
      setShowJoinForm(true);
      return;
    }

    setIsJoining(true);
    try {
      console.log(`[NIP-29] Joining group ${group.groupId}`);
      
      const tags: string[][] = [
        ["h", group.groupId]
      ];

      // Add invite code if provided (required for closed groups)
      if (inviteCode.trim()) {
        tags.push(["code", inviteCode.trim()]);
      }

      // Create NIP-29 join request event (kind 9021)
      const event = await user!.signer.signEvent({
        kind: 9021, // GROUP_USER_JOIN_REQUEST
        tags,
        content: joinMessage.trim(),
        created_at: Math.floor(Date.now() / 1000),
      });
      
      if (!nostr) {
        throw new Error("Nostr client not available");
      }
      
      await nostr.event(event, { relays: [group.relay] });
      
      if (group.isOpen) {
        toast.success("Join request sent! You should be added automatically.");
      } else {
        toast.success("Join request sent! Waiting for admin approval.");
      }
      
      setShowJoinForm(false);
      setInviteCode("");
      setJoinMessage("");
    } catch (error) {
      console.error("Error joining group:", error);
      toast.error("Failed to join group. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  if (!user) {
    return (
      <Button variant="outline" size={size} className={className} disabled>
        <UserPlus className="h-4 w-4 mr-2" />
        Login to Join
      </Button>
    );
  }

  if (isAlreadyMember) {
    return (
      <Button variant="outline" size={size} className={className} disabled>
        <Users className="h-4 w-4 mr-2" />
        Member
      </Button>
    );
  }

  if (showJoinForm) {
    return (
      <div className="space-y-4 p-4 border rounded-lg bg-card">
        <div className="space-y-2">
          <h3 className="font-semibold">Join Group</h3>
          <p className="text-sm text-muted-foreground">
            {!group.isOpen ? 
              "This is a closed group. You need an invite code to join." :
              "Send a request to join this group."
            }
          </p>
        </div>

        {!group.isOpen && (
          <div className="space-y-2">
            <Label htmlFor="invite-code">Invite Code *</Label>
            <Input
              id="invite-code"
              placeholder="Enter invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="font-mono"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="join-message">Message (Optional)</Label>
          <Textarea
            id="join-message"
            placeholder="Tell the group why you'd like to join..."
            value={joinMessage}
            onChange={(e) => setJoinMessage(e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setShowJoinForm(false);
              setInviteCode("");
              setJoinMessage("");
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleJoinRequest}
            disabled={isJoining || (!group.isOpen && !inviteCode.trim())}
          >
            {isJoining ? (
              <>
                <UserPlus className="h-4 w-4 mr-2 animate-pulse" />
                Joining...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                {!group.isOpen ? 'Join with Code' : 'Send Request'}
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button 
      onClick={() => {
        if (group.isOpen) {
          handleJoinRequest();
        } else {
          setShowJoinForm(true);
        }
      }}
      size={size} 
      className={className}
      disabled={isJoining}
    >
      {isJoining ? (
        <>
          <UserPlus className="h-4 w-4 mr-2 animate-pulse" />
          Joining...
        </>
      ) : (
        <>
          {!group.isOpen ? (
            <Key className="h-4 w-4 mr-2" />
          ) : (
            <UserPlus className="h-4 w-4 mr-2" />
          )}
          {children || (!group.isOpen ? 'Join with Code' : 'Join Group')}
        </>
      )}
    </Button>
  );
}