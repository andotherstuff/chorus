#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NRelay1 } from '@nostrify/nostrify';

// Test NIP-72 groups
async function testNip72Posts() {
  console.log('=== Testing NIP-72 Community Posts ===\n');
  
  const relay = new NRelay1('wss://relay.primal.net');
  
  try {
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Query for a specific community we know has posts
    const communityId = '34550:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:oslo-freedom-forum-2025-mb3ch5ft';
    
    console.log(`Testing community: ${communityId}`);
    
    // Query for posts with "a" tag
    const posts = await relay.query([{
      kinds: [1], // Regular text notes
      '#a': [communityId],
      limit: 10
    }]);
    
    console.log(`Found ${posts.length} posts`);
    
    if (posts.length > 0) {
      console.log('\nSample posts:');
      posts.slice(0, 3).forEach(post => {
        const aTag = post.tags.find(t => t[0] === 'a');
        console.log(`- Post ID: ${post.id}`);
        console.log(`  Kind: ${post.kind}`);
        console.log(`  Content: ${post.content.slice(0, 60)}...`);
        console.log(`  a tag: ${aTag ? aTag[1] : 'none'}`);
        console.log(`  Created: ${new Date(post.created_at * 1000).toISOString()}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    relay.close();
  }
}

// Test NIP-29 groups
async function testNip29Posts() {
  console.log('\n\n=== Testing NIP-29 Group Posts ===\n');
  
  const relay = new NRelay1('wss://groups.fiatjaf.com');
  
  try {
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // First get a group
    const groups = await relay.query([{
      kinds: [39000], // Group metadata
      limit: 3
    }]);
    
    console.log(`Found ${groups.length} groups`);
    
    if (groups.length > 0) {
      const group = groups[0];
      const dTag = group.tags.find(t => t[0] === 'd');
      const groupId = dTag?.[1];
      
      if (groupId) {
        console.log(`\nTesting group: ${groupId}`);
        
        // Query for posts with "h" tag
        const posts = await relay.query([{
          kinds: [9, 11], // NIP-29 chat message and group post
          '#h': [groupId],
          limit: 10
        }]);
        
        console.log(`Found ${posts.length} posts`);
        
        if (posts.length > 0) {
          console.log('\nSample posts:');
          posts.slice(0, 3).forEach(post => {
            const hTag = post.tags.find(t => t[0] === 'h');
            console.log(`- Post ID: ${post.id}`);
            console.log(`  Kind: ${post.kind}`);
            console.log(`  Content: ${post.content.slice(0, 60)}...`);
            console.log(`  h tag: ${hTag ? hTag[1] : 'none'}`);
            console.log(`  Created: ${new Date(post.created_at * 1000).toISOString()}`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    relay.close();
  }
}

// Run both tests
async function main() {
  await testNip72Posts();
  await testNip29Posts();
}

main().catch(console.error);