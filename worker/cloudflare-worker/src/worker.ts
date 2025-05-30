/**
 * Cloudflare Worker for NIP-72 Nostr Relay Polling
 * Monitors public groups for new events and triggers push notifications
 */

import { NostrEvent, verifyEvent } from 'nostr-tools';

export interface Env {
  KV: KVNamespace;
  RELAY_URL: string;
  PUSH_DISPATCH_API: string;
  BOT_TOKEN: string;
}

interface RelayEvent {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
  sig: string;
}

interface NotificationTarget {
  userId: string;
  priority: 'high' | 'normal';
  reason: 'mention' | 'group_activity' | 'moderation';
}

/**
 * Main worker entry point - handles scheduled events and HTTP requests
 */
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Scheduled event triggered:', event.scheduledTime);

    try {
      await pollRelayForUpdates(env, ctx);
    } catch (error) {
      console.error('Error in scheduled polling:', error);
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      switch (url.pathname) {
        case '/heartbeat': {
}          return handleHeartbeat(request, env);
        case '/health': {
}          return handleHealthCheck(env);
        case '/stats': {
}          return handleStats(env);
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('Error handling request:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};

/**
 * Poll the NIP-72 relay for new events and process them
 */
async function pollRelayForUpdates(env: Env, ctx: ExecutionContext): Promise<void> {
  const relayUrl = env.RELAY_URL;
  const relayId = new URL(relayUrl).hostname;

  // Get the last seen timestamp for this relay
  const lastSeenKey = `relay_last_seen:${relayId}`;
  const lastSeen = await env.KV.get(lastSeenKey);
  const since = lastSeen ? parseInt(lastSeen) : Math.floor(Date.now() / 1000) - 3600; // Default to 1 hour ago

  console.log(`Polling ${relayUrl} for events since ${since}`);

  try {
    // Connect to relay and fetch new events
    const events = await fetchEventsFromRelay(relayUrl, since);
    console.log(`Fetched ${events.length} new events from relay`);

    let newestTimestamp = since;

    for (const event of events) {
      // Track newest event timestamp
      if (event.created_at > newestTimestamp) {
        newestTimestamp = event.created_at;
      }

      // Check if we've already processed this event (deduplication)
      const eventCacheKey = `event_cache:${event.id}`;
      const cached = await env.KV.get(eventCacheKey);

      if (cached) {
        console.log(`Skipping already processed event: ${event.id}`);
        continue;
      }

      // Process the event for notifications
      ctx.waitUntil(processEventForNotifications(event, env));

      // Cache the event to prevent reprocessing
      ctx.waitUntil(
        env.KV.put(eventCacheKey, JSON.stringify(event), { expirationTtl: 3600 })
      );
    }

    // Update the last seen timestamp
    if (events.length > 0) {
      await env.KV.put(lastSeenKey, newestTimestamp.toString());
    }

  } catch (error) {
    console.error('Error polling relay:', error);
  }
}

/**
 * Fetch events from the Nostr relay since a given timestamp
 */
async function fetchEventsFromRelay(relayUrl: string, since: number): Promise<RelayEvent[]> {
  const events: RelayEvent[] = [];

  // Create WebSocket connection to relay
  const ws = new WebSocket(relayUrl);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket timeout'));
    }, 10000); // 10 second timeout

    ws.onopen = () => {
      console.log('Connected to relay:', relayUrl);

      // Request events from relay
      // NIP-72 public groups are kind 34550, and we want events in/about groups
      const filter = {
        kinds: [1, 7, 9735, 34550, 4550, 4551, 4552, 4553, 1984], // Various group-related events
        since: since,
        limit: 100
      };

      const subscription = JSON.stringify(['REQ', 'sub1', filter]);
      ws.send(subscription);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message[0] === 'EVENT' && message[2]) {
          const nostrEvent = message[2] as RelayEvent;

          // Verify event signature
          if (verifyEvent(nostrEvent)) {
            events.push(nostrEvent);
          } else {
            console.warn('Invalid event signature:', nostrEvent.id);
          }
        } else if (message[0] === 'EOSE') {
          // End of stored events - close connection and return results
          clearTimeout(timeout);
          ws.close();
          resolve(events);
        }
      } catch (error) {
        console.error('Error parsing relay message:', error);
      }
    };

    ws.onerror = (error) => {
      clearTimeout(timeout);
      console.error('WebSocket error:', error);
      reject(error);
    };

    ws.onclose = () => {
      clearTimeout(timeout);
    };
  });
}

