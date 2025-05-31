#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NRelay1 } from '@nostrify/nostrify';

async function testQueryFormats() {
  console.log('=== Testing Query Format Fix ===\n');
  
  const relay = new NRelay1('wss://relay.chorus.community');
  
  try {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test with the correct format (34550:pubkey:identifier)
    const correctFormat = '34550:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:oslo-freedom-forum-2025-mb3ch5ft';
    
    console.log('Testing with correct format:', correctFormat);
    
    // Query for approved posts
    const approvals = await relay.query([{
      kinds: [4550],
      '#a': [correctFormat],
      limit: 10
    }]);
    
    console.log(`\nApproved posts found: ${approvals.length}`);
    
    if (approvals.length > 0) {
      console.log('\nFirst approved post:');
      const approval = approvals[0];
      try {
        const post = JSON.parse(approval.content);
        console.log('- Content:', post.content?.slice(0, 100) + '...');
        console.log('- Author:', post.pubkey?.slice(0, 16) + '...');
      } catch (e) {
        console.log('- Raw content:', approval.content.slice(0, 100) + '...');
      }
    }
    
    // Test pending posts query
    console.log('\n\nTesting pending posts query...');
    const pendingPosts = await relay.query([{
      kinds: [1],
      '#a': [correctFormat],
      limit: 10
    }]);
    
    console.log(`Pending posts found: ${pendingPosts.length}`);
    
    // Test the wrong format (should return 0)
    const wrongFormat = 'nip72:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:oslo-freedom-forum-2025-mb3ch5ft';
    
    console.log('\n\nTesting with wrong format:', wrongFormat);
    const wrongResults = await relay.query([{
      kinds: [4550],
      '#a': [wrongFormat],
      limit: 10
    }]);
    
    console.log(`Posts with wrong format: ${wrongResults.length} (should be 0)`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    relay.close();
  }
}

testQueryFormats().catch(console.error);