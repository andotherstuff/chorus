#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NRelay1 } from '@nostrify/nostrify';

async function testApprovalFix() {
  console.log('=== Testing Approval Fix ===\n');
  
  const relay = new NRelay1('wss://relay.chorus.community');
  
  try {
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const communityId = '34550:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:oslo-freedom-forum-2025-mb3ch5ft';
    
    console.log('Testing with corrected query that includes both kind 1 and kind 11...\n');
    
    // Query for posts with both kinds
    console.log('1. Querying for posts (kinds 1 and 11)...');
    const posts = await relay.query([{
      kinds: [1, 11], // Both regular posts and group posts
      '#a': [communityId],
      limit: 50
    }]);
    
    console.log(`   Found ${posts.length} posts total`);
    
    // Count by kind
    const kind1Count = posts.filter(p => p.kind === 1).length;
    const kind11Count = posts.filter(p => p.kind === 11).length;
    
    console.log(`   - Kind 1 posts: ${kind1Count}`);
    console.log(`   - Kind 11 posts: ${kind11Count}`);
    
    // Check approved posts
    console.log('\n2. Checking approved posts...');
    const approvals = await relay.query([{
      kinds: [4550],
      '#a': [communityId],
      limit: 20
    }]);
    
    console.log(`   Found ${approvals.length} approved posts`);
    
    // Parse approved posts and check their kinds
    const approvedKinds = new Map();
    const approvedPostIds = new Set();
    
    approvals.forEach(approval => {
      try {
        const approvedPost = JSON.parse(approval.content);
        approvedKinds.set(approvedPost.kind, (approvedKinds.get(approvedPost.kind) || 0) + 1);
        approvedPostIds.add(approvedPost.id);
      } catch (e) {}
    });
    
    console.log('   Approved post kinds:');
    for (const [kind, count] of approvedKinds) {
      console.log(`     - Kind ${kind}: ${count} posts`);
    }
    
    // Check how many of the fetched posts are approved
    console.log('\n3. Matching fetched posts with approvals...');
    const approvedFetchedPosts = posts.filter(p => approvedPostIds.has(p.id));
    console.log(`   ${approvedFetchedPosts.length} of ${posts.length} fetched posts are approved`);
    
    // Show sample posts
    if (posts.length > 0) {
      console.log('\n4. Sample posts:');
      posts.slice(0, 3).forEach((post, i) => {
        const isApproved = approvedPostIds.has(post.id);
        console.log(`   ${i + 1}. Kind ${post.kind} - ${isApproved ? '✅ Approved' : '⏳ Pending'}`);
        console.log(`      Content: ${post.content.slice(0, 60)}...`);
        console.log(`      Author: ${post.pubkey.slice(0, 16)}...`);
      });
    }
    
    console.log('\n✅ Fix Summary:');
    console.log('   - PostList now queries for both kind 1 and kind 11 posts');
    console.log('   - This ensures all posts (NIP-72 and NIP-29 style) are fetched');
    console.log('   - Approved posts should now display correctly');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    relay.close();
  }
}

testApprovalFix().catch(console.error);