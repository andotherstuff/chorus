import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Bell, BellOff, Smartphone, Monitor, AlertCircle, CheckCircle } from 'lucide-react';
import { usePushSubscription, useTestPushNotification } from '@/hooks/usePushSubscription';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatDistanceToNow } from 'date-fns';

export function PushNotificationSettings() {
  const { user } = useCurrentUser();
  const {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    isSubscribing,
    isUnsubscribing,
    serverSubscriptions,
    error,
  } = usePushSubscription();

  const testNotification = useTestPushNotification();
  const [notificationPreferences, setNotificationPreferences] = useState({
    groupUpdates: true,
    mentions: true,
    reactions: true,
    joinRequests: true,
    reports: true,
  });

  if (!user) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You must be logged in to manage push notification settings.
        </AlertDescription>
      </Alert>
    );
  }

  if (!isSupported) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Push notifications are not supported in this browser. Try using a modern browser like Chrome, Firefox, or Safari.
        </AlertDescription>
      </Alert>
    );
  }

  const handleSubscribe = () => {
    subscribe();
  };

  const handleUnsubscribe = () => {
    unsubscribe(undefined);
  };

  const handleTestNotification = () => {
    testNotification.mutate({
      title: 'Test Notification',
      body: 'This is a test push notification from +chorus!',
    });
  };

  const getPermissionBadge = () => {
    switch (permission) {
      case 'granted':
        return <Badge variant="default" className="bg-green-500">Granted</Badge>;
      case 'denied':
        return <Badge variant="destructive">Denied</Badge>;
      case 'default':
        return <Badge variant="secondary">Not requested</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getDeviceIcon = (endpoint: string) => {
    // Simple heuristic to detect device type based on endpoint
    if (endpoint.includes('android') || endpoint.includes('fcm')) {
      return <Smartphone className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Get notified instantly when there's new activity in your groups, even when the app is closed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Permission Status */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Permission Status</Label>
              <p className="text-sm text-muted-foreground">
                Browser permission for showing notifications
              </p>
            </div>
            {getPermissionBadge()}
          </div>

          <Separator />

          {/* Subscription Status */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Push Notifications</Label>
              <p className="text-sm text-muted-foreground">
                {isSubscribed 
                  ? 'You will receive push notifications for new activity'
                  : 'Enable push notifications to stay updated'
                }
              </p>
            </div>
            {isSubscribed ? (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleUnsubscribe}
                disabled={isUnsubscribing}
              >
                <BellOff className="h-4 w-4 mr-2" />
                {isUnsubscribing ? 'Disabling...' : 'Disable'}
              </Button>
            ) : (
              <Button 
                size="sm" 
                onClick={handleSubscribe}
                disabled={isSubscribing || permission === 'denied'}
              >
                <Bell className="h-4 w-4 mr-2" />
                {isSubscribing ? 'Enabling...' : 'Enable'}
              </Button>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Permission Denied Help */}
          {permission === 'denied' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Push notifications are blocked. To enable them, click the lock icon in your address bar 
                and change the notification setting to "Allow", then refresh the page.
              </AlertDescription>
            </Alert>
          )}

          {/* Test Notification */}
          {isSubscribed && (
            <>
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Test Notification</Label>
                  <p className="text-sm text-muted-foreground">
                    Send a test notification to verify everything is working
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleTestNotification}
                  disabled={testNotification.isPending}
                >
                  {testNotification.isPending ? 'Sending...' : 'Send Test'}
                </Button>
              </div>
              
              {testNotification.isSuccess && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Test notification sent! You should receive it shortly.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
