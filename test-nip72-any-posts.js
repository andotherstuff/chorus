#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NRelay1 } from '@nostrify/nostrify';

async function findNip72PostsAnywhere() {
  console.log('=== Finding ANY NIP-72 Posts ===\n');
  
  const relay = new NRelay1('wss://relay.primal.net');
  
  try {
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // First, find some communities
    console.log('Finding communities...');
    const communities = await relay.query([{
      kinds: [34550],
      limit: 10
    }]);
    
    console.log(`Found ${communities.length} communities\n`);
    
    // Now look for ANY posts that have an "a" tag pointing to a community
    console.log('Looking for posts with community tags...');
    const recentPosts = await relay.query([{
      kinds: [1],
      limit: 100,
      since: Math.floor(Date.now() / 1000) - 86400 // Last 24 hours
    }]);
    
    // Filter for posts that have an "a" tag starting with "34550:"
    const communityPosts = recentPosts.filter(post => 
      post.tags.some(tag => tag[0] === 'a' && tag[1]?.startsWith('34550:'))
    );
    
    console.log(`Found ${communityPosts.length} community posts out of ${recentPosts.length} recent posts\n`);
    
    if (communityPosts.length > 0) {
      console.log('Sample community posts:');
      communityPosts.slice(0, 5).forEach(post => {
        const aTag = post.tags.find(t => t[0] === 'a');
        console.log(`\n- Post ID: ${post.id}`);
        console.log(`  Content: ${post.content.slice(0, 100)}...`);
        console.log(`  Community: ${aTag?.[1]}`);
        console.log(`  Author: ${post.pubkey.slice(0, 16)}...`);
        console.log(`  Created: ${new Date(post.created_at * 1000).toISOString()}`);
      });
    }
    
    // Also try a different relay
    console.log('\n\nTrying relay.nostr.band...');
    relay.close();
    
    const relay2 = new NRelay1('wss://relay.nostr.band');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const bandPosts = await relay2.query([{
      kinds: [1],
      limit: 100,
      since: Math.floor(Date.now() / 1000) - 3600 // Last hour
    }]);
    
    const bandCommunityPosts = bandPosts.filter(post => 
      post.tags.some(tag => tag[0] === 'a' && tag[1]?.startsWith('34550:'))
    );
    
    console.log(`Found ${bandCommunityPosts.length} community posts on nostr.band`);
    
    if (bandCommunityPosts.length > 0) {
      const post = bandCommunityPosts[0];
      const aTag = post.tags.find(t => t[0] === 'a');
      console.log(`\nExample post:`);
      console.log(`- Community: ${aTag?.[1]}`);
      console.log(`- Content: ${post.content.slice(0, 100)}...`);
    }
    
    relay2.close();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

findNip72PostsAnywhere().catch(console.error);