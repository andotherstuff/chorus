import { useState } from "react";
import { useReportContent, ReportType } from "@/hooks/useReportContent";
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
import { AlertTriangle } from "lucide-react";

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pubkey: string;
  eventId?: string;
  communityId?: string;
  contentPreview?: string;
}

export function ReportDialog({
  isOpen,
  onClose,
  pubkey,
  eventId,
  communityId,
  contentPreview,
}: ReportDialogProps) {
  const { user } = useCurrentUser();
  const { reportContent, isPending } = useReportContent();
  const [reportType, setReportType] = useState<ReportType>("other");
  const [reason, setReason] = useState("");

  const handleSubmit = async () => {
    if (!user) return;

    try {
      await reportContent({
        pubkey,
        eventId,
        communityId,
        reportType,
        reason,
      });
      
      // Reset form and close dialog
      setReportType("other");
      setReason("");
      onClose();
    } catch {
      // Error is handled in the hook
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Report Content
          </DialogTitle>
          <DialogDescription>
            Report this content to the group moderators. Please provide details about why you're reporting it.
          </DialogDescription>
        </DialogHeader>

        {contentPreview && (
          <div className="bg-muted p-3 rounded-md text-sm mb-4 max-h-24 overflow-y-auto">
            <p className="font-medium text-xs mb-1 text-muted-foreground">Content being reported:</p>
            <p className="line-clamp-3">{contentPreview}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-type">Report reason</Label>
            <RadioGroup
              id="report-type"
              value={reportType}
              onValueChange={(value) => setReportType(value as ReportType)}
              className="grid grid-cols-2 gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="nudity" id="nudity" />
                <Label htmlFor="nudity">Nudity/Sexual content</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="malware" id="malware" />
                <Label htmlFor="malware">Malware/Scam</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="profanity" id="profanity" />
                <Label htmlFor="profanity">Profanity/Hate speech</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="illegal" id="illegal" />
                <Label htmlFor="illegal">Illegal content</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="spam" id="spam" />
                <Label htmlFor="spam">Spam</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="impersonation" id="impersonation" />
                <Label htmlFor="impersonation">Impersonation</Label>
              </div>
              <div className="flex items-center space-x-2 col-span-2">
                <RadioGroupItem value="other" id="other" />
                <Label htmlFor="other">Other</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-details">Additional details</Label>
            <Textarea
              id="report-details"
              placeholder="Please provide more information about why you're reporting this content..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !user}>
            {isPending ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}