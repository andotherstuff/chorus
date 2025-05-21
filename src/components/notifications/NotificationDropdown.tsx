import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationItem } from './NotificationItem';

interface NotificationDropdownProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationDropdown({ open, onClose }: NotificationDropdownProps) {
  const { notifications, markAllAsRead, isLoading } = useNotifications();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleNotificationClick = (notification: any) => {
    onClose();
    
    // Navigate based on notification type
    if (notification.type === 'group_update' && notification.groupId) {
      const parts = notification.groupId.split(':');
      if (parts.length === 3) {
        navigate(`/group/${parts[2]}`);
      }
    } else if (['tagged_post', 'tagged_reply', 'reaction'].includes(notification.type) && notification.eventId) {
      // For now, we'll just navigate to the group if it exists
      // In a more advanced implementation, you might want to navigate to the specific post
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

  return (
    <div 
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-80 rounded-md bg-background border shadow-lg z-50"
    >
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold">Notifications</h3>
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={markAllAsRead}
            title="Mark all as read"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              onClose();
              navigate('/notifications');
            }}
            title="View all"
          >
            <span className="text-xs">View all</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="h-[400px]">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <NotificationItem 
                key={notification.id}
                notification={notification}
                onClick={() => handleNotificationClick(notification)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}