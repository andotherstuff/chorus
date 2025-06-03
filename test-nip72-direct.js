#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NRelay1, NPool } from '@nostrify/nostrify';

async function testNip72Direct() {
  console.log('Testing NIP-72 communities loading directly...\n');
  
  const chorusRelay = 'wss://relay.chorus.community/';
  
  console.log('=== Test 1: Direct relay connection ===');
  try {
    const relay = new NRelay1(chorusRelay);
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const ws = relay.socket;
    console.log(`WebSocket state: ${ws?.readyState} (1=OPEN)`);
    
    // Query for NIP-72 communities
    const communities = await relay.query([
      { kinds: [34550], limit: 10 }
    ]);
    
    console.log(`Found ${communities.length} NIP-72 communities`);
    
    if (communities.length > 0) {
      const community = communities[0];
      const dTag = community.tags.find(t => t[0] === 'd');
      const nameTag = community.tags.find(t => t[0] === 'name');
      console.log(`First community: ${nameTag?.[1]} (${dTag?.[1]})`);
    }
    
    relay.close();
  } catch (error) {
    console.error('Direct relay test failed:', error.message);
  }
  
  console.log('\n=== Test 2: Using NPool (like the app) ===');
  try {
    const pool = new NPool({
      open(url) {
        console.log(`Opening connection to ${url}`);
        return new NRelay1(url);
      },
      reqRouter(filters) {
        console.log(`Routing query to ${chorusRelay}`);
        console.log('Filters:', JSON.stringify(filters, null, 2));
        return new Map([[chorusRelay, filters]]);
      },
      eventRouter(event) {
        return [chorusRelay];
      }
    });
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const signal = AbortSignal.timeout(10000);
    const communities = await pool.query([
      { kinds: [34550], limit: 10 }
    ], { signal });
    
    const communitiesArray = Array.from(communities);
    console.log(`Found ${communitiesArray.length} NIP-72 communities via pool`);
    
    if (communitiesArray.length > 0) {
      const community = communitiesArray[0];
      const dTag = community.tags.find(t => t[0] === 'd');
      const nameTag = community.tags.find(t => t[0] === 'name');
      console.log(`First community: ${nameTag?.[1]} (${dTag?.[1]})`);
    }
  } catch (error) {
    console.error('Pool test failed:', error.message);
  }
  
  console.log('\n=== Test 3: Testing with multiple relays (like EnhancedNostrProvider) ===');
  try {
    const relays = ['wss://relay.chorus.community/'];
    
    const pool = new NPool({
      open(url) {
        console.log(`Opening connection to ${url}`);
        return new NRelay1(url);
      },
      reqRouter(filters) {
        console.log('Routing filters:', filters);
        const relayMap = new Map();
        for (const relay of relays) {
          relayMap.set(relay, filters);
        }
        console.log('Relay map:', Array.from(relayMap.keys()));
        return relayMap;
      },
      eventRouter(event) {
        return relays;
      }
    });
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\nQuerying for NIP-72 communities...');
    const signal = AbortSignal.timeout(10000);
    const events = await pool.query([
      { kinds: [34550], limit: 100 }
    ], { signal });
    
    const eventsArray = Array.from(events);
    console.log(`\nResults: Found ${eventsArray.length} communities`);
    
    // Group by relay in tags
    const relayGroups = {};
    for (const event of eventsArray) {
      const relayTag = event.tags.find(t => t[0] === 'relay');
      const relay = relayTag?.[1] || 'unknown';
      relayGroups[relay] = (relayGroups[relay] || 0) + 1;
    }
    
    console.log('\nCommunities by relay:');
    for (const [relay, count] of Object.entries(relayGroups)) {
      console.log(`  ${relay}: ${count}`);
    }
    
  } catch (error) {
    console.error('Multi-relay test failed:', error.message);
    console.error(error.stack);
  }
}

testNip72Direct().catch(console.error);