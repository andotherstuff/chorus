import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserGroups } from '@/hooks/useUserGroups';
import { NostrEvent } from '@nostrify/nostrify';
import { KINDS } from '@/lib/nostr-kinds';

export interface Notification {
  id: string;
  type: 'group_update' | 'tag_post' | 'tag_reply' | 'reaction' | 'post_approved' | 'post_removed' | 'join_request' | 'report' | 'report_action' | 'leave_request' | 'track_published' | 'album_published' | 'track_reaction' | 'album_reaction';
  message: string;
  createdAt: number;
  read: boolean;
  eventId?: string;
  groupId?: string;
  pubkey?: string;
  reportType?: string;
  actionType?: string;
  trackId?: string;
  albumId?: string;
  trackTitle?: string;
  albumTitle?: string;
  artistName?: string;
}

// Helper function to get community ID
const getCommunityId = (community: NostrEvent) => {
  const dTag = community.tags.find(tag => tag[0] === "d");
  return `${KINDS.GROUP}:${community.pubkey}:${dTag ? dTag[1] : ""}`;
};

export function useNotifications() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { data: userGroupsData } = useUserGroups();

  return useQuery({
    queryKey: ['notifications', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user) return [];

      const notifications: Notification[] = [];
      const readNotifications = JSON.parse(localStorage.getItem(`notifications:${user.pubkey}`) || '{}');

      const kinds = [
        KINDS.GROUP_POST,
        KINDS.REACTION,
        KINDS.GROUP_POST_REPLY,
        KINDS.GROUP_POST_APPROVAL,
        KINDS.GROUP_POST_REMOVAL,
        KINDS.GROUP
      ];

      // Query for events that tag the user (group-related)
      const events = await nostr.query(
        [{ kinds, '#p': [user.pubkey], limit: 20 }],
        { signal },
      );

      // Get user's follow list to show music from people they follow
      const followListEvents = await nostr.query(
        [{ kinds: [KINDS.FOLLOW_LIST], authors: [user.pubkey], limit: 1 }],
        { signal },
      );

      let followedPubkeys: string[] = [];
      if (followListEvents.length > 0) {
        // Get the most recent follow list
        const latestFollowList = followListEvents.sort((a, b) => b.created_at - a.created_at)[0];
        followedPubkeys = latestFollowList.tags
          .filter(tag => tag[0] === 'p' && tag[1])
          .map(tag => tag[1]);
      }

      // Query for music events from people the user follows
      let musicEvents: NostrEvent[] = [];
      if (followedPubkeys.length > 0) {
        musicEvents = await nostr.query(
          [{ 
            kinds: [KINDS.MUSIC_TRACK, KINDS.MUSIC_ALBUM], 
            authors: followedPubkeys, 
            limit: 10,
            since: Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60) // Last 7 days
          }],
          { signal },
        );
      }

      // Also query for reactions to user's music
      const userMusicEvents = await nostr.query(
        [{ 
          kinds: [KINDS.MUSIC_TRACK, KINDS.MUSIC_ALBUM], 
          authors: [user.pubkey], 
          limit: 50 
        }],
        { signal },
      );

      const userMusicEventIds = userMusicEvents.map(event => event.id);
      let musicReactions: NostrEvent[] = [];
      if (userMusicEventIds.length > 0) {
        musicReactions = await nostr.query(
          [{ 
            kinds: [KINDS.REACTION], 
            '#e': userMusicEventIds, 
            limit: 20 
          }],
          { signal },
        );
      }

      for (const event of events) {
        // Skip notifications from the user themselves
        if (event.pubkey === user.pubkey) continue;
        
        // Extract group ID from 'a' tag if present (for all notification types)
        const communityRef = event.tags.find(tag => tag[0] === 'a')?.[1];
        const communityParts = communityRef?.split(':');
        const groupId = communityParts && communityParts[0] === String(KINDS.GROUP) ? communityRef : undefined;
        
        switch (event.kind) {
          case KINDS.GROUP_POST: {
            notifications.push({
              id: event.id,
              type: 'tag_post',
              message: `tagged you in a post`,
              createdAt: event.created_at,
              read: !!readNotifications[event.id],
              eventId: event.id,
              pubkey: event.pubkey,
              groupId
            });
            break;
          }
          case KINDS.REACTION: {
            const targetEventId = event.tags.find(tag => tag[0] === 'e')?.[1];
            
            notifications.push({
              id: event.id,
              type: 'reaction',
              message: `reacted to your post`,
              createdAt: event.created_at,
              read: !!readNotifications[event.id],
              eventId: targetEventId,
              pubkey: event.pubkey,
              groupId
            });
            break;
          }
          case KINDS.GROUP_POST_REPLY: {
            notifications.push({
              id: event.id,
              type: 'tag_reply',
              message: `tagged you in a reply`,
              createdAt: event.created_at,
              read: !!readNotifications[event.id],
              eventId: event.id,
              pubkey: event.pubkey,
              groupId
            });
            break;
          }
          case KINDS.GROUP_POST_APPROVAL: {
            // For post approval events, we already have the full community reference in the 'a' tag
            const communityRef = event.tags.find(tag => tag[0] === 'a')?.[1];
            
            notifications.push({
              id: event.id,
              type: 'post_approved',
              message: `approved your post to a group`,
              createdAt: event.created_at,
              read: !!readNotifications[event.id],
              eventId: event.tags.find(tag => tag[0] === 'e')?.[1],
              pubkey: event.pubkey,
              groupId: communityRef
            });
            break;
          }
          case KINDS.GROUP_POST_REMOVAL: {
            // For post removal events, we already have the full community reference in the 'a' tag
            const communityRef = event.tags.find(tag => tag[0] === 'a')?.[1];
            
            notifications.push({
              id: event.id,
              type: 'post_removed',
              message: `removed your post from a group`,
              createdAt: event.created_at,
              read: !!readNotifications[event.id],
              eventId: event.tags.find(tag => tag[0] === 'e')?.[1],
              pubkey: event.pubkey,
              groupId: communityRef
            });
            break;
          }
          case KINDS.GROUP: {
            const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
            const groupName = event.tags.find(tag => tag[0] === 'name')?.[1] || 'Unknown group';
            // Create the full community reference in the format "34550:pubkey:identifier"
            const fullGroupId = `${KINDS.GROUP}:${event.pubkey}:${dTag}`;
            
            notifications.push({
              id: event.id,
              type: 'group_update',
              message: `Your group "${groupName}" has been updated`,
              createdAt: event.created_at,
              read: !!readNotifications[event.id],
              eventId: event.id,
              groupId: fullGroupId
            });
            break;
          }
        }
      }

      // Process music events from followed users
      for (const event of musicEvents) {
        // Skip notifications from the user themselves
        if (event.pubkey === user.pubkey) continue;
        
        const titleTag = event.tags.find(tag => tag[0] === 'title')?.[1];
        const artistTag = event.tags.find(tag => tag[0] === 'artist')?.[1];
        
        if (event.kind === KINDS.MUSIC_TRACK) {
          notifications.push({
            id: event.id,
            type: 'track_published',
            message: `published a new track`,
            createdAt: event.created_at,
            read: !!readNotifications[event.id],
            eventId: event.id,
            pubkey: event.pubkey,
            trackId: event.id,
            trackTitle: titleTag || 'Untitled Track',
            artistName: artistTag || 'Unknown Artist'
          });
        } else if (event.kind === KINDS.MUSIC_ALBUM) {
          notifications.push({
            id: event.id,
            type: 'album_published',
            message: `published a new album`,
            createdAt: event.created_at,
            read: !!readNotifications[event.id],
            eventId: event.id,
            pubkey: event.pubkey,
            albumId: event.id,
            albumTitle: titleTag || 'Untitled Album',
            artistName: artistTag || 'Unknown Artist'
          });
        }
      }

      // Process reactions to user's music
      for (const event of musicReactions) {
        // Skip notifications from the user themselves
        if (event.pubkey === user.pubkey) continue;
        
        const targetEventId = event.tags.find(tag => tag[0] === 'e')?.[1];
        if (!targetEventId) continue;
        
        // Find the original music event to get details
        const originalEvent = userMusicEvents.find(musicEvent => musicEvent.id === targetEventId);
        if (!originalEvent) continue;
        
        const titleTag = originalEvent.tags.find(tag => tag[0] === 'title')?.[1];
        const artistTag = originalEvent.tags.find(tag => tag[0] === 'artist')?.[1];
        
        if (originalEvent.kind === KINDS.MUSIC_TRACK) {
          notifications.push({
            id: event.id,
            type: 'track_reaction',
            message: `reacted to your track`,
            createdAt: event.created_at,
            read: !!readNotifications[event.id],
            eventId: targetEventId,
            pubkey: event.pubkey,
            trackId: targetEventId,
            trackTitle: titleTag || 'Untitled Track',
            artistName: artistTag || 'Unknown Artist'
          });
        } else if (originalEvent.kind === KINDS.MUSIC_ALBUM) {
          notifications.push({
            id: event.id,
            type: 'album_reaction',
            message: `reacted to your album`,
            createdAt: event.created_at,
            read: !!readNotifications[event.id],
            eventId: targetEventId,
            pubkey: event.pubkey,
            albumId: targetEventId,
            albumTitle: titleTag || 'Untitled Album',
            artistName: artistTag || 'Unknown Artist'
          });
        }
      }

      // Add moderator notifications if user is a moderator or owner of any groups
      if (userGroupsData && (userGroupsData.owned?.length > 0 || userGroupsData.moderated?.length > 0)) {
        // Filter groups where the user is a moderator or owner
        const moderatedGroups = [
          ...(userGroupsData.owned || []), 
          ...(userGroupsData.moderated || [])
        ];
        
        // Get all group IDs where the user is a moderator or owner
        const groupIds = moderatedGroups.map(group => getCommunityId(group));
        
        // Fetch all relevant moderation events for these groups
        const reportEvents = await nostr.query(
          [{ 
            kinds: [KINDS.REPORT], // Report events
            '#a': groupIds,
            limit: 20 
          }],
          { signal },
        );

        const reportActionEvents = await nostr.query(
          [{ 
            kinds: [KINDS.GROUP_CLOSE_REPORT], // Report action events
            '#a': groupIds,
            limit: 20 
          }],
          { signal },
        );

        const joinRequestEvents = await nostr.query(
          [{ 
            kinds: [KINDS.GROUP_JOIN_REQUEST], // Join request events
            '#a': groupIds,
            limit: 20 
          }],
          { signal },
        );

        const leaveRequestEvents = await nostr.query(
          [{ 
            kinds: [KINDS.GROUP_LEAVE_REQUEST], // Leave request events
            '#a': groupIds,
            limit: 20 
          }],
          { signal },
        );

        // Process report events
        for (const event of reportEvents) {
          // Skip notifications from the user themselves
          if (event.pubkey === user.pubkey) continue;
          
          const groupId = event.tags.find(tag => tag[0] === 'a')?.[1];
          if (!groupId) continue;

          // Get the report type from the p or e tag
          const pTag = event.tags.find(tag => tag[0] === 'p');
          const eTag = event.tags.find(tag => tag[0] === 'e');
          const reportType = pTag && pTag[2] ? pTag[2] : 
                            (eTag && eTag[2] ? eTag[2] : 'other');

          // Find the group name
          const group = moderatedGroups.find(g => getCommunityId(g) === groupId);
          const nameTag = group?.tags.find(tag => tag[0] === "name");
          const groupName = nameTag ? nameTag[1] : 'Unknown group';

          notifications.push({
            id: event.id,
            type: 'report',
            message: `New ${reportType} report in group`,
            createdAt: event.created_at,
            read: !!readNotifications[event.id],
            eventId: event.id,
            groupId,
            pubkey: event.pubkey,
            reportType
          });
        }

        // Process report action events
        for (const event of reportActionEvents) {
          // Skip notifications from the user themselves
          if (event.pubkey === user.pubkey) continue;
          
          const groupId = event.tags.find(tag => tag[0] === 'a')?.[1];
          if (!groupId) continue;

          const reportId = event.tags.find(tag => tag[0] === 'e')?.[1];
          const actionType = event.tags.find(tag => tag[0] === 't')?.[1] || 'unknown action';

          // Find the group name
          const group = moderatedGroups.find(g => getCommunityId(g) === groupId);
          const nameTag = group?.tags.find(tag => tag[0] === "name");
          const groupName = nameTag ? nameTag[1] : 'Unknown group';

          notifications.push({
            id: event.id,
            type: 'report_action',
            message: `Moderator took action (${actionType}) on a report`,
            createdAt: event.created_at,
            read: !!readNotifications[event.id],
            eventId: reportId,
            groupId,
            pubkey: event.pubkey,
            actionType
          });
        }

        // Process join request events
        for (const event of joinRequestEvents) {
          // Skip notifications from the user themselves
          if (event.pubkey === user.pubkey) continue;
          
          const groupId = event.tags.find(tag => tag[0] === 'a')?.[1];
          if (!groupId) continue;

          // Find the group name
          const group = moderatedGroups.find(g => getCommunityId(g) === groupId);
          const nameTag = group?.tags.find(tag => tag[0] === "name");
          const groupName = nameTag ? nameTag[1] : 'Unknown group';

          notifications.push({
            id: event.id,
            type: 'join_request',
            message: `New request to join group`,
            createdAt: event.created_at,
            read: !!readNotifications[event.id],
            eventId: event.id,
            groupId,
            pubkey: event.pubkey
          });
        }

        // Process leave request events
        for (const event of leaveRequestEvents) {
          // Skip notifications from the user themselves
          if (event.pubkey === user.pubkey) continue;
          
          const groupId = event.tags.find(tag => tag[0] === 'a')?.[1];
          if (!groupId) continue;

          // Find the group name
          const group = moderatedGroups.find(g => getCommunityId(g) === groupId);
          const nameTag = group?.tags.find(tag => tag[0] === "name");
          const groupName = nameTag ? nameTag[1] : 'Unknown group';

          notifications.push({
            id: event.id,
            type: 'leave_request',
            message: `User requested to leave group`,
            createdAt: event.created_at,
            read: !!readNotifications[event.id],
            eventId: event.id,
            groupId,
            pubkey: event.pubkey
          });
        }
      }

      // Sort notifications by creation time (newest first)
      return notifications.sort((a, b) => b.createdAt - a.createdAt);
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });
}

