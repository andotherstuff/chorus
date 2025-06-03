#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NRelay1 } from '@nostrify/nostrify';

async function testGroupInfo() {
  console.log('=== Testing Oslo Freedom Forum Group Info ===\n');
  
  const relay = new NRelay1('wss://relay.chorus.community');
  
  try {
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const pubkey = '932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d';
    const identifier = 'oslo-freedom-forum-2025-mb3ch5ft';
    
    // Check for NIP-72 group event (kind 34550)
    console.log('1. Checking for NIP-72 group definition (kind 34550)...');
    const nip72Groups = await relay.query([{
      kinds: [34550],
      authors: [pubkey],
      '#d': [identifier],
      limit: 1
    }]);
    
    if (nip72Groups.length > 0) {
      const group = nip72Groups[0];
      console.log('   Found NIP-72 group:');
      console.log(`   - Name: ${group.tags.find(t => t[0] === 'name')?.[1]}`);
      console.log(`   - Description: ${group.tags.find(t => t[0] === 'description')?.[1]?.slice(0, 100)}...`);
      console.log(`   - Created: ${new Date(group.created_at * 1000).toLocaleString()}`);
      console.log(`   - Moderators: ${group.tags.filter(t => t[0] === 'p' && t[3] === 'moderator').length}`);
    } else {
      console.log('   No NIP-72 group found');
    }
    
    // Check for NIP-29 group metadata (kind 39000)
    console.log('\n2. Checking for NIP-29 group metadata (kind 39000)...');
    const nip29Groups = await relay.query([{
      kinds: [39000],
      '#d': [identifier],
      limit: 1
    }]);
    
    if (nip29Groups.length > 0) {
      const group = nip29Groups[0];
      console.log('   Found NIP-29 group:');
      console.log(`   - Name: ${group.tags.find(t => t[0] === 'name')?.[1]}`);
      console.log(`   - About: ${group.tags.find(t => t[0] === 'about')?.[1]?.slice(0, 100)}...`);
      console.log(`   - Created: ${new Date(group.created_at * 1000).toLocaleString()}`);
      console.log(`   - Relay pubkey: ${group.pubkey}`);
    } else {
      console.log('   No NIP-29 group found');
    }
    
    // Check what types of posts exist
    console.log('\n3. Analyzing post types in this group...');
    const communityId = `34550:${pubkey}:${identifier}`;
    
    // Count different post kinds
    const postKinds = [1, 11, 1111];
    for (const kind of postKinds) {
      const posts = await relay.query([{
        kinds: [kind],
        '#a': [communityId],
        limit: 100
      }]);
      
      if (posts.length > 0) {
        console.log(`   - Kind ${kind}: ${posts.length} posts`);
        
        // Check if these posts have NIP-29 specific tags
        const samplePost = posts[0];
        const hasHTag = samplePost.tags.some(t => t[0] === 'h');
        if (hasHTag) {
          const hTag = samplePost.tags.find(t => t[0] === 'h');
          console.log(`     Has 'h' tag: ${hTag[1]} (NIP-29 style)`);
        }
      }
    }
    
    // Check the relay's published group lists
    console.log('\n4. Checking relay group lists...');
    const groupLists = await relay.query([{
      kinds: [39000, 39001, 39002],
      limit: 20
    }]);
    
    const uniqueGroups = new Set();
    groupLists.forEach(event => {
      const dTag = event.tags.find(t => t[0] === 'd');
      if (dTag) uniqueGroups.add(dTag[1]);
    });
    
    console.log(`   Found ${uniqueGroups.size} unique groups on this relay`);
    if (uniqueGroups.has(identifier)) {
      console.log(`   ✓ Oslo Freedom Forum group exists as NIP-29 group`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    relay.close();
  }
}

testGroupInfo().catch(console.error);