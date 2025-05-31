#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NRelay1, NSecSigner } from '@nostrify/nostrify';
import { generateSecretKey, nip19 } from 'nostr-tools';

const NIP29_RELAYS = [
  'wss://groups.fiatjaf.com',
  'wss://groups.nos.social',
  'wss://nip29.club'
];

async function testNip29Content() {
  console.log('Testing NIP-29 group content loading...\n');
  
  for (const relayUrl of NIP29_RELAYS) {
    console.log(`\n=== Testing ${relayUrl} ===`);
    
    try {
      const relay = new NRelay1(relayUrl);
      
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Query for groups (kind 39000)
      console.log('Querying for groups...');
      const groups = await relay.query([{
        kinds: [39000],
        limit: 3
      }]);
      
      console.log(`Found ${groups.length} groups\n`);
      
      for (const group of groups.slice(0, 2)) { // Only check first 2 groups
        const dTag = group.tags.find(t => t[0] === 'd');
        const nameTag = group.tags.find(t => t[0] === 'name');
        const aboutTag = group.tags.find(t => t[0] === 'about');
        const isPublic = group.tags.some(t => t[0] === 'public');
        const isPrivate = group.tags.some(t => t[0] === 'private');
        
        console.log(`Group: ${nameTag?.[1] || 'Unnamed'} (${dTag?.[1]})`);
        console.log(`  About: ${aboutTag?.[1]?.slice(0, 50) || 'N/A'}...`);
        console.log(`  Type: ${isPublic ? 'Public' : isPrivate ? 'Private' : 'Unknown'}`);
        
        // Query for members (kind 39002)
        const membersEvents = await relay.query([{
          kinds: [39002],
          '#d': [dTag?.[1]],
          limit: 1
        }]);
        
        if (membersEvents.length > 0) {
          const memberTags = membersEvents[0].tags.filter(t => t[0] === 'p');
          console.log(`  Members: ${memberTags.length}`);
        } else {
          console.log(`  Members: No member list found`);
        }
        
        // Query for posts (kind 9)
        const posts = await relay.query([{
          kinds: [9],
          '#h': [dTag?.[1]],
          limit: 5
        }]);
        
        console.log(`  Posts: ${posts.length}`);
        
        if (posts.length > 0) {
          console.log('  Latest posts:');
          for (const post of posts.slice(0, 3)) {
            const content = post.content.slice(0, 50);
            console.log(`    - "${content}${post.content.length > 50 ? '...' : ''}"`);
          }
        }
        
        // Query for replies (kind 10)
        const replies = await relay.query([{
          kinds: [10],
          '#h': [dTag?.[1]],
          limit: 3
        }]);
        
        console.log(`  Replies: ${replies.length}`);
        
        console.log('');
      }
      
      relay.close();
      
    } catch (error) {
      console.error(`Error testing ${relayUrl}:`, error.message);
    }
  }
  
  // Test authentication requirement on private groups
  console.log('\n=== Testing Private Group Access ===');
  
  try {
    const relay = new NRelay1('wss://groups.nos.social');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Try to query without authentication
    console.log('Attempting to query without authentication...');
    const publicGroups = await relay.query([{
      kinds: [39000],
      limit: 10
    }]);
    
    console.log(`Public groups found: ${publicGroups.length}`);
    
    // Count private vs public
    const privateGroups = publicGroups.filter(g => g.tags.some(t => t[0] === 'private'));
    const publicGroupsCount = publicGroups.filter(g => g.tags.some(t => t[0] === 'public'));
    
    console.log(`  Public: ${publicGroupsCount.length}`);
    console.log(`  Private: ${privateGroups.length}`);
    
    // Test member access on a private group
    if (privateGroups.length > 0) {
      const privateGroup = privateGroups[0];
      const dTag = privateGroup.tags.find(t => t[0] === 'd');
      const nameTag = privateGroup.tags.find(t => t[0] === 'name');
      
      console.log(`\nTesting access to private group: ${nameTag?.[1]} (${dTag?.[1]})`);
      
      // Try to get members without auth
      const members = await relay.query([{
        kinds: [39002],
        '#d': [dTag?.[1]],
      }]);
      
      console.log(`Members accessible without auth: ${members.length > 0 ? 'Yes' : 'No'}`);
      
      // Try to get posts without auth
      const posts = await relay.query([{
        kinds: [9],
        '#h': [dTag?.[1]],
      }]);
      
      console.log(`Posts accessible without auth: ${posts.length > 0 ? 'Yes' : 'No'}`);
    }
    
    relay.close();
    
  } catch (error) {
    console.error('Error testing private groups:', error.message);
  }
}

testNip29Content().catch(console.error);