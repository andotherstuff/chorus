const { generateSecretKey, getPublicKey, nip19, finalizeEvent, verifyEvent } = require('nostr-tools');
const { SimplePool } = require('nostr-tools/pool');
const WebSocket = require('ws');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Polyfill for Node.js
global.WebSocket = WebSocket;
global.fetch = fetch;

const APP_URL = 'http://10.255.12.206:8080';
const TEST_CONFIG = JSON.parse(fs.readFileSync('./test-config.json', 'utf-8'));

class NostrTestSuite {
  constructor() {
    this.pool = new SimplePool();
    this.relays = TEST_CONFIG.testRelays;
    this.nip29Relay = TEST_CONFIG.nip29Relay;
    this.testResults = [];
    this.createdArtifacts = {
      groups: [],
      posts: [],
      users: []
    };
  }

  async init() {
    console.log('🚀 Initializing Nostr Test Suite...');
    console.log(`📍 Testing app at: ${APP_URL}`);
    console.log(`📡 Using relays: ${this.relays.join(', ')}`);
    console.log(`🔐 NIP-29 relay: ${this.nip29Relay}`);
  }

  // Helper to create a signed event
  createEvent(kind, content, tags, secretKey) {
    const pubkey = getPublicKey(secretKey);
    const event = {
      kind,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content,
      pubkey
    };
    return finalizeEvent(event, secretKey);
  }

  // Test creating user profiles
  async testUserProfiles() {
    console.log('\n📝 Test 1: Creating User Profiles...');
    
    for (const [name, account] of Object.entries(TEST_CONFIG.testAccounts)) {
      try {
        const secretKey = nip19.decode(account.nsec).data;
        const metadata = {
          name: account.name,
          about: `Test account for +chorus testing - ${new Date().toISOString()}`,
          picture: `https://robohash.org/${account.npub}.png`,
          nip05: `${name}@chorus.test`
        };

        const event = this.createEvent(0, JSON.stringify(metadata), [], secretKey);
        
        console.log(`  👤 Publishing profile for ${account.name}...`);
        await this.pool.publish(this.relays, event);
        
        // Wait for propagation
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log(`  ✅ Profile created for ${account.name} (${account.npub.slice(0, 12)}...)`);
        this.createdArtifacts.users.push(event.id);
      } catch (error) {
        console.error(`  ❌ Error creating profile for ${name}:`, error.message);
      }
    }
  }

  // Test creating a NIP-72 community
  async testCreateNip72Community() {
    console.log('\n🏘️ Test 2: Creating NIP-72 Community...');
    
    const alice = TEST_CONFIG.testAccounts.alice;
    const secretKey = nip19.decode(alice.nsec).data;
    const groupId = `${TEST_CONFIG.testGroupPrefix}nip72-${Date.now()}`;
    
    const tags = [
      ['d', groupId],
      ['name', `${TEST_CONFIG.testDataPrefix}Chorus Test Community`],
      ['description', 'A test NIP-72 community for +chorus app testing'],
      ['image', 'https://placekitten.com/400/400'],
      ['p', getPublicKey(secretKey), '', 'moderator']
    ];
    
    const event = this.createEvent(34550, '', tags, secretKey);
    
    console.log(`  📤 Publishing community event...`);
    await this.pool.publish(this.relays, event);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log(`  ✅ NIP-72 Community created: ${groupId}`);
    this.createdArtifacts.groups.push({ type: 'nip72', id: groupId, eventId: event.id });
    return groupId;
  }

  // Run all tests
  async run() {
    await this.init();
    
    try {
      await this.testUserProfiles();
      const communityId = await this.testCreateNip72Community();
      
      // Generate summary
      console.log('\n📈 Test Summary:');
      console.log(`  - Users created: ${this.createdArtifacts.users.length}`);
      console.log(`  - Groups created: ${this.createdArtifacts.groups.length}`);
      
      // Save results
      if (!fs.existsSync('test-results')) {
        fs.mkdirSync('test-results');
      }
      
      fs.writeFileSync(
        'test-results/nostr-test-results.json',
        JSON.stringify(this.createdArtifacts, null, 2)
      );
      
      console.log('\n✅ Test results saved to test-results/nostr-test-results.json');
    } catch (error) {
      console.error('\n❌ Test suite error:', error);
    } finally {
      // Close connections
      this.pool.close(this.relays.concat([this.nip29Relay]));
    }
  }
}

// Run tests
const suite = new NostrTestSuite();
suite.run().catch(console.error);