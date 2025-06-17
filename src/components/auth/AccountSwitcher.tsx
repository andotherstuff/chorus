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
  BarChart3,
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
import { Link, useNavigate } from "react-router-dom";
import { useUnreadNotificationsCount, useMarkAllNotificationsAsRead } from "@/hooks/useNotifications";
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
  const markAllAsRead = useMarkAllNotificationsAsRead();
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
            <div className="relative">
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
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-background">
                  {unreadCount > 99 ? '99' : unreadCount}
                </div>
              )}
            </div>
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
            <Link to="/create-group">
              <Plus className="w-3.5 h-3.5 font-bold md:w-3.5 md:h-3.5 w-4 h-4" />
              <span>Create Artist Page</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem
            asChild
            className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm md:gap-2 gap-3"
          >
            <Link to={`/profile/${currentUser.pubkey}`}>
              <User className="w-3.5 h-3.5 md:w-3.5 md:h-3.5 w-4 h-4" />
              <span>View Profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            asChild
            className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm md:gap-2 gap-3"
          >
            <Link to="/dashboard">
              <BarChart3 className="w-3.5 h-3.5 md:w-3.5 md:h-3.5 w-4 h-4" />
              <span>Dashboard</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            asChild
            className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm md:gap-2 gap-3"
          >
            <Link to="/wallet">
              <Wallet className="w-3.5 h-3.5 md:w-3.5 md:h-3.5 w-4 h-4" />
              <span>Wallet</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem
            asChild
            className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm md:gap-2 gap-3"
          >
            <Link
              to="/settings/notifications"
              onClick={() => {
                if (unreadCount > 0) {
                  markAllAsRead();
                }
              }}
            >
              <Bell className="w-3.5 h-3.5 md:w-3.5 md:h-3.5 w-4 h-4" />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="ml-auto bg-primary text-primary-foreground text-xs font-medium px-1.5 py-0.5 rounded-full">
                  {unreadCount > 99 ? '99' : unreadCount}
                </span>
              )}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            asChild
            className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm md:gap-2 gap-3"
          >
            <Link to="/settings">
              <Settings className="w-3.5 h-3.5 md:w-3.5 md:h-3.5 w-4 h-4" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuItem
            asChild
            className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md text-sm md:gap-2 gap-3"
          >
            <Link to="/about">
              <Info className="w-3.5 h-3.5 md:w-3.5 md:h-3.5 w-4 h-4" />
              <span>About Wavlake</span>
            </Link>
          </DropdownMenuItem>
          {!isRunningAsPwa && (
            <>
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
              const wavlakeOnboardingStored =
                localStorage.getItem("wavlake-onboarding");
              localStorage.clear();
              if (wavlakeOnboardingStored) {
                localStorage.setItem(
                  "wavlake-onboarding",
                  wavlakeOnboardingStored
                );
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
