#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NRelay1 } from '@nostrify/nostrify';

async function testPostKinds() {
  console.log('=== Testing Post Kinds in Groups ===\n');
  
  const relay = new NRelay1('wss://relay.chorus.community');
  
  try {
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const communityId = '34550:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:oslo-freedom-forum-2025-mb3ch5ft';
    
    console.log(`Testing community: ${communityId}\n`);
    
    // Check for kind 1 posts (NIP-72 text notes)
    console.log('1. Checking for kind 1 posts (NIP-72 text notes)...');
    const kind1Posts = await relay.query([{
      kinds: [1],
      '#a': [communityId],
      limit: 10
    }]);
    
    console.log(`   Found ${kind1Posts.length} kind 1 posts`);
    if (kind1Posts.length > 0) {
      console.log(`   Sample: ${kind1Posts[0].content.slice(0, 50)}...`);
    }
    
    // Check for kind 11 posts (NIP-29 group posts)
    console.log('\n2. Checking for kind 11 posts (NIP-29 group posts)...');
    const kind11Posts = await relay.query([{
      kinds: [11],
      '#a': [communityId],
      limit: 10
    }]);
    
    console.log(`   Found ${kind11Posts.length} kind 11 posts`);
    if (kind11Posts.length > 0) {
      console.log(`   Sample: ${kind11Posts[0].content.slice(0, 50)}...`);
    }
    
    // Check approved posts to see what kinds they contain
    console.log('\n3. Checking approved posts content...');
    const approvals = await relay.query([{
      kinds: [4550],
      '#a': [communityId],
      limit: 10
    }]);
    
    console.log(`   Found ${approvals.length} approvals`);
    
    const approvedKinds = new Map();
    approvals.forEach(approval => {
      try {
        const approvedPost = JSON.parse(approval.content);
        const kind = approvedPost.kind;
        approvedKinds.set(kind, (approvedKinds.get(kind) || 0) + 1);
      } catch (e) {}
    });
    
    if (approvedKinds.size > 0) {
      console.log('   Approved post kinds:');
      for (const [kind, count] of approvedKinds) {
        console.log(`     - Kind ${kind}: ${count} posts`);
      }
    }
    
    // Check what's actually being posted to this community
    console.log('\n4. Checking all posts across different kinds...');
    const allKinds = [1, 11, 1111]; // text notes, group posts, replies
    
    for (const kind of allKinds) {
      const posts = await relay.query([{
        kinds: [kind],
        limit: 100
      }]);
      
      const communityPosts = posts.filter(post =>
        post.tags.some(tag => tag[0] === 'a' && tag[1] === communityId)
      );
      
      if (communityPosts.length > 0) {
        console.log(`   Kind ${kind}: ${communityPosts.length} posts in this community`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    relay.close();
  }
}

testPostKinds().catch(console.error);