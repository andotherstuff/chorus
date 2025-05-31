#!/usr/bin/env node

import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { NRelay1, NSecSigner, NSchema as n } from '@nostrify/nostrify';
import { generateSecretKey, nip19 } from 'nostr-tools';

// Create test accounts
const ownerSk = generateSecretKey();
const ownerSigner = new NSecSigner(ownerSk);
const ownerPubkey = await ownerSigner.getPublicKey();

const memberSk = generateSecretKey();
const memberSigner = new NSecSigner(memberSk);
const memberPubkey = await memberSigner.getPublicKey();

console.log('Test Accounts:');
console.log('Owner:', nip19.npubEncode(ownerPubkey));
console.log('Member:', nip19.npubEncode(memberPubkey));
console.log('');

// Test on a relay that accepts community events
const relayUrl = 'wss://relay.primal.net';

async function createAndVerifyGroup() {
  console.log(`Testing group creation and verification on ${relayUrl}\n`);
  
  const relay = new NRelay1(relayUrl);
  
  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  try {
    const groupId = `test-group-${Date.now()}`;
    const communityId = `34550:${ownerPubkey}:${groupId}`;
    
    // 1. Create group (kind 34550)
    console.log('1. Creating group...');
    const groupEvent = await ownerSigner.signEvent({
      kind: 34550,
      content: '',
      tags: [
        ['d', groupId],
        ['name', 'Test Group'],
        ['description', 'Testing approved members functionality'],
        ['p', ownerPubkey, '', 'moderator'],
      ],
      created_at: Math.floor(Date.now() / 1000),
    });
    
    await relay.event(groupEvent);
    console.log('✓ Group created:', communityId);
    
    // 2. Create approved members list (kind 34551)
    console.log('\n2. Creating approved members list...');
    const approvedListEvent = await ownerSigner.signEvent({
      kind: 34551,
      content: '',
      tags: [
        ['d', communityId],
        ['p', memberPubkey],
      ],
      created_at: Math.floor(Date.now() / 1000),
    });
    
    await relay.event(approvedListEvent);
    console.log('✓ Approved members list created');
    
    // 3. Create a post from the member (kind 4550)
    console.log('\n3. Creating post from approved member...');
    const postEvent = await memberSigner.signEvent({
      kind: 4550,
      content: 'Hello from an approved member!',
      tags: [
        ['a', communityId],
      ],
      created_at: Math.floor(Date.now() / 1000),
    });
    
    await relay.event(postEvent);
    console.log('✓ Post created');
    
    // Wait for propagation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 4. Query and verify
    console.log('\n4. Verifying data...');
    
    // Query group
    const groups = await relay.query([{
      kinds: [34550],
      authors: [ownerPubkey],
      '#d': [groupId],
    }]);
    
    console.log(`✓ Group found: ${groups.length > 0 ? 'Yes' : 'No'}`);
    
    // Query approved members list
    const approvedLists = await relay.query([{
      kinds: [34551],
      '#d': [communityId],
    }]);
    
    console.log(`✓ Approved members list found: ${approvedLists.length > 0 ? 'Yes' : 'No'}`);
    if (approvedLists.length > 0) {
      const members = approvedLists[0].tags.filter(t => t[0] === 'p');
      console.log(`  Members in list: ${members.length}`);
      console.log(`  Contains test member: ${members.some(t => t[1] === memberPubkey) ? 'Yes' : 'No'}`);
    }
    
    // Query posts
    const posts = await relay.query([{
      kinds: [4550],
      '#a': [communityId],
    }]);
    
    console.log(`✓ Posts found: ${posts.length}`);
    
    // Test NIP-29 group for comparison
    console.log('\n5. Testing NIP-29 group creation (for comparison)...');
    
    // Connect to NIP-29 relay
    const nip29Relay = new NRelay1('wss://groups.fiatjaf.com');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const nip29GroupId = `test-nip29-${Date.now()}`;
    
    // Create NIP-29 group (kind 9007)
    const nip29GroupEvent = await ownerSigner.signEvent({
      kind: 9007,
      content: '',
      tags: [
        ['h', nip29GroupId],
        ['name', 'Test NIP-29 Group'],
        ['about', 'Testing NIP-29 functionality'],
        ['public'],
      ],
      created_at: Math.floor(Date.now() / 1000),
    });
    
    await nip29Relay.event(nip29GroupEvent);
    console.log('✓ NIP-29 group created:', nip29GroupId);
    
    // Wait and query
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const nip29Groups = await nip29Relay.query([{
      kinds: [39000],
      '#d': [nip29GroupId],
    }]);
    
    console.log(`✓ NIP-29 group metadata found: ${nip29Groups.length > 0 ? 'Yes' : 'No'}`);
    
    nip29Relay.close();
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    relay.close();
  }
}

createAndVerifyGroup().catch(console.error);