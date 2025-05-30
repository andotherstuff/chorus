// Service Worker for PWA and Push Notifications
// Enhanced to handle web push notifications as per PRD
// Also handles CORS issues for Cashu mint requests with better error handling

// Install event - skip waiting to activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Fetch event - handle CORS for Cashu mints
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Check if this is a Cashu mint request that might have CORS issues
  if (url.pathname.includes('/v1/info') || url.pathname.includes('/v1/keys') || url.pathname.includes('/v1/keysets')) {
    // For Cashu mint requests, add CORS mode
    event.respondWith(
      fetch(event.request.url, {
        method: event.request.method,
        headers: event.request.headers,
        body: event.request.method !== 'GET' && event.request.method !== 'HEAD' ? event.request.body : undefined,
        mode: 'cors',
        credentials: 'omit' // Don't send cookies to avoid CORS issues
      }).catch(error => {
        // If CORS fails, return a mock response for testing
        console.warn('CORS request failed for:', event.request.url, error);
        
        // Return a mock error response
        return new Response(JSON.stringify({ 
          error: 'CORS_ERROR',
          message: 'Unable to connect to mint due to CORS policy',
          url: event.request.url 
        }), {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
  } else {
    // For all other requests, pass through normally
    event.respondWith(fetch(event.request));
  }
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);

  let notificationData = {
    title: 'Chorus',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: 'chorus-notification',
    requireInteraction: false,
    data: {}
  };

  // Parse the push data if available
  if (event.data) {
    try {
      const data = event.data.json();
      
      // Update notification based on type
      switch (data.type) {
        case 'mention':
          notificationData.title = 'New Mention';
          notificationData.body = `${data.authorName || 'Someone'} mentioned you in a post`;
          notificationData.tag = `mention-${data.eventId}`;
          notificationData.data = {
            type: 'mention',
            eventId: data.eventId,
            groupId: data.groupId
          };
          break;

        case 'reply':
          notificationData.title = 'New Reply';
          notificationData.body = `${data.authorName || 'Someone'} replied to your post`;
          notificationData.tag = `reply-${data.eventId}`;
          notificationData.data = {
            type: 'reply',
            eventId: data.eventId,
            groupId: data.groupId
          };
          break;

        case 'group-invite':
          notificationData.title = 'Group Invitation';
          notificationData.body = `You've been invited to join ${data.groupName || 'a group'}`;
          notificationData.tag = `invite-${data.groupId}`;
          notificationData.data = {
            type: 'group-invite',
            groupId: data.groupId
          };
          break;

        case 'join-request':
          notificationData.title = 'New Join Request';
          notificationData.body = `${data.requesterName || 'Someone'} wants to join your group`;
          notificationData.tag = `join-request-${data.requestId}`;
          notificationData.data = {
            type: 'join-request',
            groupId: data.groupId,
            requestId: data.requestId
          };
          break;

        case 'nutzap':
          notificationData.title = 'New Nutzap!';
          notificationData.body = `${data.senderName || 'Someone'} sent you ${data.amount || 'some'} sats`;
          notificationData.tag = `nutzap-${data.eventId}`;
          notificationData.data = {
            type: 'nutzap',
            eventId: data.eventId,
            amount: data.amount
          };
          break;

        default:
          // Use the data as-is if it has title and body
          if (data.title) notificationData.title = data.title;
          if (data.body) notificationData.body = data.body;
          if (data.icon) notificationData.icon = data.icon;
          if (data.badge) notificationData.badge = data.badge;
          if (data.tag) notificationData.tag = data.tag;
          if (data.data) notificationData.data = data.data;
      }
    } catch (e) {
      console.error('Failed to parse push data:', e);
    }
  }

  // Show the notification
  const showNotificationPromise = self.registration.showNotification(
    notificationData.title,
    {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      actions: getNotificationActions(notificationData.data.type)
    }
  );

  event.waitUntil(showNotificationPromise);
});

// Helper function to get notification actions based on type
function getNotificationActions(type) {
  switch (type) {
    case 'mention':
    case 'reply':
      return [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
    case 'group-invite':
      return [
        { action: 'accept', title: 'Accept' },
        { action: 'decline', title: 'Decline' }
      ];
    case 'join-request':
      return [
        { action: 'approve', title: 'Approve' },
        { action: 'reject', title: 'Reject' }
      ];
    case 'nutzap':
      return [
        { action: 'view', title: 'View' },
        { action: 'thank', title: 'Thank' }
      ];
    default:
      return [];
  }
}

// Notification click event - handle notification interactions
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.notification.tag, 'Action:', event.action);
  
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = '/';

  // Handle different actions
  if (event.action === 'dismiss' || event.action === 'decline' || event.action === 'reject') {
    // Just close the notification
    return;
  }

  // Determine the target URL based on notification type and action
  switch (data.type) {
    case 'mention':
    case 'reply':
      if (data.groupId && data.eventId) {
        targetUrl = `/groups/${data.groupId}#${data.eventId}`;
      }
      break;

    case 'group-invite':
      if (data.groupId) {
        targetUrl = `/groups/${data.groupId}`;
      }
      break;

    case 'join-request':
      if (data.groupId) {
        targetUrl = `/groups/${data.groupId}/settings?tab=members`;
      }
      break;

    case 'nutzap':
      targetUrl = '/wallet';
      break;
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('Push subscription changed:', event);

  const resubscribePromise = self.registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: null // Will need to be set with VAPID key
  }).then(subscription => {
    // Send the new subscription to the server
    return fetch('/api/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription.toJSON())
    });
  });

  event.waitUntil(resubscribePromise);
});