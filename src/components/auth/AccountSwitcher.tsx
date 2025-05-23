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
  Download,
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
import { useState } from "react";
import { PWAInstallInstructions } from "@/components/PWAInstallInstructions";
import { usePWA } from "@/hooks/usePWA";
interface AccountSwitcherProps {
  onAddAccountClick: () => void;
}

export function AccountSwitcher({ onAddAccountClick }: AccountSwitcherProps) {
  const { currentUser, otherUsers, setLogin, removeLogin } =
    useLoggedInAccounts();
  const navigate = useNavigate();
  const unreadCount = useUnreadNotificationsCount();
  const cashuStore = useCashuStore();
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);
  const { isInstallable, isRunningAsPwa, promptInstall } = usePWA();

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await promptInstall();
      if (!success) {
        // If auto-install failed, show instructions
        setShowInstallInstructions(true);
      }
    } else {
      // Show instructions for manual installation
      setShowInstallInstructions(true);
    }
  };

  if (!currentUser) return null;

  return (
    <>
      <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 p-1.5 rounded-full w-full text-foreground max-w-56 focus:outline-none"
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
          className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md font-bold text-sm md:gap-2 gap-3"
        >
          <a href="/create-group">
            <Plus className="w-3.5 h-3.5 font-bold md:w-3.5 md:h-3.5 w-4 h-4" />
            <span>Create Group</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          asChild
          className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm md:gap-2 gap-3"
        >
          <a href={`/profile/${currentUser.pubkey}`}>
            <User className="w-3.5 h-3.5 md:w-3.5 md:h-3.5 w-4 h-4" />
            <span>View Profile</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm md:gap-2 gap-3"
        >
          <a href="/settings/profile">
            <Edit className="w-3.5 h-3.5 md:w-3.5 md:h-3.5 w-4 h-4" />
            <span>Edit Profile</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm md:gap-2 gap-3"
        >
          <a href="/wallet">
            <Wallet className="w-3.5 h-3.5 md:w-3.5 md:h-3.5 w-4 h-4" />
            <span>Wallet</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          asChild
          className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm md:gap-2 gap-3"
        >
          <a href="/settings/notifications">
            <Bell className="w-3.5 h-3.5 md:w-3.5 md:h-3.5 w-4 h-4" />
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
          className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm md:gap-2 gap-3"
        >
          <a href="/settings">
            <Settings className="w-3.5 h-3.5 md:w-3.5 md:h-3.5 w-4 h-4" />
            <span>Settings</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          asChild
          className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm md:gap-2 gap-3"
        >
          <a href="/about">
            <Info className="w-3.5 h-3.5 md:w-3.5 md:h-3.5 w-4 h-4" />
            <span>About +chorus</span>
          </a>
        </DropdownMenuItem>
        {!isRunningAsPwa && (
          <>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              onClick={handleInstallClick}
              className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm md:gap-2 gap-3"
            >
              <Download className="w-3.5 h-3.5 md:w-3.5 md:h-3.5 w-4 h-4" />
              <span>Install App</span>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          onClick={() => {
            removeLogin(currentUser.id);
            cashuStore.clearStore();
            const chorusOnboardingStored =
              localStorage.getItem("chorus-onboarding");
            localStorage.clear();
            if (chorusOnboardingStored) {
              localStorage.setItem("chorus-onboarding", chorusOnboardingStored);
            }
            navigate("/");
          }}
          className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-red-500 text-sm md:gap-2 gap-3"
        >
          <LogOut className="w-3.5 h-3.5 md:w-3.5 md:h-3.5 w-4 h-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    
    <PWAInstallInstructions
      isOpen={showInstallInstructions}
      onClose={() => setShowInstallInstructions(false)}
    />
    </>
  );
}
