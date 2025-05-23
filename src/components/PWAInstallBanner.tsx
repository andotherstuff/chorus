import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePWAInstall } from './PWAInstallInstructions';

export function PWAInstallBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { isInstallable, promptInstall } = usePWAInstall();

  useEffect(() => {
    // Check if user has dismissed the banner before
    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    // Check if we're on a mobile device or if PWA is installable
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // Enhanced PWA detection - check multiple methods
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || // Standard PWA detection
      (window.navigator as Navigator & { standalone?: boolean }).standalone || // iOS detection
      document.referrer.includes('android-app://'); // Android TWA detection
    
    // Check if launched from homescreen (additional Android signal)
    const isLaunchedFromHomescreen = document.referrer === '';
    const hasManifestLink = !!document.querySelector('link[rel="manifest"]');
    const isFromAppIntent = window.location.href.includes('?source=pwa') || 
                           window.location.href.includes('?utm_source=pwa') || 
                           window.location.href.includes('?utm_source=homescreen');
    
    // Only show the banner if:
    // 1. Not already in PWA mode (not standalone)
    // 2. Either a mobile device or has the install prompt
    // 3. Not dismissed already
    if ((isMobile || isInstallable) && 
        !isStandalone && 
        !dismissed && 
        !(isLaunchedFromHomescreen && hasManifestLink && isFromAppIntent)) {
      setIsVisible(true);
    }
  }, [isInstallable]);

  const handleInstall = async () => {
    if (isInstallable) {
      const success = await promptInstall();
      if (success) {
        setIsVisible(false);
      }
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('pwa-banner-dismissed', 'true');
  };

  if (!isVisible || isDismissed) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 shadow-lg border-primary/20 bg-card/95 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm">Install +chorus</h3>
            <p className="text-xs text-muted-foreground">
              Get the full app experience on your device
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {isInstallable ? (
              <Button size="sm" onClick={handleInstall} className="text-xs">
                <Download className="w-3 h-3 mr-1" />
                Install
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => {
                // This will be handled by opening the instructions dialog
                const event = new CustomEvent('open-pwa-instructions');
                window.dispatchEvent(event);
              }} className="text-xs">
                Learn How
              </Button>
            )}
            
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="p-1 h-auto"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}