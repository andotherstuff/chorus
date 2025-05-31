#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NPool } from '@nostrify/nostrify';

// Test the same query pattern the app uses
async function testAppQuery() {
  console.log('Testing app query pattern...\n');
  
  const pool = new NPool({
    open: (url) => new WebSocket(url),
    // Minimal timeout to match what the app does
    reqRouter: async (filters) => {
      return new Map([['wss://communities.nos.social/', filters]]);
    }
  });
  
  try {
    console.log('1. Testing with NPool (like EnhancedNostrProvider)...');
    
    const relayUrl = 'wss://communities.nos.social/';
    const signal = AbortSignal.timeout(8000);
    
    const events = await pool.query([{
      kinds: [39000],
      limit: 100
    }], { 
      signal,
      relays: [relayUrl]
    });
    
    console.log(`Found ${events.length} groups using NPool`);
    
    if (events.length > 0) {
      console.log('\nFirst few groups:');
      events.slice(0, 3).forEach(event => {
        const dTag = event.tags.find(t => t[0] === 'd');
        const nameTag = event.tags.find(t => t[0] === 'name');
        console.log(`- ${nameTag?.[1] || 'Unnamed'} (${dTag?.[1]})`);
      });
    }
    
    // Test if the pool maintains connections
    console.log('\n2. Testing second query (connection reuse)...');
    const events2 = await pool.query([{
      kinds: [39000],
      limit: 10
    }], { 
      signal: AbortSignal.timeout(3000),
      relays: [relayUrl]
    });
    
    console.log(`Second query found ${events2.length} groups`);
    
    // Test with multiple relays like the app does
    console.log('\n3. Testing multiple relays...');
    const relays = [
      'wss://communities.nos.social/',
      'wss://groups.fiatjaf.com'
    ];
    
    const multiRelayEvents = await pool.query([{
      kinds: [39000],
      limit: 50
    }], { 
      signal: AbortSignal.timeout(8000),
      relays
    });
    
    console.log(`Multi-relay query found ${multiRelayEvents.length} total groups`);
    
    // Group by relay
    const byRelay = new Map();
    relays.forEach(relay => byRelay.set(relay, 0));
    
    // Can't easily determine which relay each event came from with NPool
    // but we can query each individually
    for (const relay of relays) {
      const relayEvents = await pool.query([{
        kinds: [39000],
        limit: 50
      }], { 
        signal: AbortSignal.timeout(5000),
        relays: [relay]
      });
      console.log(`  ${relay}: ${relayEvents.length} groups`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // NPool doesn't have a close method
    console.log('\nTest complete');
  }
}

testAppQuery().catch(console.error);