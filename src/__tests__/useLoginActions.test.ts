import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLoginActions } from '../hooks/useLoginActions';
import * as nostrifyReact from '@nostrify/react';
import * as nostrifyReactLogin from '@nostrify/react/login';

// Mock the hooks
vi.mock('@nostrify/react', () => ({
  useNostr: vi.fn()
}));

vi.mock('@nostrify/react/login', () => ({
  useNostrLogin: vi.fn(),
  NLogin: {
    fromNsec: vi.fn(),
    fromBunker: vi.fn(),
    fromExtension: vi.fn()
  }
}));

describe('useLoginActions', () => {
  const removeLoginMock = vi.fn();
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup mocks
    vi.mocked(nostrifyReact.useNostr).mockReturnValue({
      nostr: {}
    });
    
    vi.mocked(nostrifyReactLogin.useNostrLogin).mockReturnValue({
      logins: [{ id: 'login-id', pubkey: 'test-pubkey', type: 'nsec' }],
      addLogin: vi.fn(),
      removeLogin: removeLoginMock
    });
  });

  it('should call removeLogin with the correct ID when logout is called', async () => {
    const { logout } = useLoginActions();
    
    await logout();
    
    // Verify removeLogin was called with the correct login ID
    expect(removeLoginMock).toHaveBeenCalledWith('login-id');
  });

  it('should not call removeLogin if there are no logins', async () => {
    // Mock empty logins array
    vi.mocked(nostrifyReactLogin.useNostrLogin).mockReturnValue({
      logins: [],
      addLogin: vi.fn(),
      removeLogin: removeLoginMock
    });
    
    const { logout } = useLoginActions();
    
    await logout();
    
    // Verify removeLogin was not called
    expect(removeLoginMock).not.toHaveBeenCalled();
  });
});