import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { useNotifications } from '@/hooks/useNotifications';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { AppLayout } from '@/components/ui/AppLayout';

export default function Notifications() {
  const { user } = useCurrentUser();
  const { notifications, markAllAsRead, isLoading } = useNotifications();
  const navigate = useNavigate();

  // Redirect to home if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleNotificationClick = (notification: any) => {
    // Navigate based on notification type
    if (notification.type === 'group_update' && notification.groupId) {
      const parts = notification.groupId.split(':');
      if (parts.length === 3) {
        navigate(`/group/${parts[2]}`);
      }
    } else if (['tagged_post', 'tagged_reply', 'reaction'].includes(notification.type) && notification.eventId) {
      // For now, we'll just navigate to the group if it exists
      if (notification.groupId) {
        const parts = notification.groupId.split(':');
        if (parts.length === 3) {
          navigate(`/group/${parts[2]}`);
        }
      }
    } else if (['post_approved', 'post_removed'].includes(notification.type) && notification.groupId) {
      const parts = notification.groupId.split(':');
      if (parts.length === 3) {
        navigate(`/group/${parts[2]}`);
      }
    } else if (notification.type === 'join_request' && notification.groupId) {
      const parts = notification.groupId.split(':');
      if (parts.length === 3) {
        navigate(`/group/${parts[2]}/settings`);
      }
    }
  };

  if (!user) {
    return null;
  }

  return (
    <AppLayout showHeader={false}>
      
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Stay updated on activity in your groups and interactions
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={markAllAsRead}
            className="flex items-center gap-1"
          >
            <Check className="h-4 w-4" />
            Mark all as read
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              You don't have any notifications yet
            </div>
          ) : (
            <div className="divide-y border rounded-md">
              {notifications.map((notification) => (
                <NotificationItem 
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}