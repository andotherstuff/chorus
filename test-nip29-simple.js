#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NRelay1 } from '@nostrify/nostrify';

async function testBasicConnection() {
  console.log('Testing basic NIP-29 relay connection...\n');
  
  const relay = new NRelay1('wss://groups.fiatjaf.com');
  
  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    // Query for public groups
    console.log('Querying for public groups...');
    const groups = await relay.query([{
      kinds: [39000],
      limit: 5
    }]);
    
    console.log(`\nFound ${groups.length} groups:`);
    
    for (const group of groups) {
      const dTag = group.tags.find(t => t[0] === 'd');
      const nameTag = group.tags.find(t => t[0] === 'name');
      const aboutTag = group.tags.find(t => t[0] === 'about');
      const privateTag = group.tags.find(t => t[0] === 'private');
      const closedTag = group.tags.find(t => t[0] === 'closed');
      
      console.log(`\nGroup ID: ${dTag?.[1]}`);
      console.log(`  Name: ${nameTag?.[1]}`);
      console.log(`  About: ${aboutTag?.[1] || 'N/A'}`);
      console.log(`  Private: ${privateTag ? 'Yes' : 'No'}`);
      console.log(`  Closed: ${closedTag ? 'Yes' : 'No'}`);
      console.log(`  Relay pubkey: ${group.pubkey}`);
      
      // Query for member list
      if (dTag?.[1]) {
        const members = await relay.query([{
          kinds: [39002],
          '#d': [dTag[1]],
          limit: 1
        }]);
        
        if (members.length > 0) {
          const memberTags = members[0].tags.filter(t => t[0] === 'p');
          console.log(`  Members: ${memberTags.length}`);
        }
        
        // Query for posts
        const posts = await relay.query([{
          kinds: [9, 11],
          '#h': [dTag[1]],
          limit: 5
        }]);
        
        console.log(`  Posts: ${posts.length}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    relay.close();
  }
}

testBasicConnection().catch(console.error);