export function useMarkNotificationAsRead() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return (notificationId: string) => {
    if (!user) return;
    
    const storageKey = `notifications:${user.pubkey}`;
    const readNotifications = JSON.parse(localStorage.getItem(storageKey) || '{}');
    
    readNotifications[notificationId] = true;
    localStorage.setItem(storageKey, JSON.stringify(readNotifications));
    
    // Invalidate the notifications query to trigger a refetch and update the badge
    queryClient.invalidateQueries({ queryKey: ['notifications', user.pubkey] });
  };
}

export function useMarkAllNotificationsAsRead() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { data: notifications = [] } = useNotifications();

  return () => {
    if (!user) return;
    
    const storageKey = `notifications:${user.pubkey}`;
    const readNotifications = JSON.parse(localStorage.getItem(storageKey) || '{}');
    
    // Mark all current notifications as read
    for (const notification of notifications) {
      readNotifications[notification.id] = true;
    }
    
    localStorage.setItem(storageKey, JSON.stringify(readNotifications));
    
    // Invalidate the notifications query to trigger a refetch and update the badge
    queryClient.invalidateQueries({ queryKey: ['notifications', user.pubkey] });
  };
}

export function useUnreadNotificationsCount() {
  const { data: notifications = [] } = useNotifications();
  return notifications.filter(notification => !notification.read).length;
}