#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NRelay1, NSecSigner } from '@nostrify/nostrify';
import { generateSecretKey, nip19 } from 'nostr-tools';

// Create a test user
const sk = generateSecretKey();
const signer = new NSecSigner(sk);
const pubkey = await signer.getPublicKey();

console.log('Test user:', nip19.npubEncode(pubkey));

async function testCommunitiesNosSocial() {
  console.log('\nTesting communities.nos.social...\n');
  
  const relay = new NRelay1('wss://communities.nos.social/');
  
  try {
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 1. Query without authentication
    console.log('1. Querying groups without authentication...');
    let groups = await relay.query([{
      kinds: [39000],
      limit: 10
    }]);
    
    console.log(`Found ${groups.length} groups without auth`);
    
    if (groups.length > 0) {
      console.log('\nFirst group:', {
        id: groups[0].tags.find(t => t[0] === 'd')?.[1],
        name: groups[0].tags.find(t => t[0] === 'name')?.[1],
        public: groups[0].tags.some(t => t[0] === 'public'),
        private: groups[0].tags.some(t => t[0] === 'private')
      });
    }
    
    // 2. Listen for AUTH challenges
    console.log('\n2. Setting up AUTH handler and reconnecting...');
    relay.close();
    
    // Reconnect with AUTH handling
    const relay2 = new NRelay1('wss://communities.nos.social/');
    
    let authChallengeReceived = false;
    let authEventSent = false;
    
    // Override send to intercept AUTH messages
    const originalSend = relay2.send;
    relay2.send = function(...args) {
      console.log('[SEND]', JSON.stringify(args));
      if (args[0] === 'AUTH') {
        authEventSent = true;
      }
      return originalSend.apply(this, args);
    };
    
    // Listen for messages
    relay2.req([{ kinds: [39000], limit: 10 }], {
      onevent(event) {
        console.log('[EVENT] Received group:', {
          id: event.tags.find(t => t[0] === 'd')?.[1],
          name: event.tags.find(t => t[0] === 'name')?.[1]
        });
      },
      onauth(challenge) {
        console.log('[AUTH] Challenge received:', challenge);
        authChallengeReceived = true;
      },
      oneose() {
        console.log('[EOSE] End of stored events');
      }
    });
    
    // Wait to see what happens
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\nAuth summary:');
    console.log('- AUTH challenge received:', authChallengeReceived);
    console.log('- AUTH event sent:', authEventSent);
    
    // 3. Try with different queries
    console.log('\n3. Testing different query patterns...');
    
    // Try querying with authors
    console.log('\nQuerying with author filter...');
    groups = await relay2.query([{
      kinds: [39000],
      authors: [pubkey],
      limit: 10
    }]);
    console.log(`Found ${groups.length} groups authored by us`);
    
    // Try querying specific group
    console.log('\nQuerying for specific group IDs...');
    const testGroupIds = ['welcome', 'general', 'test', 'public'];
    for (const groupId of testGroupIds) {
      const specificGroups = await relay2.query([{
        kinds: [39000],
        '#d': [groupId],
        limit: 1
      }]);
      console.log(`Group "${groupId}": ${specificGroups.length > 0 ? 'Found' : 'Not found'}`);
    }
    
    // 4. Try to create a group (if we have permission)
    console.log('\n4. Attempting to create a group...');
    try {
      const createEvent = await signer.signEvent({
        kind: 9007,
        content: '',
        tags: [
          ['h', `test-${Date.now()}`],
          ['name', 'Test Group'],
          ['about', 'Testing group creation'],
          ['public']
        ],
        created_at: Math.floor(Date.now() / 1000)
      });
      
      await relay2.event(createEvent);
      console.log('Group creation event sent');
      
      // Wait and check if it was created
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const createdGroups = await relay2.query([{
        kinds: [39000],
        '#d': [createEvent.tags.find(t => t[0] === 'h')[1]]
      }]);
      
      console.log(`Group creation ${createdGroups.length > 0 ? 'succeeded' : 'failed'}`);
    } catch (error) {
      console.log('Group creation error:', error.message);
    }
    
    relay2.close();
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    relay.close();
  }
}

testCommunitiesNosSocial().catch(console.error);