/**
 * PWA Detection and Management Utilities
 * 
 * This module provides centralized PWA detection logic and utilities
 * to avoid code duplication across components.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Detects if the app is currently running in PWA mode
 * Uses multiple detection methods for better compatibility
 */
export function isPWAMode(): boolean {
  // Standard web app manifest display mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  // iOS specific detection
  const isIOSStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  
  // Android TWA (Trusted Web Activity) detection
  const isAndroidTwa = document.referrer.includes('android-app://');
  
  // Check if launched from homescreen (additional Android signal)
  const isLaunchedFromHomescreen = document.referrer === '';
  const hasManifestLink = !!document.querySelector('link[rel="manifest"]');
  const isFromAppIntent = window.location.href.includes('?source=pwa') || 
                         window.location.href.includes('?utm_source=pwa') || 
                         window.location.href.includes('?utm_source=homescreen');
  
  // If any of these conditions is true, we're likely running as a PWA
  return isStandalone || 
         !!isIOSStandalone || 
         isAndroidTwa || 
         (isLaunchedFromHomescreen && hasManifestLink && isFromAppIntent);
}

/**
 * Detects the user's platform for platform-specific PWA instructions
 */
export function detectPlatform(): 'ios' | 'android-chrome' | 'android' | 'safari' | 'chrome' | 'firefox' | 'desktop' {
  const userAgent = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);
  const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
  const isChrome = /chrome/.test(userAgent);
  const isFirefox = /firefox/.test(userAgent);

  if (isIOS) return 'ios';
  if (isAndroid && isChrome) return 'android-chrome';
  if (isAndroid) return 'android';
  if (isSafari) return 'safari';
  if (isChrome) return 'chrome';
  if (isFirefox) return 'firefox';
  return 'desktop';
}

/**
 * Checks if the device is mobile
 */
export function isMobileDevice(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/**
 * Checks if PWA install banner should be shown
 * Takes into account PWA mode, dismissal state, and device type
 */
export function shouldShowInstallBanner(isInstallable: boolean): boolean {
  // Don't show if already in PWA mode
  if (isPWAMode()) {
    return false;
  }

  // Check if user has dismissed the banner before
  const dismissed = localStorage.getItem('pwa-banner-dismissed');
  if (dismissed) {
    return false;
  }

  // Check if we're on a mobile device or if PWA is installable
  const isMobile = isMobileDevice();
  
  // Only show the banner if:
  // 1. Not already in PWA mode (checked above)
  // 2. Either a mobile device or has the install prompt
  // 3. Not dismissed already (checked above)
  return (isMobile || isInstallable);
}

/**
 * Dismisses the PWA install banner and stores the preference
 */
export function dismissInstallBanner(): void {
  localStorage.setItem('pwa-banner-dismissed', 'true');
}

/**
 * Checks if the PWA install banner has been dismissed
 */
export function isInstallBannerDismissed(): boolean {
  return !!localStorage.getItem('pwa-banner-dismissed');
}

/**
 * Clears the PWA install banner dismissal state
 * Useful for testing or if you want to reset the banner
 */
export function resetInstallBannerDismissal(): void {
  localStorage.removeItem('pwa-banner-dismissed');
}