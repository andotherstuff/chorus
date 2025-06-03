import { SimplePool } from 'nostr-tools/pool';

async function testNip72ChorusQuery() {
  console.log('Testing NIP-72 posts query on Chorus relay...\n');
  
  const pool = new SimplePool();
  
  const groupId = "nip72:76c71aae3a491f1d9eec47cba17e229cda4113a0bbb6e6ae1776d7643e29cafa:protest-net-mb3ghoz8";
  const parsedGroup = {
    type: "nip72",
    pubkey: "76c71aae3a491f1d9eec47cba17e229cda4113a0bbb6e6ae1776d7643e29cafa",
    identifier: "protest-net-mb3ghoz8"
  };
  
  const queryId = `34550:${parsedGroup.pubkey}:${parsedGroup.identifier}`;
  const chorusRelay = 'wss://chorus.mbd.pub/';
  
  console.log('Group info:', {
    groupId,
    parsedGroup,
    queryId,
    relay: chorusRelay
  });
  
  try {
    // First, verify the group exists on Chorus
    console.log('\n1. Checking if group exists on Chorus...');
    const groupEvents = await pool.querySync(
      [chorusRelay],
      {
        kinds: [34550],
        authors: [parsedGroup.pubkey],
        "#d": [parsedGroup.identifier]
      }
    );
    
    console.log(`Found ${groupEvents.length} group event(s) on Chorus`);
    if (groupEvents.length > 0) {
      const group = groupEvents[0];
      console.log('Group details:', {
        name: group.tags.find(t => t[0] === 'name')?.[1],
        description: group.tags.find(t => t[0] === 'description')?.[1],
        created_at: new Date(group.created_at * 1000).toISOString(),
        relay: chorusRelay
      });
    }
    
    // Query for posts with the "a" tag on Chorus
    console.log('\n2. Querying for posts with a-tag on Chorus...');
    const postsWithATag = await pool.querySync(
      [chorusRelay],
      {
        kinds: [1],
        "#a": [queryId],
        limit: 20
      }
    );
    
    console.log(`Found ${postsWithATag.length} posts with a-tag "${queryId}"`);
    
    if (postsWithATag.length > 0) {
      console.log('\nSample posts:');
      postsWithATag.slice(0, 3).forEach(post => {
        console.log(`- Post ${post.id.slice(0, 8)}... by ${post.pubkey.slice(0, 8)}...`);
        console.log(`  Content: ${post.content.slice(0, 100)}...`);
        console.log(`  Created: ${new Date(post.created_at * 1000).toISOString()}`);
      });
    }
    
    // Check approved posts
    console.log('\n3. Checking for approval events...');
    const approvalEvents = await pool.querySync(
      [chorusRelay],
      {
        kinds: [4550], // GROUP_POST_APPROVAL
        "#a": [queryId],
        limit: 10
      }
    );
    
    console.log(`Found ${approvalEvents.length} approval events`);
    
    // Check if there are any posts at all on Chorus
    console.log('\n4. Checking for any recent posts on Chorus...');
    const recentPosts = await pool.querySync(
      [chorusRelay],
      {
        kinds: [1],
        limit: 5
      }
    );
    
    console.log(`Found ${recentPosts.length} recent posts on Chorus`);
    recentPosts.forEach(post => {
      const aTags = post.tags.filter(t => t[0] === 'a');
      if (aTags.length > 0) {
        console.log(`Post ${post.id.slice(0, 8)} has a-tags:`, aTags);
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    try {
      pool.close();
    } catch (e) {
      // Ignore close errors
    }
  }
}

testNip72ChorusQuery().catch(console.error);