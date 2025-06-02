#!/usr/bin/env node

import { NDK, NDKEvent } from '@nostr-dev-kit/ndk';

// Test accounts that have been created
const TestAccount1 = {
  pubkey: "e6a0e8cf7bd75e0a2d5c9b7c8b5d4f3e2a1b9f8e7d6c5b4a3e2d1c0b9a8e7d6",
  privkey: "8f9e8d7c6b5a4e3d2c1b0a9e8d7c6b5a4e3d2c1b0a9e8d7c6b5a4e3d2c1b0"
};

const MINTS = [
  "https://mint.minibits.cash/Bitcoin",
  "https://mint.coinos.io",
  "https://mint.lnbits.com"
];

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.nostr.bg',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.noswhere.com',
  'wss://relay.nostr.wirednet.jp',
  'wss://nostr.fmt.wiz.biz',
  'wss://relay.nostrplebs.com',
  'wss://nostr.oxtr.dev',
  'wss://relay.orangepill.dev',
  'wss://relay.nostrati.com',
  'wss://relayable.org',
  'wss://nostr.mom',
  'wss://nostr-pub.wellorder.net',
  'wss://atlas.nostr.land',
  'wss://relay.mostr.pub',
  'wss://relay.nos.social',
  'wss://relay.plebstr.com'
];

async function main() {
  try {
    console.log('\n=== Testing Member Display for NIP-72 Groups ===\n');
    
    // Create NDK instance
    const ndk = new NDK({
      explicitRelayUrls: DEFAULT_RELAYS
    });
    
    await ndk.connect();
    console.log('Connected to relays');
    
    // Query for a specific NIP-72 group - Oslo Freedom Forum
    const groupFilter = {
      kinds: [34550],
      "#d": ["oslo-freedom-forum-2025-mb3ch5ft"],
      authors: ["932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d"]
    };
    
    console.log('\nFetching Oslo Freedom Forum group...');
    const groupEvents = await ndk.fetchEvents(groupFilter);
    
    if (groupEvents.size === 0) {
      console.log('No group found!');
      return;
    }
    
    const groupEvent = Array.from(groupEvents)[0];
    console.log('Group found:', groupEvent.tags.find(t => t[0] === 'name')?.[1] || 'Unknown');
    
    // Get moderators from the group
    const moderators = new Set([groupEvent.pubkey]);
    for (const tag of groupEvent.tags) {
      if (tag[0] === 'p' && tag[3] === 'moderator') {
        moderators.add(tag[1]);
      }
    }
    console.log('Moderators:', Array.from(moderators));
    
    // Query for approved members using just the identifier
    const approvedMembersFilter = {
      kinds: [34551],
      authors: Array.from(moderators),
      "#d": ["oslo-freedom-forum-2025-mb3ch5ft"]  // Just the identifier
    };
    
    console.log('\nQuerying for approved members with filter:', approvedMembersFilter);
    
    const approvedMembersEvents = await ndk.fetchEvents(approvedMembersFilter);
    console.log('Approved members events found:', approvedMembersEvents.size);
    
    if (approvedMembersEvents.size > 0) {
      for (const event of approvedMembersEvents) {
        const memberTags = event.tags.filter(t => t[0] === 'p');
        console.log(`\nApproved members list by ${event.pubkey.slice(0, 8)}:`);
        console.log(`- Total members: ${memberTags.length}`);
        console.log('- First 5 members:', memberTags.slice(0, 5).map(t => t[1].slice(0, 8) + '...'));
      }
    } else {
      console.log('\nNo approved members lists found. This could mean:');
      console.log('1. No members have been approved yet');
      console.log('2. The moderators haven\'t published member lists');
      console.log('3. The events haven\'t propagated to the relays yet');
    }
    
    // Also try with the full communityId format to compare
    console.log('\n--- Testing with full communityId format ---');
    const fullIdFilter = {
      kinds: [34551],
      authors: Array.from(moderators),
      "#d": ["nip72:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:oslo-freedom-forum-2025-mb3ch5ft"]
    };
    
    console.log('Querying with full ID:', fullIdFilter);
    const fullIdEvents = await ndk.fetchEvents(fullIdFilter);
    console.log('Events found with full ID:', fullIdEvents.size);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);