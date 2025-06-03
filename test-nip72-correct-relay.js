import { SimplePool } from 'nostr-tools/pool';

async function testNip72CorrectRelay() {
  console.log('Testing NIP-72 posts query on correct Chorus relay...\n');
  
  const pool = new SimplePool();
  
  const groupId = "nip72:76c71aae3a491f1d9eec47cba17e229cda4113a0bbb6e6ae1776d7643e29cafa:protest-net-mb3ghoz8";
  const parsedGroup = {
    type: "nip72",
    pubkey: "76c71aae3a491f1d9eec47cba17e229cda4113a0bbb6e6ae1776d7643e29cafa",
    identifier: "protest-net-mb3ghoz8"
  };
  
  const queryId = `34550:${parsedGroup.pubkey}:${parsedGroup.identifier}`;
  const chorusRelay = 'wss://relay.chorus.community/';
  
  console.log('Group info:', {
    groupId,
    parsedGroup,
    queryId,
    relay: chorusRelay
  });
  
  try {
    // First, verify the group exists
    console.log('\n1. Checking if group exists...');
    const groupEvents = await pool.querySync(
      [chorusRelay],
      {
        kinds: [34550],
        authors: [parsedGroup.pubkey],
        "#d": [parsedGroup.identifier]
      }
    );
    
    console.log(`Found ${groupEvents.length} group event(s)`);
    if (groupEvents.length > 0) {
      const group = groupEvents[0];
      console.log('Group details:', {
        name: group.tags.find(t => t[0] === 'name')?.[1],
        description: group.tags.find(t => t[0] === 'description')?.[1],
        created_at: new Date(group.created_at * 1000).toISOString()
      });
    }
    
    // Query for posts with the "a" tag
    console.log('\n2. Querying for posts with a-tag...');
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
        console.log(`\n- Post ${post.id.slice(0, 8)}... by ${post.pubkey.slice(0, 8)}...`);
        console.log(`  Content: ${post.content.slice(0, 100)}...`);
        console.log(`  Created: ${new Date(post.created_at * 1000).toISOString()}`);
        const aTags = post.tags.filter(t => t[0] === 'a');
        console.log(`  A-tags:`, aTags);
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
    
    // Check approved members list
    console.log('\n4. Checking for approved members list...');
    const approvedMembersList = await pool.querySync(
      [chorusRelay],
      {
        kinds: [34551], // GROUP_APPROVED_MEMBERS_LIST
        authors: [parsedGroup.pubkey],
        "#d": [parsedGroup.identifier]
      }
    );
    
    console.log(`Found ${approvedMembersList.length} approved members list(s)`);
    if (approvedMembersList.length > 0) {
      const list = approvedMembersList[0];
      const memberTags = list.tags.filter(t => t[0] === 'p');
      console.log(`Approved members count: ${memberTags.length}`);
    }
    
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

testNip72CorrectRelay().catch(console.error);