#!/usr/bin/env node

const { generateSecretKey, getPublicKey } = require('nostr-tools/pure');
const { finalizeEvent } = require('nostr-tools/pure');
const WebSocket = require('ws');

async function createOsloFreedomForumGroup() {
  // Use the specific private key that corresponds to the pubkey in the URL
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  
  // We need to use the exact pubkey from the URL
  const targetPubkey = '826be9c067e944d87299e42e7d72a1508f4a3c1ebeaaa8c4c96c4d3e5733ad68';
  
  console.log('Generated pubkey:', pk);
  console.log('Target pubkey:', targetPubkey);
  console.log('Note: To create this group, you need the private key for the target pubkey');
  
  // Create the NIP-72 group event
  const groupEvent = {
    kind: 34550, // NIP-72 community definition
    pubkey: pk, // This should be targetPubkey, but we don't have the private key
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', 'Oslo-Freedom-Forum-2025'],
      ['name', 'Oslo Freedom Forum 2025'],
      ['picture', 'https://picsum.photos/600/300?random=oslo'],
      ['about', 'A community for discussing the Oslo Freedom Forum 2025 event'],
      ['p', pk, 'moderator'], // Add ourselves as moderator
    ],
    content: ''
  };
  
  const signedEvent = finalizeEvent(groupEvent, sk);
  
  // Publish to relay.chorus.community
  const ws = new WebSocket('wss://relay.chorus.community/');
  
  ws.on('open', () => {
    console.log('Connected to relay.chorus.community');
    const event = ['EVENT', signedEvent];
    console.log('Publishing group event:', signedEvent);
    ws.send(JSON.stringify(event));
    
    // Wait a bit then query to verify
    setTimeout(() => {
      const filter = {
        kinds: [34550],
        authors: [pk],
        '#d': ['Oslo-Freedom-Forum-2025'],
        limit: 1
      };
      
      console.log('\nQuerying for group event...');
      ws.send(JSON.stringify(['REQ', 'sub1', filter]));
    }, 1000);
  });
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg[0] === 'OK') {
      console.log('Group event published:', msg[1] ? 'Success' : 'Failed', msg[2]);
    } else if (msg[0] === 'EVENT' && msg[2].kind === 34550) {
      console.log('Group found:', {
        id: msg[2].id,
        tags: msg[2].tags,
        pubkey: msg[2].pubkey
      });
      console.log('\nNew group URL:');
      console.log(`nip72:${pk}:Oslo-Freedom-Forum-2025`);
    } else if (msg[0] === 'EOSE') {
      console.log('End of stored events');
      ws.close();
    }
  });
  
  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
}

createOsloFreedomForumGroup().catch(console.error);