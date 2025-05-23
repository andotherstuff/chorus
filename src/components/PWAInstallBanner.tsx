import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePWA } from '@/hooks/usePWA';

export function PWAInstallBanner() {
  const { isInstallable, showInstallBanner, promptInstall, dismissBanner } = usePWA();

  const handleInstall = async () => {
    if (isInstallable) {
      const success = await promptInstall();
      if (success) {
        // Banner will be hidden automatically by the hook
      }
    }
  };

  const handleDismiss = () => {
    dismissBanner();
  };

  if (!showInstallBanner) {
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