import { useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bell, MessageCircle, ThumbsUp, UserPlus, AlertTriangle, Check, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthor } from '@/hooks/useAuthor';
import { useNotifications, Notification } from '@/hooks/useNotifications';

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const { markAsRead } = useNotifications();
  const author = useAuthor(notification.pubkey);
  
  useEffect(() => {
    // Mark as read when component is mounted if not already read
    if (!notification.read) {
      markAsRead(notification.id);
    }
  }, [notification.id, notification.read, markAsRead]);

  // Get the appropriate icon based on notification type
  const getIcon = () => {
    switch (notification.type) {
      case 'group_update':
        return <Bell className="h-4 w-4" />;
      case 'tagged_post':
      case 'tagged_reply':
        return <MessageCircle className="h-4 w-4" />;
      case 'reaction':
        return <ThumbsUp className="h-4 w-4" />;
      case 'post_approved':
        return <Check className="h-4 w-4" />;
      case 'post_removed':
        return <X className="h-4 w-4" />;
      case 'join_request':
        return <UserPlus className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  // Format the time
  const timeAgo = notification.createdAt 
    ? formatDistanceToNow(new Date(notification.createdAt * 1000), { addSuffix: true })
    : '';

  // Get display name or fallback to pubkey
  const displayName = author.data?.metadata?.name || notification.pubkey.slice(0, 8) + '...';
  const profileImage = author.data?.metadata?.picture;

  return (
    <div 
      className={`p-3 hover:bg-muted cursor-pointer ${!notification.read ? 'bg-muted/50' : ''}`}
      onClick={onClick}
    >
      <div className="flex gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={profileImage} alt={displayName} />
          <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1 text-sm font-medium">
              {getIcon()}
              <span>{displayName}</span>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</span>
          </div>
          
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {notification.content}
          </p>
        </div>
      </div>
    </div>
  );
}