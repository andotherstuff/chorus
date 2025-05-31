#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NRelay1 } from '@nostrify/nostrify';

async function testChorusRelay() {
  console.log('=== Testing Chorus Community Relay ===\n');
  
  const relay = new NRelay1('wss://relay.chorus.community');
  
  try {
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test the specific community from the URL
    const communityId = '34550:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:oslo-freedom-forum-2025-mb3ch5ft';
    
    console.log(`Testing community: ${communityId}\n`);
    
    // First check if the community exists
    const communities = await relay.query([{
      kinds: [34550],
      authors: ['932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d'],
      '#d': ['oslo-freedom-forum-2025-mb3ch5ft']
    }]);
    
    console.log(`Community found: ${communities.length > 0 ? 'Yes' : 'No'}`);
    
    if (communities.length > 0) {
      const community = communities[0];
      const nameTag = community.tags.find(t => t[0] === 'name');
      console.log(`Community name: ${nameTag?.[1] || 'Unnamed'}`);
    }
    
    // Query for posts
    console.log('\nQuerying for posts...');
    const posts = await relay.query([{
      kinds: [1], // Regular text notes
      '#a': [communityId],
      limit: 20
    }]);
    
    console.log(`Found ${posts.length} posts`);
    
    if (posts.length > 0) {
      console.log('\nFirst few posts:');
      posts.slice(0, 3).forEach((post, i) => {
        console.log(`\n${i + 1}. Post ID: ${post.id}`);
        console.log(`   Content: ${post.content.slice(0, 100)}${post.content.length > 100 ? '...' : ''}`);
        console.log(`   Author: ${post.pubkey.slice(0, 16)}...`);
        console.log(`   Created: ${new Date(post.created_at * 1000).toLocaleString()}`);
        
        // Check tags
        const aTags = post.tags.filter(t => t[0] === 'a');
        console.log(`   a tags: ${aTags.map(t => t[1]).join(', ')}`);
      });
    }
    
    // Also check for any posts with this community tag in general
    console.log('\n\nChecking for any recent posts...');
    const recentPosts = await relay.query([{
      kinds: [1],
      limit: 100,
      since: Math.floor(Date.now() / 1000) - 86400 * 7 // Last week
    }]);
    
    const communityPosts = recentPosts.filter(post => 
      post.tags.some(tag => 
        tag[0] === 'a' && 
        tag[1] === communityId
      )
    );
    
    console.log(`Found ${communityPosts.length} posts for this community in the last week`);
    
    // Check what communities have posts
    const postsWithCommunityTags = recentPosts.filter(post =>
      post.tags.some(tag => tag[0] === 'a' && tag[1]?.startsWith('34550:'))
    );
    
    console.log(`\nTotal posts with community tags: ${postsWithCommunityTags.length}`);
    
    if (postsWithCommunityTags.length > 0) {
      // Get unique communities
      const uniqueCommunities = new Set();
      postsWithCommunityTags.forEach(post => {
        const aTag = post.tags.find(t => t[0] === 'a' && t[1]?.startsWith('34550:'));
        if (aTag) uniqueCommunities.add(aTag[1]);
      });
      
      console.log(`Active communities: ${uniqueCommunities.size}`);
      console.log('Communities with posts:');
      Array.from(uniqueCommunities).slice(0, 5).forEach(comm => {
        console.log(`  - ${comm}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    relay.close();
  }
}

testChorusRelay().catch(console.error);