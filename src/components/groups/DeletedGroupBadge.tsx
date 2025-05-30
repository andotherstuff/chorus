import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DeletedGroupBadgeProps {
  deletionDate?: Date;
  reason?: string;
  className?: string;
}

export function DeletedGroupBadge({ deletionDate, reason, className }: DeletedGroupBadgeProps) {
  const tooltipContent = (
    <div className="space-y-1">
      <div className="font-medium">Group Deleted</div>
      {deletionDate && (
        <div className="text-xs">
          Deleted on {deletionDate.toLocaleDateString()}
        </div>
      )}
      {reason && (
        <div className="text-xs">
          <strong>Reason:</strong> {reason}
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive" className={className}>
            <AlertTriangle className="h-3 w-3 mr-1" />
            Deleted
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}