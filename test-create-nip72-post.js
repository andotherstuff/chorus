import { SimplePool } from 'nostr-tools/pool';
import { getPublicKey, generateSecretKey } from 'nostr-tools/pure';
import { finalizeEvent } from 'nostr-tools/pure';

async function createNip72Post() {
  console.log('Creating a test NIP-72 post...\n');
  
  const pool = new SimplePool();
  
  // Generate a test key pair
  const secretKey = generateSecretKey();
  const publicKey = getPublicKey(secretKey);
  
  const groupId = "nip72:76c71aae3a491f1d9eec47cba17e229cda4113a0bbb6e6ae1776d7643e29cafa:protest-net-mb3ghoz8";
  const communityId = "34550:76c71aae3a491f1d9eec47cba17e229cda4113a0bbb6e6ae1776d7643e29cafa:protest-net-mb3ghoz8";
  const chorusRelay = 'wss://relay.chorus.community/';
  
  console.log('Test user pubkey:', publicKey);
  console.log('Community ID:', communityId);
  console.log('Relay:', chorusRelay);
  
  try {
    // Create a test post event
    const event = {
      kind: 1, // Text note
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["a", communityId], // Reference the community
        ["subject", "Test post for protest.net"]
      ],
      content: "This is a test post to verify NIP-72 functionality. Testing posts display in the Chorus app.",
      pubkey: publicKey
    };
    
    // Sign the event
    const signedEvent = finalizeEvent(event, secretKey);
    
    console.log('\nCreated event:', {
      id: signedEvent.id,
      kind: signedEvent.kind,
      content: signedEvent.content,
      tags: signedEvent.tags
    });
    
    // Publish to relay
    console.log('\nPublishing to relay...');
    await pool.publish([chorusRelay], signedEvent);
    
    console.log('✅ Post published successfully!');
    
    // Wait a moment for the relay to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Query back to verify
    console.log('\nVerifying post was stored...');
    const posts = await pool.querySync(
      [chorusRelay],
      {
        kinds: [1],
        "#a": [communityId],
        limit: 5
      }
    );
    
    console.log(`Found ${posts.length} posts with a-tag "${communityId}"`);
    
    const ourPost = posts.find(p => p.id === signedEvent.id);
    if (ourPost) {
      console.log('✅ Our post was found in the query!');
    } else {
      console.log('❌ Our post was not found in the query');
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

createNip72Post().catch(console.error);