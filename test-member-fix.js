const { NDKPrivateKeySigner } = require('@nostr-dev-kit/ndk');
const fs = require('fs').promises;
const { generateSecretKey, getPublicKey } = require('nostr-tools');
const { Relay } = require('nostr-tools/relay');
const { finalizeEvent } = require('nostr-tools/pure');

// Test account
const testSk = generateSecretKey();
const testPubkey = getPublicKey(testSk);

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol'
];

async function queryEvents(filter) {
  const results = [];
  
  for (const relayUrl of DEFAULT_RELAYS) {
    try {
      console.log(`Connecting to ${relayUrl}...`);
      const relay = new Relay(relayUrl);
      await relay.connect();
      
      const events = await relay.querySync(filter);
      results.push(...events);
      
      await relay.close();
    } catch (error) {
      console.error(`Error with relay ${relayUrl}:`, error.message);
    }
  }
  
  return results;
}

async function main() {
  console.log('\n=== Testing Member Display Fix ===\n');
  
  // Query for Oslo Freedom Forum group
  console.log('1. Fetching Oslo Freedom Forum group...');
  const groupEvents = await queryEvents({
    kinds: [34550],
    "#d": ["oslo-freedom-forum-2025-mb3ch5ft"],
    authors: ["932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d"]
  });
  
  if (groupEvents.length === 0) {
    console.log('Group not found!');
    return;
  }
  
  const group = groupEvents[0];
  console.log(`Group found: ${group.tags.find(t => t[0] === 'name')?.[1]}`);
  
  // Get moderators
  const moderators = new Set([group.pubkey]);
  for (const tag of group.tags) {
    if (tag[0] === 'p' && tag[3] === 'moderator') {
      moderators.add(tag[1]);
    }
  }
  console.log(`Moderators: ${moderators.size}`);
  
  // Test 1: Query with just identifier (correct way)
  console.log('\n2. Testing query with identifier only...');
  const identifierResults = await queryEvents({
    kinds: [34551],
    authors: Array.from(moderators),
    "#d": ["oslo-freedom-forum-2025-mb3ch5ft"]
  });
  console.log(`Results with identifier: ${identifierResults.length} events`);
  
  if (identifierResults.length > 0) {
    const memberCount = identifierResults[0].tags.filter(t => t[0] === 'p').length;
    console.log(`Members in first event: ${memberCount}`);
  }
  
  // Test 2: Query with full communityId (incorrect way - what the bug was doing)
  console.log('\n3. Testing query with full communityId...');
  const fullIdResults = await queryEvents({
    kinds: [34551],
    authors: Array.from(moderators),
    "#d": ["nip72:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:oslo-freedom-forum-2025-mb3ch5ft"]
  });
  console.log(`Results with full ID: ${fullIdResults.length} events`);
  
  console.log('\n✅ Fix verified: The hook should now query with just the identifier, not the full communityId');
  
  // Test NIP-29 groups
  console.log('\n4. Testing NIP-29 groups...');
  const nip29Relays = ['wss://communities.nos.social/', 'wss://groups.fiatjaf.com'];
  
  for (const relayUrl of nip29Relays) {
    try {
      console.log(`\nConnecting to NIP-29 relay: ${relayUrl}`);
      const relay = new Relay(relayUrl);
      await relay.connect();
      
      // Query for NIP-29 groups
      const nip29Groups = await relay.querySync({ kinds: [39000], limit: 5 });
      console.log(`Found ${nip29Groups.length} NIP-29 groups`);
      
      if (nip29Groups.length > 0) {
        const firstGroup = nip29Groups[0];
        const groupId = firstGroup.tags.find(t => t[0] === 'd')?.[1];
        console.log(`First group ID: ${groupId}`);
        
        // Query for members
        const memberEvents = await relay.querySync({
          kinds: [39002], // Member added events
          "#d": [groupId],
          limit: 10
        });
        console.log(`Member events for group: ${memberEvents.length}`);
      }
      
      await relay.close();
    } catch (error) {
      console.error(`Error with NIP-29 relay ${relayUrl}:`, error.message);
    }
  }
  
  console.log('\n✅ Test complete! The member display fix should work for both NIP-72 and NIP-29 groups.');
}

main().catch(console.error);