/**
 * Process a Nostr event to determine if notifications should be sent
 */
async function processEventForNotifications(event: RelayEvent, env: Env): Promise<void> {
  const targets = await determineNotificationTargets(event, env);

  if (targets.length === 0) {
    return;
  }

  console.log(`Event ${event.id} has ${targets.length} notification targets`);

  // Queue push notifications for each target
  for (const target of targets) {
    await queuePushNotification(target, event, env);
  }
}

/**
 * Determine which users should receive notifications for this event
 */
async function determineNotificationTargets(event: RelayEvent, env: Env): Promise<NotificationTarget[]> {
  const targets: NotificationTarget[] = [];

  // Get currently online users (for normal priority events)
  const onlineUsers = await getCurrentlyOnlineUsers(env);

  switch (event.kind) {
    case 1: // Text note {
    { // Text note
}      // Check for mentions in tags
      const mentions = event.tags.filter(tag => tag[0] === 'p').map(tag => tag[1]);
      for (const pubkey of mentions) {
        targets.push({
          userId: pubkey,
          priority: 'high',
          reason: 'mention'
        });
      }

      // Check if this is posted in a group context
      const groupTag = event.tags.find(tag => tag[0] === 'a');
      if (groupTag) {
        // Add group members who are online (normal priority)
        const groupMembers = await getGroupMembers(groupTag[1], env);
        for (const member of groupMembers) {
          if (onlineUsers.has(member) && member !== event.pubkey) {
            targets.push({
              userId: member,
              priority: 'normal',
              reason: 'group_activity'
            });
          }
        }
      }
      break;

    case 7: // Reaction {
    { // Reaction
}      // Notify the author of the reacted-to event
      const reactedEventId = event.tags.find(tag => tag[0] === 'e')?.[1];
      if (reactedEventId) {
        const originalEvent = await getEventById(reactedEventId, env);
        if (originalEvent && originalEvent.pubkey !== event.pubkey) {
          targets.push({
            userId: originalEvent.pubkey,
            priority: 'normal',
            reason: 'group_activity'
          });
        }
      }
      break;

    case 4550: // Group admission {
}    case 4551: // Group removal {
}      // Notify group moderators
      const groupRef = event.tags.find(tag => tag[0] === 'a')?.[1];
      if (groupRef) {
        const moderators = await getGroupModerators(groupRef, env);
        for (const mod of moderators) {
          targets.push({
            userId: mod,
            priority: 'high',
            reason: 'moderation'
          });
        }
      }
      break;

    case 1984: // Report {
}      // Notify group moderators
      const reportGroupRef = event.tags.find(tag => tag[0] === 'a')?.[1];
      if (reportGroupRef) {
        const moderators = await getGroupModerators(reportGroupRef, env);
        for (const mod of moderators) {
          targets.push({
            userId: mod,
            priority: 'high',
            reason: 'moderation'
          });
        }
      }
      break;
  }

  // Remove duplicates
  const uniqueTargets = targets.filter((target, index) =>
    targets.findIndex(t => t.userId === target.userId) === index
  );

  return uniqueTargets;
}

/**
 * Queue a push notification for a specific user
 */
async function queuePushNotification(target: NotificationTarget, event: RelayEvent, env: Env): Promise<void> {
  try {
    const notificationPayload = createNotificationPayload(target, event);

    const response = await fetch(`${env.PUSH_DISPATCH_API}/push/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.BOT_TOKEN}`,
      },
      body: JSON.stringify({
        userId: target.userId,
        event: notificationPayload
      }),
    });

    if (!response.ok) {
      throw new Error(`Push dispatch failed: ${response.status} ${response.statusText}`);
    }

    console.log(`Push notification queued for user ${target.userId}`);

  } catch (error) {
    console.error('Error queueing push notification:', error);
    // Could implement retry logic here
  }
}

