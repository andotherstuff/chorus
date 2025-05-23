import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingStore {
  tokenClaimed: boolean;
  setTokenClaimed: (claimed: boolean) => void;
  isTokenClaimed: () => boolean;
}

// This store is separate from the main cashu store to ensure
// the onboarding token claimed state persists across logouts
export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      tokenClaimed: false,
      
      setTokenClaimed(claimed: boolean) {
        set({ tokenClaimed: claimed });
      },
      
      isTokenClaimed() {
        return get().tokenClaimed;
      },
    }),
    { 
      name: 'chorus-onboarding',
      // This ensures the data persists even when other stores are cleared
    }
  )
);