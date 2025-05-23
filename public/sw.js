// Service worker for PWA functionality
// Handles CORS issues for Cashu mint requests
// Note: Service workers can't bypass CORS - they follow the same origin policy
// This just provides better error handling for CORS failures

// Install event - skip waiting to activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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