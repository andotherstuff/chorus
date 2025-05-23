// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import React, { useState } from 'react';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import LoginDialog from './LoginDialog';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { AccountSwitcher } from './AccountSwitcher';

export function LoginArea() {
  const { currentUser } = useLoggedInAccounts();
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);

  const handleLogin = () => {
    setLoginDialogOpen(false);
  };

  return (
    <>
      {currentUser ? (
        <AccountSwitcher onAddAccountClick={() => setLoginDialogOpen(true)} />
      ) : (
        <Button
          onClick={() => setLoginDialogOpen(true)}
          className='flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground w-full font-medium transition-all hover:bg-primary/90 animate-scale-in'
        >
          <User className='w-3.5 h-3.5' />
          <span>Log in</span>
        </Button>
      )}

      <LoginDialog
        isOpen={loginDialogOpen}
        onClose={() => setLoginDialogOpen(false)}
        onLogin={handleLogin}
      />

    </>
  );
}