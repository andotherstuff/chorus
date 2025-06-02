const { generateSecretKey, getPublicKey, nip19, finalizeEvent } = require('nostr-tools');
const { SimplePool } = require('nostr-tools/pool');
const WebSocket = require('ws');
const fetch = require('node-fetch');
const fs = require('fs');

// Polyfill for Node.js
global.WebSocket = WebSocket;
global.fetch = fetch;

const APP_URL = 'http://10.255.12.206:8080';

class SimpleNostrTest {
  constructor() {
    this.pool = new SimplePool();
    this.relays = ['wss://nos.lol', 'wss://relay.primal.net'];
    this.results = [];
  }

  async testBasicFunctionality() {
    console.log('🚀 Simple Nostr Test Suite');
    console.log('==========================\n');

    // Generate new test accounts
    console.log('1️⃣ Generating test accounts...');
    
    const alice = {
      secretKey: generateSecretKey(),
      name: 'Alice Test ' + Date.now()
    };
    alice.publicKey = getPublicKey(alice.secretKey);
    alice.npub = nip19.npubEncode(alice.publicKey);
    alice.nsec = nip19.nsecEncode(alice.secretKey);
    
    console.log(`✅ Generated test account:`);
    console.log(`   Name: ${alice.name}`);
    console.log(`   npub: ${alice.npub}`);
    console.log(`   nsec: ${alice.nsec}\n`);

    // Create and publish profile
    console.log('2️⃣ Creating user profile...');
    
    const profileEvent = finalizeEvent({
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify({
        name: alice.name,
        about: 'Test account for +chorus app testing',
        picture: `https://robohash.org/${alice.npub}.png`
      })
    }, alice.secretKey);

    await this.pool.publish(this.relays, profileEvent);
    console.log(`✅ Profile published (Event ID: ${profileEvent.id.slice(0, 8)}...)\n`);

    // Create a test note
    console.log('3️⃣ Creating test note...');
    
    const noteEvent = finalizeEvent({
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: `[TEST] Hello from +chorus test suite! 🎵\n\nTesting at ${new Date().toLocaleString()}`
    }, alice.secretKey);

    await this.pool.publish(this.relays, noteEvent);
    console.log(`✅ Note published (Event ID: ${noteEvent.id.slice(0, 8)}...)\n`);

    // Query back the events
    console.log('4️⃣ Verifying published events...');
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for propagation
    
    const profileFilter = { kinds: [0], authors: [alice.publicKey], limit: 1 };
    const profiles = await this.pool.querySync(this.relays, profileFilter);
    
    const noteFilter = { kinds: [1], authors: [alice.publicKey], limit: 1 };
    const notes = await this.pool.querySync(this.relays, noteFilter);
    
    console.log(`✅ Found ${profiles.length} profile event(s)`);
    console.log(`✅ Found ${notes.length} note event(s)\n`);

    // Save test account for UI testing
    console.log('5️⃣ Saving test account details...');
    
    const testAccount = {
      name: alice.name,
      npub: alice.npub,
      nsec: alice.nsec,
      publicKey: alice.publicKey,
      profileEventId: profileEvent.id,
      noteEventId: noteEvent.id,
      timestamp: new Date().toISOString()
    };

    if (!fs.existsSync('test-results')) {
      fs.mkdirSync('test-results');
    }

    fs.writeFileSync(
      'test-results/test-account.json',
      JSON.stringify(testAccount, null, 2)
    );
    
    console.log('✅ Test account saved to: test-results/test-account.json');
    console.log('\n📌 Use this nsec to login in the app:');
    console.log(`   ${alice.nsec}`);
    
    // Close connections
    this.pool.close(this.relays);
    
    return testAccount;
  }
}

// Run the test
const test = new SimpleNostrTest();
test.testBasicFunctionality().catch(console.error);