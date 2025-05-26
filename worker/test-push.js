#!/usr/bin/env node

/**
 * Simple test script for push notifications
 * Run this after setting up the push API to verify it works
 */

const webpush = require('web-push');

// Test configuration - replace with your values
const vapidKeys = {
  publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa40HycWcqUeMgocvu80aw5iH8KxKCXKxGOKWOW4XRQDhGHZN8PBiKk3YgWo8w',
  privateKey: 'YOUR_VAPID_PRIVATE_KEY_HERE'
};

const pushSubscription = {
  endpoint: 'YOUR_SUBSCRIPTION_ENDPOINT_HERE',
  keys: {
    p256dh: 'YOUR_P256DH_KEY_HERE',
    auth: 'YOUR_AUTH_KEY_HERE'
  }
};

// Set VAPID details
webpush.setVapidDetails(
  'mailto:test@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Test notification payload
const payload = JSON.stringify({
  title: 'Test Push Notification',
  body: 'If you can see this, push notifications are working!',
  icon: '/web-app-manifest-192x192.png',
  badge: '/web-app-manifest-192x192.png',
  data: {
    eventId: 'test-' + Date.now(),
    type: 'test',
    timestamp: Math.floor(Date.now() / 1000)
  }
});

// Send test notification
async function sendTestNotification() {
  try {
    console.log('Sending test notification...');

    const response = await webpush.sendNotification(
      pushSubscription,
      payload,
      {
        TTL: 3600,
        urgency: 'normal'
      }
    );

    console.log('✓ Notification sent successfully!');
    console.log('Response:', response.statusCode, response.headers);

  } catch (error) {
    console.error('✗ Failed to send notification:', error.message);

    if (error.statusCode) {
      console.error('Status Code:', error.statusCode);
    }

    if (error.body) {
      console.error('Response Body:', error.body);
    }
  }
}

// Instructions
console.log('Push Notification Test Tool');
console.log('==========================');
console.log('');

if (vapidKeys.privateKey === 'YOUR_VAPID_PRIVATE_KEY_HERE') {
  console.log('Please update this script with your VAPID keys and subscription details:');
  console.log('1. Replace vapidKeys with your generated VAPID keys');
  console.log('2. Replace pushSubscription with a real subscription from your browser');
  console.log('');
  console.log('To get a subscription:');
  console.log('1. Open your web app in the browser');
  console.log('2. Enable push notifications');
  console.log('3. Check the browser dev tools Network tab for the subscription data');
  console.log('4. Copy the subscription object and paste it here');
  process.exit(1);
}

sendTestNotification();
