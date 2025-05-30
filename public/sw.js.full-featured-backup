// Enhanced Service Worker for PWA with proper caching and offline support

const CACHE_NAME = 'chorus-pwa-v1';
const STATIC_CACHE_NAME = 'chorus-static-v1';
const RUNTIME_CACHE_NAME = 'chorus-runtime-v1';

// Files to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-16x16.png',
  '/icons/icon-32x32.png',
  '/icons/icon-48x48.png',
  '/icons/icon-96x96.png',
  '/icons/icon-144x144.png',
  '/icons/icon-192x192.png',
  '/icons/icon-256x256.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              // Delete old caches that don't match current version
              return !cacheName.includes('chorus-') || 
                     (cacheName !== STATIC_CACHE_NAME && 
                      cacheName !== RUNTIME_CACHE_NAME);
            })
            .map(cacheName => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated successfully');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle navigation requests (for SPA routing)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE_NAME)
              .then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Return cached index.html for offline navigation
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Handle static assets with cache-first strategy
  if (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(request)
            .then(response => {
              if (response.ok) {
                const responseClone = response.clone();
                caches.open(STATIC_CACHE_NAME)
                  .then(cache => cache.put(request, responseClone));
              }
              return response;
            });
        })
    );
    return;
  }

  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE_NAME)
              .then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Return cached response if available
          return caches.match(request);
        })
    );
    return;
  }

  // Handle other requests with network-first, fallback to cache
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE_NAME)
            .then(cache => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received:', event);
  
  let notificationData = {
    title: 'New activity',
    body: 'You have new activity on +chorus',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    data: {}
  };

  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = {
        ...notificationData,
        ...pushData
      };
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
    }
  }

  const showNotificationPromise = self.registration.showNotification(
    notificationData.title,
    {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      data: notificationData.data,
      tag: notificationData.data.eventId || 'default',
      requireInteraction: false,
      silent: false,
      vibrate: [200, 100, 200],
      actions: notificationData.actions || []
    }
  );

  // Notify any open tabs about the new notification
  const notifyTabsPromise = self.clients.matchAll({ 
    type: 'window', 
    includeUncontrolled: true 
  }).then(clients => {
    clients.forEach(client => {
      client.postMessage({ 
        type: 'NEW_NOTIFICATION',
        data: notificationData 
      });
    });
  });

  event.waitUntil(
    Promise.all([showNotificationPromise, notifyTabsPromise])
  );
});

// Notification click event - handle clicks on notifications
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click event:', event);
  
  event.notification.close();

  const notificationData = event.notification.data || {};
  
  // Determine the URL to open based on notification data
  let urlToOpen = '/notifications';
  
  if (notificationData.groupId) {
    urlToOpen = `/group/${notificationData.groupId}`;
    
    // Add specific parameters based on notification type
    if (notificationData.eventId) {
      urlToOpen += `?post=${notificationData.eventId}`;
    }
    
    if (notificationData.type === 'join_request') {
      urlToOpen += '#members?membersTab=requests';
    } else if (notificationData.type === 'report') {
      urlToOpen += `#reports?reportId=${notificationData.eventId}`;
    }
  }

  const openWindowPromise = self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then(clientList => {
    // Check if there's already a window open
    for (const client of clientList) {
      if (client.url.includes(self.location.origin)) {
        // Focus the existing window and navigate to the notification URL
        client.postMessage({
          type: 'NAVIGATE_TO',
          url: urlToOpen
        });
        return client.focus();
      }
    }
    
    // No window open, open a new one
    const fullUrl = new URL(urlToOpen, self.location.origin).href;
    return self.clients.openWindow(fullUrl);
  });

  event.waitUntil(openWindowPromise);
});

// Background sync for offline functionality
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);
  
  if (event.tag === 'background-sync-notifications') {
    event.waitUntil(syncNotifications());
  } else if (event.tag === 'background-sync-posts') {
    event.waitUntil(syncPendingPosts());
  }
});

async function syncNotifications() {
  console.log('[SW] Syncing notifications...');
  // Implementation for syncing notifications when back online
}

async function syncPendingPosts() {
  console.log('[SW] Syncing pending posts...');
  // Implementation for syncing pending posts when back online
}

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed:', event);
  
  const resubscribePromise = self.registration.pushManager.subscribe({
    userVisibleOnly: true,
    // applicationServerKey will need to be set with actual VAPID key
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

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
      case 'GET_VERSION':
        event.ports[0].postMessage({ version: CACHE_NAME });
        break;
      case 'CACHE_URLS':
        const urls = event.data.payload;
        event.waitUntil(
          caches.open(RUNTIME_CACHE_NAME)
            .then(cache => cache.addAll(urls))
        );
        break;
    }
  }
});

console.log('[SW] Service Worker script loaded');
