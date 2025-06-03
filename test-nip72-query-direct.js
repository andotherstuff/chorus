import { SimplePool } from 'nostr-tools/pool';

async function testNip72Query() {
  console.log('Testing NIP-72 posts query directly...\n');
  
  const pool = new SimplePool();
  
  const groupId = "nip72:76c71aae3a491f1d9eec47cba17e229cda4113a0bbb6e6ae1776d7643e29cafa:protest-net-mb3ghoz8";
  const parsedGroup = {
    type: "nip72",
    pubkey: "76c71aae3a491f1d9eec47cba17e229cda4113a0bbb6e6ae1776d7643e29cafa",
    identifier: "protest-net-mb3ghoz8"
  };
  
  const queryId = `34550:${parsedGroup.pubkey}:${parsedGroup.identifier}`;
  
  console.log('Group info:', {
    groupId,
    parsedGroup,
    queryId
  });
  
  try {
    // First, verify the group exists
    console.log('\n1. Checking if group exists...');
    const groupEvents = await pool.querySync(
      ['wss://relay.primal.net', 'wss://relay.damus.io', 'wss://relay.nostr.band'],
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
      ['wss://relay.primal.net', 'wss://relay.damus.io', 'wss://relay.nostr.band'],
      {
        kinds: [1],
        "#a": [queryId],
        limit: 10
      }
    );
    
    console.log(`Found ${postsWithATag.length} posts with a-tag "${queryId}"`);
    
    // Also try without the prefix
    const identifierOnly = parsedGroup.identifier;
    console.log('\n3. Trying with identifier only...');
    const postsWithIdentifier = await pool.querySync(
      ['wss://relay.primal.net', 'wss://relay.damus.io', 'wss://relay.nostr.band'],
      {
        kinds: [1],
        "#a": [identifierOnly],
        limit: 10
      }
    );
    
    console.log(`Found ${postsWithIdentifier.length} posts with a-tag "${identifierOnly}"`);
    
    // Check recent posts from the group owner
    console.log('\n4. Checking recent posts from group owner...');
    const ownerPosts = await pool.querySync(
      ['wss://relay.primal.net', 'wss://relay.damus.io', 'wss://relay.nostr.band'],
      {
        kinds: [1],
        authors: [parsedGroup.pubkey],
        limit: 5
      }
    );
    
    console.log(`Found ${ownerPosts.length} recent posts from owner`);
    ownerPosts.forEach(post => {
      const aTags = post.tags.filter(t => t[0] === 'a');
      console.log(`Post ${post.id.slice(0, 8)} has ${aTags.length} a-tags:`, aTags);
    });
    
    // Search for any posts with "protest" in content
    console.log('\n5. Checking for posts mentioning "protest"...');
    const protestPosts = await pool.querySync(
      ['wss://relay.primal.net', 'wss://relay.damus.io', 'wss://relay.nostr.band'],
      {
        kinds: [1],
        search: "protest",
        limit: 10
      }
    );
    
    console.log(`Found ${protestPosts.length} posts mentioning "protest"`);
    protestPosts.forEach(post => {
      const aTags = post.tags.filter(t => t[0] === 'a');
      if (aTags.length > 0) {
        console.log(`Post ${post.id.slice(0, 8)} has a-tags:`, aTags);
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    pool.close();
  }
}

testNip72Query().catch(console.error);