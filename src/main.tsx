import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import './index.css'

// Enhanced service worker registration for PWA and push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
        
        // Listen for service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New service worker available');
                // Could show update notification to user here
              }
            });
          }
        });
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
      
    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('Message from SW:', event.data);
      
      if (event.data?.type === 'NEW_NOTIFICATION') {
        // Handle new notification - could update UI indicator
        console.log('New push notification received');
      } else if (event.data?.type === 'NAVIGATE_TO') {
        // Handle navigation from notification click
        window.location.href = event.data.url;
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
