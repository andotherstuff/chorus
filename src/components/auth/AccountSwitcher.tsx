// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { ChevronDown, LogOut, UserIcon, UserPlus } from 'lucide-react';

interface AccountSwitcherProps {
  onAddAccountClick: () => void;
}

export function AccountSwitcher({ onAddAccountClick }: AccountSwitcherProps) {
  const { currentUser, otherUsers, setLogin, removeLogin } = useLoggedInAccounts();

  if (!currentUser) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          className='flex w-full max-w-60 items-center gap-3 rounded-full p-3 text-foreground transition-all hover:bg-accent'
        >
          <Avatar className='h-10 w-10'>
            <AvatarImage src={currentUser.metadata.picture} alt={currentUser.metadata.name} />
            <AvatarFallback>{currentUser.metadata.name?.charAt(0) || <UserIcon />}</AvatarFallback>
          </Avatar>
          <div className='hidden flex-1 truncate text-left md:block'>
            <p className='truncate font-medium text-sm'>
              {currentUser.metadata.name || currentUser.pubkey}
            </p>
          </div>
          <ChevronDown className='h-4 w-4 text-muted-foreground' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-56 animate-scale-in p-2'>
        <div className='px-2 py-1.5 font-medium text-sm'>Switch Account</div>
        {otherUsers.map((user) => (
          <DropdownMenuItem
            key={user.id}
            onClick={() => setLogin(user.id)}
            className='flex cursor-pointer items-center gap-2 rounded-md p-2'
          >
            <Avatar className='h-8 w-8'>
              <AvatarImage src={user.metadata.picture} alt={user.metadata.name} />
              <AvatarFallback>{user.metadata.name?.charAt(0) || <UserIcon />}</AvatarFallback>
            </Avatar>
            <div className='flex-1 truncate'>
              <p className='font-medium text-sm'>{user.metadata.name || user.pubkey}</p>
            </div>
            {user.id === currentUser.id && <div className='h-2 w-2 rounded-full bg-primary' />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onAddAccountClick}
          className='flex cursor-pointer items-center gap-2 rounded-md p-2'
        >
          <UserPlus className='h-4 w-4' />
          <span>Add another account</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            localStorage.removeItem('hasOnboarded');
            removeLogin(currentUser.id);
          }}
          className='flex cursor-pointer items-center gap-2 rounded-md p-2 text-red-500'
        >
          <LogOut className='h-4 w-4' />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
