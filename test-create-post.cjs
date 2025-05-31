#!/usr/bin/env node

const { generateSecretKey, getPublicKey } = require('nostr-tools/pure');
const { finalizeEvent } = require('nostr-tools/pure');
const WebSocket = require('ws');

async function createTestPost() {
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  
  console.log('Test user pubkey:', pk);
  
  // Create a test post for Oslo Freedom Forum
  const post = {
    kind: 1,
    pubkey: pk,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['a', '34550:826be9c067e944d87299e42e7d72a1508f4a3c1ebeaaa8c4c96c4d3e5733ad68:Oslo-Freedom-Forum-2025']
    ],
    content: 'Test post for Oslo Freedom Forum 2025! 🎉'
  };
  
  const signedPost = finalizeEvent(post, sk);
  
  // Publish to relay.chorus.community
  const ws = new WebSocket('wss://relay.chorus.community/');
  
  ws.on('open', () => {
    console.log('Connected to relay.chorus.community');
    const event = ['EVENT', signedPost];
    console.log('Publishing post:', signedPost);
    ws.send(JSON.stringify(event));
    
    // Wait a bit then query to verify
    setTimeout(() => {
      const filter = {
        kinds: [1],
        '#a': ['34550:826be9c067e944d87299e42e7d72a1508f4a3c1ebeaaa8c4c96c4d3e5733ad68:Oslo-Freedom-Forum-2025'],
        limit: 10
      };
      
      console.log('\nQuerying for posts...');
      ws.send(JSON.stringify(['REQ', 'sub1', filter]));
    }, 1000);
  });
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg[0] === 'OK') {
      console.log('Post published:', msg[1] ? 'Success' : 'Failed', msg[2]);
    } else if (msg[0] === 'EVENT' && msg[2].kind === 1) {
      console.log('Post found:', {
        id: msg[2].id,
        content: msg[2].content,
        pubkey: msg[2].pubkey
      });
    } else if (msg[0] === 'EOSE') {
      console.log('End of stored events');
      ws.close();
    }
  });
  
  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
}

createTestPost().catch(console.error);