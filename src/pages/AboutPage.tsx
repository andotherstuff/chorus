import { useMarkdownWithoutFirstHeading } from "@/hooks/useMarkdownWithoutFirstHeading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/ui/Header";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { Smartphone, Wifi, WifiOff, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { usePWA } from "@/hooks/usePWA";

export default function AboutPage() {
  const html = useMarkdownWithoutFirstHeading("/About.md");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { isRunningAsPwa } = usePWA();

  useEffect(() => {
    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="container mx-auto py-1 px-3 sm:px-4">
      <Header />
      
      <div className="max-w-3xl mx-auto mt-3 space-y-6">
        {/* PWA Status Card */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              App Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Installation Status</span>
              <Badge variant={isRunningAsPwa ? "default" : "secondary"}>
                {isRunningAsPwa ? (
                  <>
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Installed as App
                  </>
                ) : (
                  "Running in Browser"
                )}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Connection Status</span>
              <Badge variant={isOnline ? "default" : "destructive"}>
                {isOnline ? (
                  <>
                    <Wifi className="w-3 h-3 mr-1" />
                    Online
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 mr-1" />
                    Offline
                  </>
                )}
              </Badge>
            </div>

            {!isRunningAsPwa && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-3">
                  Get the best experience by installing +chorus as an app on your device.
                </p>
                <PWAInstallButton variant="default" size="sm" />
              </div>
            )}

            {isRunningAsPwa && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  ✨ You're using +chorus as an installed app! Enjoy the enhanced experience with faster loading and offline capabilities.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* About Content */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-3xl font-bold">About +chorus</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="prose dark:prose-invert max-w-none
                         prose-headings:font-bold prose-headings:text-foreground
                         prose-h2:text-2xl prose-h3:text-xl
                         prose-p:text-base prose-p:leading-relaxed prose-p:text-foreground/90
                         prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                         prose-strong:text-foreground prose-strong:font-semibold
                         prose-li:marker:text-primary/70 prose-li:my-1 prose-li:text-foreground/90
                         prose-img:rounded-md prose-img:shadow-sm
                         prose-hr:border-border/40"
              dangerouslySetInnerHTML={{ __html: html }} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}