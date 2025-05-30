#!/usr/bin/env node

import { NRelay1, NSecSigner } from '@nostrify/nostrify';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import WebSocket from 'ws';

// Polyfill WebSocket for Node.js
global.WebSocket = WebSocket;

const NIP29_RELAYS = [
  'wss://groups.fiatjaf.com',
  'wss://communities.nos.social'
];

// Test user keys (generate new ones for testing)
const sk = generateSecretKey();
const pk = getPublicKey(sk);
const signer = new NSecSigner(sk);

console.log('Test user pubkey:', pk);

async function testRelay(relayUrl) {
  console.log(`\n=== Testing ${relayUrl} ===`);
  
  try {
    // Connect to relay
    console.log('Connecting...');
    const relay = new NRelay1(relayUrl);
    
    // Give it time to connect
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 1: Query for public groups (kind 39000)
    console.log('\n1. Querying for public groups (kind 39000)...');
    try {
      const publicGroups = await relay.query([{
        kinds: [39000],
        limit: 10
      }]);
      console.log(`Found ${publicGroups.length} public groups`);
      if (publicGroups.length > 0) {
        const group = publicGroups[0];
        const nameTag = group.tags.find(t => t[0] === 'name');
        const dTag = group.tags.find(t => t[0] === 'd');
        console.log('Sample group:', {
          id: dTag?.[1],
          name: nameTag?.[1],
          pubkey: group.pubkey
        });
      }
    } catch (error) {
      console.error('Failed to query public groups:', error.message);
    }
    
    // Test 2: Create a test group
    const groupId = `test_group_${Date.now()}`;
    console.log(`\n2. Creating test group with ID: ${groupId}`);
    
    const createEvent = await signer.signEvent({
      kind: 9007, // GROUP_CREATE
      tags: [
        ['h', groupId], // Group ID is required!
        ['name', `Test Group ${new Date().toISOString()}`],
        ['about', 'Testing NIP-29 implementation'],
        ['picture', 'https://placekitten.com/200/200']
      ],
      content: '',
      created_at: Math.floor(Date.now() / 1000)
    });
    
    console.log('Publishing group creation event...');
    await relay.event(createEvent);
    console.log('Group creation event published');
    
    // Wait for relay to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 3: Query for the created group
    console.log('\n3. Querying for our created group...');
    const createdGroups = await relay.query([{
      kinds: [39000],
      '#d': [groupId]
    }]);
    
    if (createdGroups.length > 0) {
      console.log('✓ Group created successfully!');
    } else {
      console.log('✗ Group not found after creation');
    }
    
    // Test 4: Post a message to the group
    console.log('\n4. Posting a message to the group...');
    const messageEvent = await signer.signEvent({
      kind: 9, // NIP-29 text note
      tags: [
        ['h', groupId]
      ],
      content: 'Hello from test script!',
      created_at: Math.floor(Date.now() / 1000)
    });
    
    await relay.event(messageEvent);
    console.log('Message posted');
    
    // Test 5: Query for messages
    console.log('\n5. Querying for group messages...');
    const messages = await relay.query([{
      kinds: [9, 11],
      '#h': [groupId],
      limit: 10
    }]);
    
    console.log(`Found ${messages.length} messages`);
    if (messages.length > 0) {
      console.log('Sample message:', {
        content: messages[0].content,
        author: messages[0].pubkey.slice(0, 8) + '...'
      });
    }
    
    // Test 6: Query for member list
    console.log('\n6. Querying for member list...');
    const memberLists = await relay.query([{
      kinds: [39002],
      '#d': [groupId]
    }]);
    
    console.log(`Found ${memberLists.length} member list events`);
    if (memberLists.length > 0) {
      const members = memberLists[0].tags.filter(t => t[0] === 'p');
      console.log(`Group has ${members.length} members`);
    }
    
    // Close connection
    relay.close();
    console.log('\n✓ Tests completed for', relayUrl);
    
  } catch (error) {
    console.error('✗ Test failed:', error);
  }
}

async function runTests() {
  console.log('Starting NIP-29 relay tests...');
  
  for (const relay of NIP29_RELAYS) {
    await testRelay(relay);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n=== All tests completed ===');
}

// Handle auth challenges
process.on('message', (msg) => {
  console.log('Received message:', msg);
});

runTests().catch(console.error);