#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NRelay1 } from '@nostrify/nostrify';

async function debugApprovalFlow() {
  console.log('=== Debugging Post Approval Flow ===\n');
  
  const relay = new NRelay1('wss://relay.chorus.community');
  
  try {
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test with different community ID formats
    const testCommunityIds = [
      // Original format from the app
      'nip72:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:oslo-freedom-forum-2025-mb3ch5ft',
      // Parsed format (what gets used in queries)
      '34550:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:oslo-freedom-forum-2025-mb3ch5ft',
      // Without the nip72 prefix
      '932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:oslo-freedom-forum-2025-mb3ch5ft'
    ];
    
    for (const communityId of testCommunityIds) {
      console.log(`\nTesting with communityId: ${communityId}`);
      
      // Check for approved posts
      const approvals = await relay.query([{
        kinds: [4550],
        '#a': [communityId],
        limit: 10
      }]);
      
      console.log(`  Found ${approvals.length} approved posts`);
      
      // Check for pending posts
      const pendingPosts = await relay.query([{
        kinds: [1],
        '#a': [communityId],
        limit: 10
      }]);
      
      console.log(`  Found ${pendingPosts.length} pending posts`);
      
      if (approvals.length > 0) {
        const approval = approvals[0];
        console.log(`  Sample approval:`);
        console.log(`    ID: ${approval.id}`);
        console.log(`    Tags:`, approval.tags);
        
        // Check if the approved post content can be parsed
        try {
          const approvedPost = JSON.parse(approval.content);
          console.log(`    Approved post ID: ${approvedPost.id}`);
          console.log(`    Approved post kind: ${approvedPost.kind}`);
        } catch (e) {
          console.log(`    Failed to parse approval content:`, e.message);
        }
      }
    }
    
    // Check what's the exact format being used in real approvals
    console.log('\n\nChecking exact formats in real approvals...');
    const allApprovals = await relay.query([{
      kinds: [4550],
      limit: 20
    }]);
    
    const communityFormats = new Map();
    allApprovals.forEach(approval => {
      const aTag = approval.tags.find(t => t[0] === 'a');
      if (aTag && aTag[1].includes('932614571afcbad4')) { // Oslo Freedom Forum owner pubkey
        communityFormats.set(aTag[1], (communityFormats.get(aTag[1]) || 0) + 1);
      }
    });
    
    if (communityFormats.size > 0) {
      console.log('Community ID formats found in real approvals:');
      for (const [format, count] of communityFormats) {
        console.log(`  ${format} (${count} approvals)`);
      }
    }
    
    // Test publishing an approval (dry run - just show what would be published)
    console.log('\n\nExample approval event structure:');
    const exampleApproval = {
      kind: 4550,
      tags: [
        ["a", "34550:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:oslo-freedom-forum-2025-mb3ch5ft"],
        ["e", "example-post-id"],
        ["p", "example-author-pubkey"],
        ["k", "1"]
      ],
      content: JSON.stringify({
        id: "example-post-id",
        pubkey: "example-author-pubkey",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [["a", "34550:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:oslo-freedom-forum-2025-mb3ch5ft"]],
        content: "Example post content",
        sig: "example-signature"
      })
    };
    
    console.log(JSON.stringify(exampleApproval, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    relay.close();
  }
}

debugApprovalFlow().catch(console.error);