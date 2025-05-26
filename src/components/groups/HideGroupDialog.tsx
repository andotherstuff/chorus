import { useState } from "react";
import { useHideGroup, HideGroupReason } from "@/hooks/useHideGroup";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { EyeOff } from "lucide-react";

interface HideGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  communityId: string;
  groupName?: string;
}

export function HideGroupDialog({
  isOpen,
  onClose,
  communityId,
  groupName,
}: HideGroupDialogProps) {
  const { user } = useCurrentUser();
  const { hideGroup, isPending } = useHideGroup();
  const [reason, setReason] = useState<HideGroupReason>("other");
  const [details, setDetails] = useState("");

  const handleSubmit = async () => {
    if (!user) return;

    try {
      await hideGroup({
        communityId,
        reason,
        details,
      });
      
      // Reset form and close dialog
      setReason("other");
      setDetails("");
      onClose();
    } catch (error) {
      // Error is handled in the hook
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EyeOff className="h-5 w-5 text-red-500" />
            Hide Group
          </DialogTitle>
          <DialogDescription>
            Hide this group from all public listings. This action will prevent the group from appearing in any group lists across the platform.
          </DialogDescription>
        </DialogHeader>

        {groupName && (
          <div className="bg-muted p-3 rounded-md text-sm mb-4">
            <p className="font-medium text-xs mb-1 text-muted-foreground">Group being hidden:</p>
            <p className="font-medium">{groupName}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hide-reason">Reason for hiding</Label>
            <RadioGroup
              id="hide-reason"
              value={reason}
              onValueChange={(value) => setReason(value as HideGroupReason)}
              className="grid grid-cols-2 gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="spam" id="spam" />
                <Label htmlFor="spam">Spam</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="illegal" id="illegal" />
                <Label htmlFor="illegal">Illegal content</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="malware" id="malware" />
                <Label htmlFor="malware">Malware/Scam</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="inappropriate" id="inappropriate" />
                <Label htmlFor="inappropriate">Inappropriate</Label>
              </div>
              <div className="flex items-center space-x-2 col-span-2">
                <RadioGroupItem value="other" id="other" />
                <Label htmlFor="other">Other</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hide-details">Additional details</Label>
            <Textarea
              id="hide-details"
              placeholder="Please provide more information about why you're hiding this group..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isPending || !user}
            variant="destructive"
          >
            {isPending ? "Hiding..." : "Hide Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}