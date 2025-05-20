import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginArea } from '../components/auth/LoginArea';
import * as useLoginActions from '../hooks/useLoginActions';
import * as useCurrentUser from '../hooks/useCurrentUser';
import * as useLoggedInAccounts from '../hooks/useLoggedInAccounts';

// Mock the hooks
vi.mock('../hooks/useLoginActions', () => ({
  useLoginActions: vi.fn()
}));

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn()
}));

vi.mock('../hooks/useLoggedInAccounts', () => ({
  useLoggedInAccounts: vi.fn()
}));

// Mock NostrLogin (used in the AccountSwitcher component)
vi.mock('@nostrify/react/login', () => ({
  useNostrLogin: vi.fn().mockReturnValue({
    logins: [],
    addLogin: vi.fn(),
    removeLogin: vi.fn()
  })
}));

// Mock NostrProvider
vi.mock('@nostrify/react', () => ({
  useNostr: vi.fn().mockReturnValue({
    nostr: {}
  })
}));

describe('LoginArea', () => {
  const logoutMock = vi.fn();
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup mocks
    vi.mocked(useLoginActions.useLoginActions).mockReturnValue({
      nsec: vi.fn(),
      bunker: vi.fn(),
      extension: vi.fn(),
      logout: logoutMock
    });
    
    vi.mocked(useCurrentUser.useCurrentUser).mockReturnValue({
      user: { pubkey: 'test-pubkey', signer: {} },
      setUser: vi.fn()
    });
    
    vi.mocked(useLoggedInAccounts.useLoggedInAccounts).mockReturnValue({
      currentUser: { id: '1', pubkey: 'test-pubkey', metadata: {} },
      otherUsers: [],
      authors: [],
      setLogin: vi.fn(),
      removeLogin: vi.fn()
    });
  });

  it('should display the login button when not logged in', () => {
    // Mock user as not logged in
    vi.mocked(useCurrentUser.useCurrentUser).mockReturnValue({
      user: null,
      setUser: vi.fn()
    });
    
    vi.mocked(useLoggedInAccounts.useLoggedInAccounts).mockReturnValue({
      currentUser: null,
      otherUsers: [],
      authors: [],
      setLogin: vi.fn(),
      removeLogin: vi.fn()
    });

    render(<LoginArea />);
    
    expect(screen.getByText('Log in')).toBeInTheDocument();
  });

  it('should call logout function when logout button is clicked', () => {
    render(<LoginArea />);
    
    // Find and click the logout button
    const logoutButton = screen.getByText('Logout');
    fireEvent.click(logoutButton);
    
    // Verify the logout function was called
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});