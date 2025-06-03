#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NRelay1 } from '@nostrify/nostrify';

async function testCommunitiesNosSocial() {
  console.log('Testing communities.nos.social NIP-29 relay...\n');
  
  const relayUrl = 'wss://communities.nos.social';
  console.log(`Connecting to ${relayUrl}...`);
  
  try {
    const relay = new NRelay1(relayUrl);
    
    // Wait for connection
    console.log('Waiting for connection...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 1: Query for existing groups
    console.log('\n=== Test 1: Querying for existing groups ===');
    try {
      const groups = await relay.query([{
        kinds: [39000], // NIP-29 group metadata
        limit: 5
      }]);
      
      console.log(`Found ${groups.length} groups:`);
      
      for (const group of groups) {
        const dTag = group.tags.find(t => t[0] === 'd');
        const nameTag = group.tags.find(t => t[0] === 'name');
        const aboutTag = group.tags.find(t => t[0] === 'about');
        
        console.log(`  - ${nameTag?.[1] || 'Unnamed'} (${dTag?.[1]})`);
        console.log(`    About: ${aboutTag?.[1] || 'No description'}`);
        console.log(`    Relay pubkey: ${group.pubkey.slice(0, 16)}...`);
      }
    } catch (error) {
      console.error('Failed to query groups:', error.message);
    }
    
    // Test 2: Test connection status
    console.log('\n=== Test 2: Connection diagnostics ===');
    const ws = relay.socket;
    if (ws) {
      console.log(`WebSocket ready state: ${ws.readyState} (1=OPEN)`);
      console.log(`WebSocket URL: ${ws.url}`);
    } else {
      console.log('No WebSocket found');
    }
    
    // Test 3: Try to subscribe and see what happens
    console.log('\n=== Test 3: Testing subscription ===');
    try {
      const sub = relay.subscribe([{
        kinds: [39000],
        limit: 1
      }], {
        onEvent: (event) => {
          console.log('Received event:', event.id);
        },
        onEose: () => {
          console.log('End of stored events');
        },
        onClose: (reason) => {
          console.log('Subscription closed:', reason);
        }
      });
      
      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 2000));
      sub.close();
    } catch (error) {
      console.error('Subscription failed:', error.message);
    }
    
    relay.close();
    console.log('\n=== Test completed ===');
    
  } catch (error) {
    console.error('Connection failed:', error.message);
    console.error('Full error:', error);
  }
}

testCommunitiesNosSocial().catch(console.error);