/**
 * Create notification payload based on event and target
 */
function createNotificationPayload(target: NotificationTarget, event: RelayEvent): any {
  let title = 'New Activity';
  let body = 'You have new activity on +chorus';

  const groupTag = event.tags.find(tag => tag[0] === 'a');
  const groupId = groupTag?.[1];

  switch (event.kind) {
    case 1: {
    { // Text note
}      if (target.reason === 'mention') {
        title = 'You were mentioned';
        body = `Someone mentioned you in a post`;
      } else {
        title = 'New post';
        body = 'New activity in a group you follow';
      }
      break;

    case 7: {
    { // Reaction
}      title = 'New reaction';
      body = 'Someone reacted to your post';
      break;

    case 4550: {
}      title = 'Post approved';
      body = 'A post was approved in your group';
      break;

    case 4551: {
}      title = 'Post removed';
      body = 'A post was removed from your group';
      break;

    case 1984: {
}      title = 'New report';
      body = 'A new report needs your attention';
      break;
  }

  return {
    title,
    body,
    icon: '/web-app-manifest-192x192.png',
    badge: '/web-app-manifest-192x192.png',
    data: {
      eventId: event.id,
      groupId,
      type: getNotificationType(event.kind, target.reason),
      timestamp: event.created_at
    }
  };
}

/**
 * Get notification type string for the UI
 */
function getNotificationType(kind: number, reason: string): string {
  switch (kind) {
    case 1: {
    { // Text note
}      return reason === 'mention' ? 'mention' : 'post';
    case 7: {
    { // Reaction
}      return 'reaction';
    case 4550: {
}      return 'post_approved';
    case 4551: {
}      return 'post_removed';
    case 1984: {
}      return 'report';
    default:
      return 'activity';
  }
}

/**
 * Handle heartbeat requests from client apps
 */
async function handleHeartbeat(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'PUT') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { userId } = await request.json() as { userId: string };

    if (!userId) {
      return new Response('Missing userId', { status: 400 });
    }

    // Update user's online status with 15-minute TTL
    await env.KV.put(`online_users:${userId}`, Date.now().toString(), {
      expirationTtl: 900
    });

    return new Response('OK');
  } catch (error) {
    console.error('Error handling heartbeat:', error);
    return new Response('Bad request', { status: 400 });
  }
}

/**
 * Handle health check requests
 */
async function handleHealthCheck(env: Env): Promise<Response> {
  const health = {
    status: 'ok',
    timestamp: Date.now(),
    relay: env.RELAY_URL,
    version: '1.0.0'
  };

  return new Response(JSON.stringify(health), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle stats requests
 */
async function handleStats(env: Env): Promise<Response> {
  // Get some basic stats from KV
  const onlineUsersCount = await getCurrentlyOnlineUsers(env).then(users => users.size);

  const stats = {
    onlineUsers: onlineUsersCount,
    timestamp: Date.now()
  };

  return new Response(JSON.stringify(stats), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Helper functions
 */

async function getCurrentlyOnlineUsers(env: Env): Promise<Set<string>> {
  // This is a simplified implementation
  // In practice, you'd need to iterate through KV keys or maintain a separate index
  return new Set();
}

async function getGroupMembers(groupId: string, env: Env): Promise<string[]> {
  // This would need to be implemented based on how group membership is tracked
  // Could cache group membership data in KV
  return [];
}

async function getGroupModerators(groupId: string, env: Env): Promise<string[]> {
  // This would need to be implemented based on how group moderation is tracked
  return [];
}

async function getEventById(eventId: string, env: Env): Promise<RelayEvent | null> {
  // Check cache first
  const cached = await env.KV.get(`event_cache:${eventId}`);
  if (cached) {
    return JSON.parse(cached);
  }

  // Would need to query relay if not cached
  return null;
}
