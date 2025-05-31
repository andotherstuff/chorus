#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NRelay1 } from '@nostrify/nostrify';

const NIP72_RELAYS = [
  'wss://relay.primal.net',
  'wss://relay.nostr.band'
];

async function testNip72Posts() {
  console.log('Testing NIP-72 community posts...\n');
  
  for (const relayUrl of NIP72_RELAYS) {
    console.log(`\n=== Testing ${relayUrl} ===`);
    
    try {
      const relay = new NRelay1(relayUrl);
      
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Query for communities first
      console.log('Finding communities...');
      const communities = await relay.query([{
        kinds: [34550],
        limit: 3
      }]);
      
      console.log(`Found ${communities.length} communities\n`);
      
      for (const community of communities) {
        const dTag = community.tags.find(t => t[0] === 'd');
        const nameTag = community.tags.find(t => t[0] === 'name');
        const communityId = `34550:${community.pubkey}:${dTag?.[1]}`;
        
        console.log(`Community: ${nameTag?.[1] || 'Unnamed'}`);
        console.log(`  ID: ${communityId}`);
        
        // Query for posts in this community (kind 1 with "a" tag)
        const posts = await relay.query([{
          kinds: [1], // Regular text notes
          '#a': [communityId],
          limit: 10
        }]);
        
        console.log(`  Posts found: ${posts.length}`);
        
        if (posts.length > 0) {
          console.log('  Sample posts:');
          posts.slice(0, 3).forEach(post => {
            const content = post.content.slice(0, 60).replace(/\n/g, ' ');
            console.log(`    - "${content}${post.content.length > 60 ? '...' : ''}"`);
            console.log(`      Author: ${post.pubkey.slice(0, 8)}...`);
            console.log(`      Created: ${new Date(post.created_at * 1000).toISOString()}`);
          });
        }
        
        // Also check for approvals
        const approvals = await relay.query([{
          kinds: [4550],
          '#a': [communityId],
          limit: 5
        }]);
        
        console.log(`  Approvals found: ${approvals.length}`);
        
        // Check for replies
        const replies = await relay.query([{
          kinds: [1111],
          '#a': [communityId],
          limit: 5
        }]);
        
        console.log(`  Replies found: ${replies.length}`);
        
        console.log('');
      }
      
      relay.close();
      
    } catch (error) {
      console.error(`Error testing ${relayUrl}:`, error.message);
    }
  }
}

testNip72Posts().catch(console.error);