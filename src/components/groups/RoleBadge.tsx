import { Crown, Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { UserRole } from "@/hooks/useUserRole";

interface RoleBadgeProps {
  role: UserRole;
  className?: string;
  showLabel?: boolean;
  tooltipText?: {
    owner?: string;
    moderator?: string;
    member?: string;
  };
}

export function RoleBadge({
  role,
  className,
  showLabel = true,
  tooltipText = {
    owner: "You own this group",
    moderator: "You moderate this group",
    member: "You are a member of this group"
  }
}: RoleBadgeProps) {
  if (!role) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium",
            role === "owner" ? "bg-yellow-500/90 text-black" :
            role === "moderator" ? "bg-blue-500/90 text-white" :
            "bg-green-500/90 text-white",
            className
          )}>
            {role === "owner" && <Crown className="h-3 w-3" />}
            {role === "moderator" && <Shield className="h-3 w-3" />}
            {role === "member" && <Users className="h-3 w-3" />}
            {showLabel && <span>{role.charAt(0).toUpperCase() + role.slice(1)}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {role === "owner" ? tooltipText.owner :
           role === "moderator" ? tooltipText.moderator :
           tooltipText.member}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
