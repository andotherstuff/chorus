#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NRelay1 } from '@nostrify/nostrify';

const NIP72_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://relay.nostr.band'
];

async function testNip72Members() {
  console.log('Testing NIP-72 community members...\n');
  
  for (const relayUrl of NIP72_RELAYS) {
    console.log(`\n=== Testing ${relayUrl} ===`);
    
    try {
      const relay = new NRelay1(relayUrl);
      
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Query for communities (kind 34550)
      console.log('Querying for communities...');
      const communities = await relay.query([{
        kinds: [34550],
        limit: 5
      }]);
      
      console.log(`Found ${communities.length} communities\n`);
      
      for (const community of communities) {
        const dTag = community.tags.find(t => t[0] === 'd');
        const nameTag = community.tags.find(t => t[0] === 'name');
        const descTag = community.tags.find(t => t[0] === 'description');
        
        console.log(`Community: ${nameTag?.[1] || 'Unnamed'}`);
        console.log(`  ID: ${dTag?.[1]}`);
        console.log(`  Owner: ${community.pubkey.slice(0, 8)}...`);
        console.log(`  Description: ${descTag?.[1]?.slice(0, 50) || 'N/A'}...`);
        
        // Get moderators
        const modTags = community.tags.filter(t => t[0] === 'p' && t[3] === 'moderator');
        console.log(`  Moderators: ${modTags.length}`);
        
        // Query for approved members list (kind 34551)
        const communityId = `34550:${community.pubkey}:${dTag?.[1]}`;
        const approvedLists = await relay.query([{
          kinds: [34551],
          '#d': [communityId],
          limit: 1
        }]);
        
        if (approvedLists.length > 0) {
          const memberTags = approvedLists[0].tags.filter(t => t[0] === 'p');
          console.log(`  Approved members: ${memberTags.length}`);
        } else {
          console.log(`  Approved members: No list found`);
        }
        
        // Query for posts (kind 4550)
        const posts = await relay.query([{
          kinds: [4550],
          '#a': [`34550:${community.pubkey}:${dTag?.[1]}`],
          limit: 5
        }]);
        
        console.log(`  Posts: ${posts.length}`);
        
        console.log('');
      }
      
      relay.close();
      
    } catch (error) {
      console.error(`Error testing ${relayUrl}:`, error.message);
    }
  }
}

testNip72Members().catch(console.error);