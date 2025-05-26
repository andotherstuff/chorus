import { UserPlus, Clock } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useJoinDialog } from "./JoinDialogContext";

interface JoinRequestMenuItemProps {
  communityId: string;
  hasPendingRequest?: boolean;
}

export function JoinRequestMenuItem({ communityId, hasPendingRequest }: JoinRequestMenuItemProps) {
  const { openJoinDialog } = useJoinDialog();

  const handleClick = (e: Event) => {
    e.preventDefault(); // Prevent the dropdown from closing immediately
    openJoinDialog(communityId);
  };

  if (hasPendingRequest) {
    return (
      <DropdownMenuItem onSelect={handleClick}>
        <Clock className="h-4 w-4 mr-2" />
        Request pending
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem onSelect={handleClick}>
      <UserPlus className="h-4 w-4 mr-2" />
      Request to join
    </DropdownMenuItem>
  );
}