// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import React, { useState } from 'react';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import LoginDialog from './LoginDialog';
import SignupDialog from './SignupDialog';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { AccountSwitcher } from './AccountSwitcher';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrLogin } from '@nostrify/react/login';

export function LoginArea() {
  const { currentUser } = useLoggedInAccounts();
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [signupDialogOpen, setSignupDialogOpen] = useState(false);
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { addLogin, removeLogin } = useNostrLogin();

  const handleLogin = async () => {
    try {
      // This is a simplified implementation - in a real app, you would use the proper login flow
      console.log('Login functionality would be implemented here');
      setLoginDialogOpen(false);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = () => {
    if (user) {
      removeLogin(user.pubkey);
    }
  };

  const handleLoginArea = () => {
    setLoginDialogOpen(false);
    setSignupDialogOpen(false);
  };

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {user.pubkey.slice(0, 8)}...
        </span>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    );
  }

  return (
    <>
      {currentUser ? (
        <AccountSwitcher onAddAccountClick={() => setLoginDialogOpen(true)} />
      ) : (
        <Button
          onClick={() => setLoginDialogOpen(true)}
          className='flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground w-full font-medium transition-all hover:bg-primary/90 animate-scale-in'
        >
          <User className='w-4 h-4' />
          <span>Log in</span>
        </Button>
      )}

      <LoginDialog
        isOpen={loginDialogOpen} 
        onClose={() => setLoginDialogOpen(false)} 
        onLogin={handleLoginArea}
        onSignup={() => setSignupDialogOpen(true)}
      />

      <SignupDialog
        isOpen={signupDialogOpen}
        onClose={() => setSignupDialogOpen(false)}
      />
    </>
  );
}