// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { ChevronDown, LogOut, UserIcon, UserPlus, Plus, Settings, Edit, User, Bell, Wallet, Info } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.tsx';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { useNavigate } from 'react-router-dom';
import { useUnreadNotificationsCount } from '@/hooks/useNotifications';

interface AccountSwitcherProps {
  onAddAccountClick: () => void;
}

export function AccountSwitcher({ onAddAccountClick }: AccountSwitcherProps) {
  const { currentUser, otherUsers, setLogin, removeLogin } = useLoggedInAccounts();
  const navigate = useNavigate();
  const unreadCount = useUnreadNotificationsCount();

  if (!currentUser) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className='flex items-center gap-3 p-3 rounded-full hover:bg-accent transition-all w-full text-foreground max-w-60'>
          <Avatar className='w-10 h-10 rounded-md'>
            <AvatarImage src={currentUser.metadata.picture} alt={currentUser.metadata.name} />
            {currentUser.metadata.name?.charAt(0)
              ? <AvatarFallback>{currentUser.metadata.name?.charAt(0)}</AvatarFallback>
              : <AvatarFallback><UserIcon /></AvatarFallback>}
          </Avatar>
          <div className='flex-1 text-left hidden md:block truncate'>
            <p className='font-medium text-sm truncate'>{currentUser.metadata.name || currentUser.pubkey}</p>
          </div>
          <ChevronDown className='w-4 h-4 text-muted-foreground' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-56 p-2 animate-scale-in'>
        <DropdownMenuItem
          asChild
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md font-bold'
        >
          <a href="/create-group">
            <Plus className='w-4 h-4 font-bold' />
            <span>Create Group</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          asChild
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
        >
          <a href={`/profile/${currentUser.pubkey}`}>
            <User className='w-4 h-4' />
            <span>View Profile</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
        >
          <a href="/settings/profile">
            <Edit className='w-4 h-4' />
            <span>Edit Profile</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
        >
          <a href="/wallet">
            <Wallet className='w-4 h-4' />
            <span>Wallet</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          asChild
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
        >
          <a href="/settings/notifications">
            <Bell className='w-4 h-4' />
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="ml-auto bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
        >
          <a href="/settings">
            <Settings className='w-4 h-4' />
            <span>Settings</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          asChild
          className="flex items-center gap-2 cursor-pointer p-2 rounded-md"
        >
          <a href="/about">
            <Info className="w-4 h-4" />
            <span>About +chorus</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            removeLogin(currentUser.id);
            navigate('/');
          }}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md text-red-500'
        >
          <LogOut className='w-4 h-4' />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
