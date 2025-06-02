import { generateSecretKey, getPublicKey, nip19, finalizeEvent, verifyEvent } from 'nostr-tools';
import { SimplePool } from 'nostr-tools/pool';
import WebSocket from 'ws';
import fetch from 'node-fetch';
import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

// Polyfill WebSocket for Node.js
global.WebSocket = WebSocket;
global.fetch = fetch;

const APP_URL = 'http://10.255.12.206:8080';
const TEST_CONFIG = JSON.parse(await fs.readFile('./test-config.json', 'utf-8'));

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

  // Test 1: Create and verify user profiles
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
        
        // Verify the event was published
        await new Promise(resolve => setTimeout(resolve, 1000));
        const filter = { kinds: [0], authors: [event.pubkey], limit: 1 };
        const storedEvents = await this.pool.querySync(this.relays, filter);
        
        if (storedEvents.length > 0) {
          console.log(`  ✅ Profile created for ${account.name} (${account.npub.slice(0, 12)}...)`);
          this.createdArtifacts.users.push(event.id);
        } else {
          console.log(`  ❌ Failed to verify profile for ${account.name}`);
        }
      } catch (error) {
        console.error(`  ❌ Error creating profile for ${name}:`, error.message);
      }
    }
  }

  // Test 2: Create NIP-72 Community
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
    
    // Verify creation
    const filter = { kinds: [34550], '#d': [groupId], limit: 1 };
    const storedEvents = await this.pool.querySync(this.relays, filter);
    
    if (storedEvents.length > 0) {
      console.log(`  ✅ NIP-72 Community created: ${groupId}`);
      this.createdArtifacts.groups.push({ type: 'nip72', id: groupId, eventId: event.id });
      return groupId;
    } else {
      console.log(`  ❌ Failed to create NIP-72 community`);
      return null;
    }
  }

  // Test 3: Create NIP-29 Group
  async testCreateNip29Group() {
    console.log('\n🔒 Test 3: Creating NIP-29 Group...');
    
    const alice = TEST_CONFIG.testAccounts.alice;
    const secretKey = nip19.decode(alice.nsec).data;
    const groupId = `${TEST_CONFIG.testGroupPrefix}nip29-${Date.now()}`;
    
    const tags = [
      ['h', groupId],
      ['name', `${TEST_CONFIG.testDataPrefix}Chorus Private Group`],
      ['about', 'A test NIP-29 group for +chorus app testing'],
      ['picture', 'https://placekitten.com/401/401'],
      ['private', 'false'],
      ['closed', 'false']
    ];
    
    const event = this.createEvent(9007, '', tags, secretKey);
    
    console.log(`  📤 Publishing to NIP-29 relay: ${this.nip29Relay}`);
    
    try {
      // NIP-29 groups need to be published to specific relay
      await this.pool.publish([this.nip29Relay], event);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log(`  ✅ NIP-29 Group creation request sent: ${groupId}`);
      this.createdArtifacts.groups.push({ type: 'nip29', id: groupId, eventId: event.id, relay: this.nip29Relay });
      return groupId;
    } catch (error) {
      console.log(`  ❌ Failed to create NIP-29 group:`, error.message);
      return null;
    }
  }

  // Test 4: Post to NIP-72 Community
  async testPostToNip72(communityId) {
    console.log('\n📝 Test 4: Posting to NIP-72 Community...');
    
    if (!communityId) {
      console.log('  ⏭️ Skipping - no community ID');
      return;
    }
    
    const bob = TEST_CONFIG.testAccounts.bob;
    const secretKey = nip19.decode(bob.nsec).data;
    
    const content = `${TEST_CONFIG.testDataPrefix}Hello from the +chorus test suite! 🎵\n\nThis is an automated test post to verify NIP-72 community functionality.\n\nTimestamp: ${new Date().toISOString()}`;
    
    const tags = [
      ['a', `34550:${getPublicKey(nip19.decode(TEST_CONFIG.testAccounts.alice.nsec).data)}:${communityId}`, this.relays[0]]
    ];
    
    const event = this.createEvent(1, content, tags, secretKey);
    
    console.log(`  📤 Publishing post to community...`);
    await this.pool.publish(this.relays, event);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log(`  ✅ Post published to NIP-72 community (ID: ${event.id.slice(0, 8)}...)`);
    this.createdArtifacts.posts.push({ type: 'nip72', eventId: event.id, communityId });
    
    return event.id;
  }

  // Test 5: Post to NIP-29 Group
  async testPostToNip29(groupId) {
    console.log('\n🔐 Test 5: Posting to NIP-29 Group...');
    
    if (!groupId) {
      console.log('  ⏭️ Skipping - no group ID');
      return;
    }
    
    const charlie = TEST_CONFIG.testAccounts.charlie;
    const secretKey = nip19.decode(charlie.nsec).data;
    
    const content = `${TEST_CONFIG.testDataPrefix}Greetings from the NIP-29 test! 🔒\n\nThis post tests relay-specific group functionality.\n\nTime: ${new Date().toLocaleString()}`;
    
    const tags = [
      ['h', groupId]
    ];
    
    const event = this.createEvent(9, content, tags, secretKey);
    
    console.log(`  📤 Publishing post to NIP-29 group...`);
    
    try {
      await this.pool.publish([this.nip29Relay], event);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log(`  ✅ Post published to NIP-29 group (ID: ${event.id.slice(0, 8)}...)`);
      this.createdArtifacts.posts.push({ type: 'nip29', eventId: event.id, groupId });
      return event.id;
    } catch (error) {
      console.log(`  ❌ Failed to post to NIP-29 group:`, error.message);
      return null;
    }
  }

  // Test 6: Reply to posts
  async testReplies(nip72PostId, nip29PostId) {
    console.log('\n💬 Test 6: Testing Reply Functionality...');
    
    // Reply to NIP-72 post
    if (nip72PostId) {
      const alice = TEST_CONFIG.testAccounts.alice;
      const secretKey = nip19.decode(alice.nsec).data;
      
      const content = `${TEST_CONFIG.testDataPrefix}Great post! This is a test reply. 👍`;
      const tags = [
        ['e', nip72PostId, this.relays[0], 'reply']
      ];
      
      const event = this.createEvent(1111, content, tags, secretKey);
      await this.pool.publish(this.relays, event);
      
      console.log(`  ✅ Reply posted to NIP-72 community post`);
    }
    
    // Reply to NIP-29 post
    if (nip29PostId) {
      const bob = TEST_CONFIG.testAccounts.bob;
      const secretKey = nip19.decode(bob.nsec).data;
      
      const content = `${TEST_CONFIG.testDataPrefix}Excellent NIP-29 post! 🎉`;
      const tags = [
        ['e', nip29PostId, '', 'reply']
      ];
      
      const event = this.createEvent(1111, content, tags, secretKey);
      await this.pool.publish([this.nip29Relay], event);
      
      console.log(`  ✅ Reply posted to NIP-29 group post`);
    }
  }

  // Test 7: Browser automation test
  async testBrowserInteraction() {
    console.log('\n🌐 Test 7: Browser Automation Tests...');
    
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Test 1: Homepage loads
      console.log('  📱 Testing homepage...');
      await page.goto(APP_URL);
      await page.waitForTimeout(3000);
      
      const title = await page.title();
      console.log(`  ✅ Homepage loaded: "${title}"`);
      
      // Test 2: Check for login button
      const loginButton = await page.locator('button:has-text("Sign in"), button:has-text("Get Started")').first();
      if (await loginButton.isVisible()) {
        console.log('  ✅ Login/Get Started button found');
        
        // Take screenshot
        await page.screenshot({ path: 'test-results/homepage-with-login.png' });
      }
      
      // Test 3: Navigate to groups
      const groupsLink = page.locator('a[href="/groups"]');
      if (await groupsLink.count() > 0) {
        await groupsLink.click();
        await page.waitForTimeout(2000);
        console.log('  ✅ Navigated to groups page');
        
        // Look for our test groups
        const testGroups = await page.locator(`text="${TEST_CONFIG.testDataPrefix}"`).count();
        console.log(`  📊 Found ${testGroups} test groups/posts in UI`);
        
        await page.screenshot({ path: 'test-results/groups-page.png' });
      }
      
    } catch (error) {
      console.error('  ❌ Browser test error:', error.message);
    } finally {
      await browser.close();
    }
  }

  // Generate test report
  async generateReport() {
    console.log('\n📊 Generating Test Report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      appUrl: APP_URL,
      relays: this.relays,
      nip29Relay: this.nip29Relay,
      testAccounts: Object.keys(TEST_CONFIG.testAccounts),
      createdArtifacts: this.createdArtifacts,
      summary: {
        totalTests: 7,
        usersCreated: this.createdArtifacts.users.length,
        groupsCreated: this.createdArtifacts.groups.length,
        postsCreated: this.createdArtifacts.posts.length
      }
    };
    
    await fs.writeFile(
      'test-results/real-nostr-test-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n✅ Test Report saved to: test-results/real-nostr-test-report.json');
    console.log('\n📈 Test Summary:');
    console.log(`  - Users created: ${report.summary.usersCreated}`);
    console.log(`  - Groups created: ${report.summary.groupsCreated}`);
    console.log(`  - Posts created: ${report.summary.postsCreated}`);
  }

  // Cleanup test data (optional)
  async cleanup() {
    console.log('\n🧹 Cleanup Notes:');
    console.log('  - Test data is prefixed with "[TEST]" for easy identification');
    console.log('  - Groups are prefixed with "test-chorus-"');
    console.log('  - Data remains on relays for future verification');
    console.log('  - To delete: publish kind 5 (deletion) events for each created event');
  }

  async run() {
    await this.init();
    
    // Run all tests
    await this.testUserProfiles();
    const nip72CommunityId = await this.testCreateNip72Community();
    const nip29GroupId = await this.testCreateNip29Group();
    const nip72PostId = await this.testPostToNip72(nip72CommunityId);
    const nip29PostId = await this.testPostToNip29(nip29GroupId);
    await this.testReplies(nip72PostId, nip29PostId);
    await this.testBrowserInteraction();
    
    await this.generateReport();
    await this.cleanup();
    
    console.log('\n🎉 All tests completed!');
    console.log('Check test-results/ directory for screenshots and detailed report.');
    
    // Close pool connections
    this.pool.close(this.relays.concat([this.nip29Relay]));
  }
}

// Run the test suite
const suite = new NostrTestSuite();
await suite.run();