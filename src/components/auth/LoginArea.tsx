// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { Button } from '@/components/ui/button.tsx';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { User } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountSwitcher } from './AccountSwitcher';
import LoginDialog from './LoginDialog';
import SignupDialog from './SignupDialog';

export function LoginArea() {
  const { currentUser } = useLoggedInAccounts();
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [signupDialogOpen, setSignupDialogOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogin = () => {
    setLoginDialogOpen(false);
    setSignupDialogOpen(false);
  };

  return (
    <>
      {currentUser ? (
        <button
          onClick={() => navigate('/settings')}
          type='button'
          className='flex w-full max-w-60 items-center gap-3 rounded-full p-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary'
          title='Account settings'
        >
          <img
            src={currentUser.metadata.picture}
            alt={currentUser.metadata.name}
            className='h-10 w-10 rounded-full object-cover'
          />
          <div className='hidden flex-1 truncate text-left md:block'>
            <p className='truncate font-medium text-sm'>
              {currentUser.metadata.name || currentUser.pubkey}
            </p>
          </div>
        </button>
      ) : (
        <Button
          onClick={() => setLoginDialogOpen(true)}
          className='flex w-full animate-scale-in items-center gap-2 rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground transition-all hover:bg-primary/90'
        >
          <User className='h-4 w-4' />
          <span>Log in</span>
        </Button>
      )}

      <LoginDialog
        isOpen={loginDialogOpen}
        onClose={() => setLoginDialogOpen(false)}
        onLogin={handleLogin}
        onSignup={() => setSignupDialogOpen(true)}
      />

      <SignupDialog isOpen={signupDialogOpen} onClose={() => setSignupDialogOpen(false)} />
    </>
  );
}
