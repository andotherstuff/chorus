import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Database, Info } from "lucide-react";
import { groupCache, CACHE_TTLS } from "@/lib/cache/groupCache";
import { nip29Cache } from "@/lib/cache/nip29Cache";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatBytes } from "@/lib/utils";

export function CacheSettings() {
  const [settings, setSettings] = useState(groupCache.getSettings());
  const [stats, setStats] = useState(groupCache.getStats());
  const [nip29Stats, setNip29Stats] = useState(nip29Cache.getStats());

  useEffect(() => {
    // Update stats periodically
    const interval = setInterval(() => {
      setStats(groupCache.getStats());
      setNip29Stats(nip29Cache.getStats());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleToggleCaching = (enabled: boolean) => {
    const newSettings = { ...settings, enabled };
    groupCache.saveSettings(newSettings);
    setSettings(newSettings);
  };

  const handleToggleIndicators = (showIndicators: boolean) => {
    const newSettings = { ...settings, showIndicators };
    groupCache.saveSettings(newSettings);
    setSettings(newSettings);
  };

  const handleToggleDebugMode = (debugMode: boolean) => {
    const newSettings = { ...settings, debugMode };
    groupCache.saveSettings(newSettings);
    setSettings(newSettings);
  };

  const handleTTLChange = (type: 'metadata' | 'members', value: string) => {
    const ttl = parseInt(value);
    const newSettings = {
      ...settings,
      [type === 'metadata' ? 'groupMetadataTTL' : 'memberListsTTL']: ttl
    };
    groupCache.saveSettings(newSettings);
    setSettings(newSettings);
  };

  const handleClearCache = () => {
    if (confirm('Are you sure you want to clear all cached data? This will reload the page.')) {
      groupCache.clearAll();
      nip29Cache.clearAll();
      window.location.reload();
    }
  };

  const totalSize = stats.size + nip29Stats.totalSize;
  const totalItems = stats.itemCount + nip29Stats.groupCount;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cache Settings</CardTitle>
          <CardDescription>
            Control how group data is cached locally for faster loading
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Caching */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-cache">Enable Caching</Label>
              <p className="text-sm text-muted-foreground">
                Cache group metadata and member lists for instant loading
              </p>
            </div>
            <Switch
              id="enable-cache"
              checked={settings.enabled}
              onCheckedChange={handleToggleCaching}
            />
          </div>

          {/* Show Cache Indicators */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-indicators">Show Cache Indicators</Label>
              <p className="text-sm text-muted-foreground">
                Display badges when showing cached data
              </p>
            </div>
            <Switch
              id="show-indicators"
              checked={settings.showIndicators}
              onCheckedChange={handleToggleIndicators}
              disabled={!settings.enabled}
            />
          </div>

          {/* Debug Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="debug-mode">Debug Mode</Label>
              <p className="text-sm text-muted-foreground">
                Disable caching for testing (logs cache operations)
              </p>
            </div>
            <Switch
              id="debug-mode"
              checked={settings.debugMode}
              onCheckedChange={handleToggleDebugMode}
            />
          </div>

          {/* Cache Duration Settings */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="metadata-ttl">Group Metadata Cache Duration</Label>
              <Select
                value={settings.groupMetadataTTL.toString()}
                onValueChange={(value) => handleTTLChange('metadata', value)}
                disabled={!settings.enabled || settings.debugMode}
              >
                <SelectTrigger id="metadata-ttl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={(60 * 60 * 1000).toString()}>1 hour</SelectItem>
                  <SelectItem value={(6 * 60 * 60 * 1000).toString()}>6 hours</SelectItem>
                  <SelectItem value={(24 * 60 * 60 * 1000).toString()}>1 day</SelectItem>
                  <SelectItem value={(7 * 24 * 60 * 60 * 1000).toString()}>7 days</SelectItem>
                  <SelectItem value={(30 * 24 * 60 * 60 * 1000).toString()}>30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="members-ttl">Member Lists Cache Duration</Label>
              <Select
                value={settings.memberListsTTL.toString()}
                onValueChange={(value) => handleTTLChange('members', value)}
                disabled={!settings.enabled || settings.debugMode}
              >
                <SelectTrigger id="members-ttl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={(5 * 60 * 1000).toString()}>5 minutes</SelectItem>
                  <SelectItem value={(15 * 60 * 1000).toString()}>15 minutes</SelectItem>
                  <SelectItem value={(60 * 60 * 1000).toString()}>1 hour</SelectItem>
                  <SelectItem value={(6 * 60 * 60 * 1000).toString()}>6 hours</SelectItem>
                  <SelectItem value={(24 * 60 * 60 * 1000).toString()}>1 day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cache Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Cache Statistics</CardTitle>
          <CardDescription>
            Current cache usage and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Total Cache Size</p>
                <p className="text-2xl font-bold">{formatBytes(totalSize)}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Cached Items</p>
                <p className="text-2xl font-bold">{totalItems}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">NIP-72 Groups</p>
                <p className="font-medium">{stats.itemCount} items</p>
              </div>
              <div>
                <p className="text-muted-foreground">NIP-29 Groups</p>
                <p className="font-medium">
                  {nip29Stats.groupCount} groups across {nip29Stats.relayCount} relays
                </p>
              </div>
            </div>

            {settings.debugMode && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Debug mode is enabled. Caching is disabled and operations are being logged to the console.
                </AlertDescription>
              </Alert>
            )}

            <Button
              variant="destructive"
              onClick={handleClearCache}
              className="w-full"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Cache
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}