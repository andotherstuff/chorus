import { createContext, useContext, useState, type ReactNode } from 'react';

interface User {
  pubkey: string;
  signer: any; // We'll type this properly once we have the correct type from nostrify
}

interface CurrentUserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
}

const CurrentUserContext = createContext<CurrentUserContextType | undefined>(undefined);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  return (
    <CurrentUserContext.Provider value={{ user, setUser }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const context = useContext(CurrentUserContext);
  if (context === undefined) {
    throw new Error('useCurrentUser must be used within a CurrentUserProvider');
  }
  return context;
} 