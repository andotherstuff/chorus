#!/usr/bin/env node

import { NostrRelay } from '@nostrify/nostrify';
import { WebSocket } from 'ws';

// Set up WebSocket for Node.js environment
global.WebSocket = WebSocket;

const NIP29_RELAYS = [
  'wss://groups.fiatjaf.com',
  'wss://relay.groups.nip29.com'
];

// Test group IDs
const TEST_GROUPS = [
  'test',
  'nostr',
  'general'
];

async function testNIP29Posts() {
  console.log('Testing NIP-29 posts retrieval...\n');

  for (const relayUrl of NIP29_RELAYS) {
    console.log(`\nTesting relay: ${relayUrl}`);
    console.log('='.repeat(50));

    try {
      const relay = new NostrRelay(relayUrl);
      await relay.connect();
      console.log('✓ Connected to relay');

      // Test fetching posts for each group
      for (const groupId of TEST_GROUPS) {
        console.log(`\nTesting group: ${groupId}`);
        
        // Query for NIP-29 posts (kind 11)
        const filter = {
          kinds: [11],
          '#h': [groupId],
          limit: 5
        };

        console.log('Query filter:', JSON.stringify(filter, null, 2));

        const events = [];
        const subscription = relay.req([filter]);

        await new Promise((resolve) => {
          subscription.on('event', (event) => {
            events.push(event);
          });

          subscription.on('eose', () => {
            resolve();
          });

          // Timeout after 5 seconds
          setTimeout(() => resolve(), 5000);
        });

        subscription.close();

        if (events.length > 0) {
          console.log(`✓ Found ${events.length} posts in group "${groupId}"`);
          
          // Display first post details
          const firstPost = events[0];
          console.log('\nFirst post details:');
          console.log(`  - ID: ${firstPost.id.substring(0, 16)}...`);
          console.log(`  - Author: ${firstPost.pubkey.substring(0, 16)}...`);
          console.log(`  - Content: ${firstPost.content.substring(0, 100)}${firstPost.content.length > 100 ? '...' : ''}`);
          console.log(`  - Created: ${new Date(firstPost.created_at * 1000).toLocaleString()}`);
          
          // Check for h tags
          const hTags = firstPost.tags.filter(tag => tag[0] === 'h');
          console.log(`  - Groups: ${hTags.map(tag => tag[1]).join(', ')}`);
        } else {
          console.log(`✗ No posts found in group "${groupId}"`);
        }
      }

      // Test metadata events (kind 39000)
      console.log('\nTesting group metadata (kind 39000)...');
      const metadataFilter = {
        kinds: [39000],
        limit: 10
      };

      const metadataEvents = [];
      const metadataSubscription = relay.req([metadataFilter]);

      await new Promise((resolve) => {
        metadataSubscription.on('event', (event) => {
          metadataEvents.push(event);
        });

        metadataSubscription.on('eose', () => {
          resolve();
        });

        setTimeout(() => resolve(), 5000);
      });

      metadataSubscription.close();

      if (metadataEvents.length > 0) {
        console.log(`✓ Found ${metadataEvents.length} group metadata events`);
        
        // Display group names
        metadataEvents.forEach(event => {
          const dTag = event.tags.find(tag => tag[0] === 'd');
          if (dTag) {
            try {
              const metadata = JSON.parse(event.content);
              console.log(`  - Group: ${dTag[1]} - Name: ${metadata.name || 'Unnamed'}`);
            } catch (e) {
              console.log(`  - Group: ${dTag[1]} - Invalid metadata`);
            }
          }
        });
      } else {
        console.log('✗ No group metadata found');
      }

      // Test admin events (kind 39001)
      console.log('\nTesting admin events (kind 39001)...');
      const adminFilter = {
        kinds: [39001],
        limit: 5
      };

      const adminEvents = [];
      const adminSubscription = relay.req([adminFilter]);

      await new Promise((resolve) => {
        adminSubscription.on('event', (event) => {
          adminEvents.push(event);
        });

        adminSubscription.on('eose', () => {
          resolve();
        });

        setTimeout(() => resolve(), 3000);
      });

      adminSubscription.close();

      if (adminEvents.length > 0) {
        console.log(`✓ Found ${adminEvents.length} admin events`);
      } else {
        console.log('✗ No admin events found');
      }

      await relay.close();
      console.log('\n✓ Disconnected from relay');

    } catch (error) {
      console.error(`✗ Error testing relay ${relayUrl}:`, error.message);
    }
  }

  console.log('\n\nTest Summary:');
  console.log('='.repeat(50));
  console.log('NIP-29 posts use kind 11 (not kind 1)');
  console.log('Posts must have an "h" tag with the group ID');
  console.log('Group metadata uses kind 39000');
  console.log('Admin events use kind 39001');
  console.log('\nMake sure your app queries with the correct filters!');
}

// Run the test
testNIP29Posts().catch(console.error);