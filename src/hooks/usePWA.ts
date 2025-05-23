import { useState, useEffect } from 'react';
import { isPWAMode, shouldShowInstallBanner, dismissInstallBanner, type BeforeInstallPromptEvent } from '@/lib/pwa';

/**
 * Custom hook for PWA detection and installation management
 * Centralizes all PWA-related logic and state management
 */
export function usePWA() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isRunningAsPwa, setIsRunningAsPwa] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // Check if already running as a PWA
    const pwaMode = isPWAMode();
    setIsRunningAsPwa(pwaMode);
    
    // Only attach the beforeinstallprompt handler if not already a PWA
    if (!pwaMode) {
      const handler = (e: Event) => {
        e.preventDefault();
        const promptEvent = e as BeforeInstallPromptEvent;
        setDeferredPrompt(promptEvent);
        setIsInstallable(true);
        
        // Update banner visibility based on installability
        setShowInstallBanner(shouldShowInstallBanner(true));
      };

      window.addEventListener('beforeinstallprompt', handler);

      // Also check initial banner state for mobile devices
      setShowInstallBanner(shouldShowInstallBanner(false));

      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }
  }, []);

  /**
   * Attempts to prompt the user to install the PWA
   * Returns true if installation was accepted, false otherwise
   */
  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallable(false);
        setShowInstallBanner(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error prompting PWA install:', error);
      return false;
    }
  };

  /**
   * Dismisses the install banner and stores the preference
   */
  const dismissBanner = (): void => {
    setShowInstallBanner(false);
    dismissInstallBanner();
  };

  return {
    isInstallable,
    isRunningAsPwa,
    showInstallBanner,
    promptInstall,
    dismissBanner,
  };
}