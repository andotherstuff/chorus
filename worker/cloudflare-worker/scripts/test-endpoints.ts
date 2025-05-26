import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testEndpoints() {
  try {
    // Test registration endpoint
    console.log('\nTesting /register endpoint...');
    const registerResponse = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        npub: 'test-npub',
        subscription: {
          endpoint: 'https://test-endpoint.com',
          keys: {
            p256dh: 'test-p256dh',
            auth: 'test-auth'
          }
        }
      })
    });
    console.log('Register response:', await registerResponse.json());

    // Test test-notification endpoint
    console.log('\nTesting /test-notification endpoint...');
    const notificationResponse = await fetch(`${BASE_URL}/test-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        npub: 'test-npub'
      })
    });
    console.log('Notification response:', await notificationResponse.json());

    // Test metrics endpoint
    console.log('\nTesting /metrics endpoint...');
    const metricsResponse = await fetch(`${BASE_URL}/metrics`);
    console.log('Metrics response:', await metricsResponse.json());

    // Test logs endpoint
    console.log('\nTesting /logs endpoint...');
    const logsResponse = await fetch(`${BASE_URL}/logs`);
    console.log('Logs response:', await logsResponse.json());

  } catch (error) {
    console.error('Error testing endpoints:', error);
  }
}

testEndpoints(); 