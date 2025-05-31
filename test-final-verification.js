#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NPool, NRelay1 } from '@nostrify/nostrify';

async function testFinalVerification() {
  console.log('Final verification test...\n');
  
  // Test 1: Direct relay connection (baseline)
  console.log('1. Testing direct NRelay1 connection...');
  const relay1 = new NRelay1('wss://communities.nos.social/');
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const directEvents = await relay1.query([{
    kinds: [39000],
    limit: 10
  }]);
  
  console.log(`Direct query found ${directEvents.length} groups`);
  relay1.close();
  
  // Test 2: NPool with temporary routing (like the fix)
  console.log('\n2. Testing NPool with temporary routing...');
  const open = (url) => {
    console.log(`Opening: ${url}`);
    return new NRelay1(url);
  };
  
  const relays = ['wss://communities.nos.social/'];
  const tempPool = new NPool({
    open,
    reqRouter: async (filters) => {
      const relayMap = new Map();
      for (const relay of relays) {
        relayMap.set(relay, filters);
      }
      console.log('Routing to:', Array.from(relayMap.keys()));
      return relayMap;
    }
  });
  
  const poolEvents = await tempPool.query([{
    kinds: [39000],
    limit: 10
  }], { signal: AbortSignal.timeout(5000) });
  
  console.log(`Pool query found ${poolEvents.length} groups`);
  
  // Test 3: Multiple relays
  console.log('\n3. Testing multiple relays...');
  const multiRelays = ['wss://communities.nos.social/', 'wss://groups.fiatjaf.com'];
  const multiPool = new NPool({
    open,
    reqRouter: async (filters) => {
      const relayMap = new Map();
      for (const relay of multiRelays) {
        relayMap.set(relay, filters);
      }
      console.log('Routing to:', Array.from(relayMap.keys()));
      return relayMap;
    }
  });
  
  const multiEvents = await multiPool.query([{
    kinds: [39000],
    limit: 20
  }], { signal: AbortSignal.timeout(8000) });
  
  console.log(`Multi-relay query found ${multiEvents.length} total groups`);
  
  // Show some group names
  if (multiEvents.length > 0) {
    console.log('\nSample groups found:');
    const seen = new Set();
    for (const event of multiEvents) {
      const nameTag = event.tags.find(t => t[0] === 'name');
      const name = nameTag?.[1] || 'Unnamed';
      if (!seen.has(name)) {
        seen.add(name);
        console.log(`- ${name}`);
        if (seen.size >= 5) break;
      }
    }
  }
  
  console.log('\nTest complete!');
}

testFinalVerification().catch(console.error);