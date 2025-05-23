import { useState, useEffect } from 'react';
import { X, Smartphone, Monitor, Share, Plus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface PWAInstallInstructionsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallInstructions({ isOpen, onClose }: PWAInstallInstructionsProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
      onClose();
    }
  };

  const detectPlatform = () => {
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
  };

  const platform = detectPlatform();

  const renderInstructions = () => {
    switch (platform) {
      case 'ios':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Smartphone className="w-5 h-5 text-blue-500" />
              <Badge variant="secondary">iOS Safari</Badge>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center font-medium">1</div>
                <div>
                  <p className="font-medium">Tap the Share button</p>
                  <p className="text-sm text-muted-foreground">Look for the <Share className="w-4 h-4 inline mx-1" /> icon at the bottom of your screen</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center font-medium">2</div>
                <div>
                  <p className="font-medium">Select "Add to Home Screen"</p>
                  <p className="text-sm text-muted-foreground">Scroll down and tap <Plus className="w-4 h-4 inline mx-1" /> "Add to Home Screen"</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center font-medium">3</div>
                <div>
                  <p className="font-medium">Confirm installation</p>
                  <p className="text-sm text-muted-foreground">Tap "Add" in the top-right corner</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'android-chrome':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Smartphone className="w-5 h-5 text-green-500" />
              <Badge variant="secondary">Android Chrome</Badge>
            </div>
            {isInstallable ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Great! Your browser supports automatic installation.
                </p>
                <Button onClick={handleInstallClick} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Install +chorus
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500 text-white text-sm flex items-center justify-center font-medium">1</div>
                  <div>
                    <p className="font-medium">Open the menu</p>
                    <p className="text-sm text-muted-foreground">Tap the three dots (⋮) in the corner</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500 text-white text-sm flex items-center justify-center font-medium">2</div>
                  <div>
                    <p className="font-medium">Select "Add to Home screen"</p>
                    <p className="text-sm text-muted-foreground">Look for the option in the dropdown menu</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500 text-white text-sm flex items-center justify-center font-medium">3</div>
                  <div>
                    <p className="font-medium">Confirm installation</p>
                    <p className="text-sm text-muted-foreground">Tap "Add" to install the app</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'chrome':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="w-5 h-5 text-blue-500" />
              <Badge variant="secondary">Desktop Chrome</Badge>
            </div>
            {isInstallable ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your browser supports automatic installation.
                </p>
                <Button onClick={handleInstallClick} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Install +chorus
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center font-medium">1</div>
                  <div>
                    <p className="font-medium">Look for the install icon</p>
                    <p className="text-sm text-muted-foreground">Check the address bar for a <Download className="w-4 h-4 inline mx-1" /> install icon</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center font-medium">2</div>
                  <div>
                    <p className="font-medium">Alternative: Use the menu</p>
                    <p className="text-sm text-muted-foreground">Click the three dots (⋮) → "Install +chorus"</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="w-5 h-5 text-gray-500" />
              <Badge variant="secondary">Desktop Browser</Badge>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                To get the best app-like experience, try one of these options:
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-gray-500 text-white text-sm flex items-center justify-center font-medium">1</div>
                  <div>
                    <p className="font-medium">Use Chrome or Edge</p>
                    <p className="text-sm text-muted-foreground">These browsers support PWA installation</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-gray-500 text-white text-sm flex items-center justify-center font-medium">2</div>
                  <div>
                    <p className="font-medium">Create a bookmark</p>
                    <p className="text-sm text-muted-foreground">Add this page to your bookmarks for quick access</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Install +chorus
          </DialogTitle>
          <DialogDescription>
            Get the full app experience by installing +chorus on your device
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {renderInstructions()}
          
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-sm">Why install?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Faster loading and offline access</li>
              <li>• Native app-like experience</li>
              <li>• Quick access from your home screen</li>
              <li>• Push notifications (when available)</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to detect if PWA is installable and check if already in PWA mode
export function usePWAInstall() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isRunningAsPwa, setIsRunningAsPwa] = useState(false);

  useEffect(() => {
    // Check if already running as a PWA
    const checkIfPwa = () => {
      // Standard web app manifest display mode
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      // iOS specific detection
      const isIOSStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
      // Android TWA detection
      const isAndroidTwa = document.referrer.includes('android-app://');
      // Check other indicators
      const isLaunchedFromHomescreen = document.referrer === '';
      const hasManifestLink = !!document.querySelector('link[rel="manifest"]');
      const isFromAppIntent = window.location.href.includes('?source=pwa') || 
                             window.location.href.includes('?utm_source=pwa') || 
                             window.location.href.includes('?utm_source=homescreen');
      
      // If any of these conditions is true, we're likely running as a PWA
      const pwaMode = isStandalone || isIOSStandalone || isAndroidTwa || 
                      (isLaunchedFromHomescreen && hasManifestLink && isFromAppIntent);
                      
      setIsRunningAsPwa(pwaMode);
      
      // Don't show install prompt if already running as PWA
      return pwaMode;
    };
    
    const isPwa = checkIfPwa();
    
    // Only attach the beforeinstallprompt handler if not already a PWA
    if (!isPwa) {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setIsInstallable(true);
      };
  
      window.addEventListener('beforeinstallprompt', handler);
  
      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
      return true;
    }
    return false;
  };

  return { isInstallable, promptInstall, isRunningAsPwa };
}