#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NPool, NRelay1 } from '@nostrify/nostrify';

// Simulate the NostrProvider behavior
async function testNostrProvider() {
  console.log('Testing NostrProvider-like behavior...\n');
  
  const relays = ['wss://relay.chorus.community/'];
  
  console.log('Creating NPool with relays:', relays);
  
  const pool = new NPool({
    open(url) {
      console.log(`[NostrProvider] Opening connection to ${url}`);
      return new NRelay1(url);
    },
    reqRouter(filters) {
      console.log(`[NostrProvider] Routing query to relays:`, relays);
      console.log(`[NostrProvider] Query filters:`, JSON.stringify(filters, null, 2));
      return new Map(relays.map((url) => [url, filters]));
    },
    eventRouter(event) {
      return relays;
    },
  });
  
  // Wait for connection
  console.log('\nWaiting for connection...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    console.log('\nQuerying for NIP-72 communities...');
    const signal = AbortSignal.timeout(10000);
    
    const events = await pool.query([
      { kinds: [34550], limit: 100 }
    ], { signal });
    
    const eventsArray = Array.from(events);
    console.log(`\nFound ${eventsArray.length} communities`);
    
    if (eventsArray.length > 0) {
      const first = eventsArray[0];
      const nameTag = first.tags.find(t => t[0] === 'name');
      console.log(`First community: ${nameTag?.[1] || 'Unnamed'}`);
      
      // Count unique pubkeys (community creators)
      const uniquePubkeys = new Set(eventsArray.map(e => e.pubkey));
      console.log(`Unique creators: ${uniquePubkeys.size}`);
    }
    
  } catch (error) {
    console.error('Query failed:', error.message);
    console.error(error.stack);
  }
}

testNostrProvider().catch(console.error);