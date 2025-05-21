import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent } from '@nostrify/nostrify';
import { useEffect, useState } from 'react';

export type NotificationType = 
  | 'group_update'      // Kind 34550 - group update where user is tagged
  | 'tagged_post'       // Kind 11 - tagged in a post
  | 'tagged_reply'      // Kind 1111 - tagged in a reply
  | 'reaction'          // Kind 7 - reaction to user's post
  | 'post_approved'     // Kind 4550 - post approved
  | 'post_removed'      // Kind 4551 - post removed
  | 'join_request';     // Kind 4552 - request to join group (for moderators)

export interface Notification {
  id: string;
  type: NotificationType;
  pubkey: string;
  createdAt: number;
  read: boolean;
  eventId?: string;
  groupId?: string;
  content?: string;
  event: NostrEvent;
}

export function useNotifications() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());

  // Load read notifications from localStorage on mount
  useEffect(() => {
    if (user) {
      try {
        const stored = localStorage.getItem(`nostr:read-notifications:${user.pubkey}`);
        if (stored) {
          setReadNotifications(new Set(JSON.parse(stored)));
        }
      } catch (e) {
        console.error('Failed to load read notifications', e);
      }
    }
  }, [user?.pubkey]);

  // Save read notifications to localStorage when they change
  useEffect(() => {
    if (user && readNotifications.size > 0) {
      localStorage.setItem(
        `nostr:read-notifications:${user.pubkey}`,
        JSON.stringify([...readNotifications])
      );
    }
  }, [readNotifications, user?.pubkey]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['notifications', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user) return { notifications: [], unreadCount: 0 };

      const abortSignal = AbortSignal.any([signal, AbortSignal.timeout(5000)]);
      
      // Get groups where user is a moderator
      const moderatedGroups = await nostr.query(
        [{ kinds: [34550], '#p': [user.pubkey, `${user.pubkey}#moderator`] }],
        { signal: abortSignal }
      );
      
      const moderatedGroupIds = moderatedGroups.map(event => {
        const dTag = event.tags.find(tag => tag[0] === 'd');
        if (dTag && dTag[1]) {
          return `34550:${event.pubkey}:${dTag[1]}`;
        }
        return null;
      }).filter(Boolean) as string[];

      // Fetch all relevant notification events
      const events = await nostr.query([
        // Group updates where user is tagged
        { kinds: [34550], '#p': [user.pubkey] },
        // Tagged in posts
        { kinds: [11], '#p': [user.pubkey] },
        // Tagged in replies
        { kinds: [1111], '#p': [user.pubkey] },
        // Reactions to user's posts
        { kinds: [7], '#p': [user.pubkey] },
        // Post approvals for user's posts
        { kinds: [4550], '#p': [user.pubkey] },
        // Post removals for user's posts
        { kinds: [4551], '#p': [user.pubkey] },
        // Join requests for groups user moderates (if any)
        ...(moderatedGroupIds.length > 0 
          ? [{ kinds: [4552], '#a': moderatedGroupIds }] 
          : [])
      ], { signal: abortSignal });

      // Process events into notifications
      const notifications: Notification[] = events.map(event => {
        let type: NotificationType;
        let eventId: string | undefined;
        let groupId: string | undefined;
        let content: string | undefined;

        switch (event.kind) {
          case 34550:
            type = 'group_update';
            const dTag = event.tags.find(tag => tag[0] === 'd');
            if (dTag && dTag[1]) {
              groupId = `34550:${event.pubkey}:${dTag[1]}`;
            }
            const nameTag = event.tags.find(tag => tag[0] === 'name');
            content = nameTag ? `Group "${nameTag[1]}" was updated` : 'A group you belong to was updated';
            break;
          case 11:
            type = 'tagged_post';
            eventId = event.id;
            content = 'You were tagged in a post';
            break;
          case 1111:
            type = 'tagged_reply';
            eventId = event.id;
            content = 'You were tagged in a reply';
            break;
          case 7:
            type = 'reaction';
            const eTag = event.tags.find(tag => tag[0] === 'e');
            if (eTag && eTag[1]) {
              eventId = eTag[1];
            }
            content = `Someone reacted to your post: ${event.content}`;
            break;
          case 4550:
            type = 'post_approved';
            const approvedETag = event.tags.find(tag => tag[0] === 'e');
            if (approvedETag && approvedETag[1]) {
              eventId = approvedETag[1];
            }
            const aTag = event.tags.find(tag => tag[0] === 'a');
            if (aTag && aTag[1]) {
              groupId = aTag[1];
            }
            content = 'Your post to a group was approved';
            break;
          case 4551:
            type = 'post_removed';
            const removedETag = event.tags.find(tag => tag[0] === 'e');
            if (removedETag && removedETag[1]) {
              eventId = removedETag[1];
            }
            const removedATag = event.tags.find(tag => tag[0] === 'a');
            if (removedATag && removedATag[1]) {
              groupId = removedATag[1];
            }
            content = 'Your post to a group was removed';
            break;
          case 4552:
            type = 'join_request';
            const joinATag = event.tags.find(tag => tag[0] === 'a');
            if (joinATag && joinATag[1]) {
              groupId = joinATag[1];
            }
            const pTag = event.tags.find(tag => tag[0] === 'p');
            content = pTag ? `User ${pTag[1].slice(0, 8)}... requested to join a group you moderate` : 'Someone requested to join a group you moderate';
            break;
          default:
            type = 'tagged_post'; // fallback
            break;
        }

        return {
          id: event.id,
          type,
          pubkey: event.pubkey,
          createdAt: event.created_at,
          read: readNotifications.has(event.id),
          eventId,
          groupId,
          content,
          event
        };
      });

      // Sort by creation time, newest first
      notifications.sort((a, b) => b.createdAt - a.createdAt);

      const unreadCount = notifications.filter(n => !n.read).length;

      return { notifications, unreadCount };
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const markAsRead = (notificationId: string) => {
    setReadNotifications(prev => {
      const newSet = new Set(prev);
      newSet.add(notificationId);
      return newSet;
    });
  };

  const markAllAsRead = () => {
    if (data?.notifications) {
      setReadNotifications(prev => {
        const newSet = new Set(prev);
        data.notifications.forEach(notification => {
          newSet.add(notification.id);
        });
        return newSet;
      });
    }
  };

  return {
    notifications: data?.notifications || [],
    unreadCount: data?.unreadCount || 0,
    isLoading,
    error,
    refetch,
    markAsRead,
    markAllAsRead
  };
}