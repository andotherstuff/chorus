// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import {
  ChevronDown,
  LogOut,
  UserIcon,
  UserPlus,
  Plus,
  Settings,
  Edit,
  User,
  Bell,
  Wallet,
  Info,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { useLoggedInAccounts } from "@/hooks/useLoggedInAccounts";
import { useNavigate } from "react-router-dom";
import { useUnreadNotificationsCount } from "@/hooks/useNotifications";
import { useCashuStore } from "@/stores/cashuStore";
interface AccountSwitcherProps {
  onAddAccountClick: () => void;
}

export function AccountSwitcher({ onAddAccountClick }: AccountSwitcherProps) {
  const { currentUser, otherUsers, setLogin, removeLogin } =
    useLoggedInAccounts();
  const navigate = useNavigate();
  const unreadCount = useUnreadNotificationsCount();
  const cashuStore = useCashuStore();

  if (!currentUser) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 p-1.5 rounded-full w-full text-foreground max-w-56"
        >
          <Avatar className="w-8 h-8 rounded-md">
            <AvatarImage
              src={currentUser.metadata.picture}
              alt={currentUser.metadata.name}
            />
            {currentUser.metadata.name?.charAt(0) ? (
              <AvatarFallback>
                {currentUser.metadata.name?.charAt(0)}
              </AvatarFallback>
            ) : (
              <AvatarFallback>
                <UserIcon className="w-4 h-4" />
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1 text-left hidden md:block truncate">
            <p className="font-medium text-xs truncate">
              {currentUser.metadata.name || currentUser.pubkey}
            </p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52 p-1.5 animate-scale-in">
        <DropdownMenuItem
          asChild
          className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md font-bold text-sm"
        >
          <a href="/create-group">
            <Plus className="w-3.5 h-3.5 font-bold" />
            <span>Create Group</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          asChild
          className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm"
        >
          <a href={`/profile/${currentUser.pubkey}`}>
            <User className="w-3.5 h-3.5" />
            <span>View Profile</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm"
        >
          <a href="/settings/profile">
            <Edit className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm"
        >
          <a href="/wallet">
            <Wallet className="w-3.5 h-3.5" />
            <span>Wallet</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          asChild
          className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm"
        >
          <a href="/settings/notifications">
            <Bell className="w-3.5 h-3.5" />
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="ml-auto bg-primary text-primary-foreground text-xs font-medium px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm"
        >
          <a href="/settings">
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          asChild
          className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm"
        >
          <a href="/about">
            <Info className="w-3.5 h-3.5" />
            <span>About +chorus</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          onClick={() => {
            removeLogin(currentUser.id);
            navigate("/");
            removeLogin(currentUser.id);
            navigate("/");
            localStorage.clear();
            cashuStore.clearStore();
          }}
          className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-red-500 text-sm"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
