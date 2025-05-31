#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NRelay1 } from '@nostrify/nostrify';

async function testApprovedPosts() {
  console.log('=== Testing Approved Posts ===\n');
  
  const relay = new NRelay1('wss://relay.chorus.community');
  
  try {
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const communityId = '34550:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:oslo-freedom-forum-2025-mb3ch5ft';
    
    // Check for approved posts (kind 4550)
    console.log('Checking for approved posts...');
    const approvals = await relay.query([{
      kinds: [4550],
      '#a': [communityId],
      limit: 20
    }]);
    
    console.log(`Found ${approvals.length} approved posts`);
    
    if (approvals.length > 0) {
      console.log('\nApproved posts:');
      approvals.slice(0, 3).forEach((approval, i) => {
        console.log(`\n${i + 1}. Approval ID: ${approval.id}`);
        console.log(`   Approver: ${approval.pubkey.slice(0, 16)}...`);
        console.log(`   Approved at: ${new Date(approval.created_at * 1000).toLocaleString()}`);
        
        // The content should contain the approved post
        try {
          const approvedPost = JSON.parse(approval.content);
          console.log(`   Original post content: ${approvedPost.content?.slice(0, 100)}...`);
          console.log(`   Original author: ${approvedPost.pubkey?.slice(0, 16)}...`);
        } catch (e) {
          console.log(`   Content: ${approval.content.slice(0, 100)}...`);
        }
      });
    }
    
    // Check for any approvals across all communities
    console.log('\n\nChecking for any approval events...');
    const allApprovals = await relay.query([{
      kinds: [4550],
      limit: 10
    }]);
    
    console.log(`Total approval events: ${allApprovals.length}`);
    
    if (allApprovals.length > 0) {
      console.log('\nCommunities with approvals:');
      const communities = new Set();
      allApprovals.forEach(approval => {
        const aTag = approval.tags.find(t => t[0] === 'a');
        if (aTag) communities.add(aTag[1]);
      });
      
      Array.from(communities).forEach(comm => {
        console.log(`  - ${comm}`);
      });
    }
    
    // Check for posts across all communities on this relay
    console.log('\n\nChecking for any posts with community tags...');
    const allPosts = await relay.query([{
      kinds: [1],
      limit: 100
    }]);
    
    const communityPosts = allPosts.filter(post =>
      post.tags.some(tag => tag[0] === 'a' && tag[1]?.startsWith('34550:'))
    );
    
    console.log(`Found ${communityPosts.length} posts with community tags out of ${allPosts.length} total posts`);
    
    if (communityPosts.length > 0) {
      const uniqueCommunities = new Set();
      communityPosts.forEach(post => {
        const aTag = post.tags.find(t => t[0] === 'a' && t[1]?.startsWith('34550:'));
        if (aTag) uniqueCommunities.add(aTag[1]);
      });
      
      console.log(`\nCommunities with posts:`);
      Array.from(uniqueCommunities).slice(0, 5).forEach(comm => {
        console.log(`  - ${comm}`);
        const count = communityPosts.filter(p => 
          p.tags.some(t => t[0] === 'a' && t[1] === comm)
        ).length;
        console.log(`    Posts: ${count}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    relay.close();
  }
}

testApprovedPosts().catch(console.error);