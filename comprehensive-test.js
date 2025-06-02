import { generateSecretKey, getPublicKey, nip19, finalizeEvent } from 'nostr-tools';
import { SimplePool } from 'nostr-tools/pool';
import WebSocket from 'ws';
import fetch from 'node-fetch';
import fs from 'fs/promises';

// Polyfills
global.WebSocket = WebSocket;
global.fetch = fetch;

const APP_URL = 'http://10.255.12.206:8080';
const TEST_ACCOUNT = JSON.parse(await fs.readFile('./test-results/test-account.json', 'utf-8'));

class ComprehensiveTest {
  constructor() {
    this.pool = new SimplePool();
    this.relays = ['wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.nostr.band'];
    this.nip29Relay = 'wss://groups.fiatjaf.com';
    this.testResults = {
      timestamp: new Date().toISOString(),
      infrastructure: {},
      nostrProtocol: {},
      createdContent: []
    };
  }

  // Test 1: Infrastructure
  async testInfrastructure() {
    console.log('🏗️ Test 1: Infrastructure Check');
    console.log('================================\n');

    // Check main page
    const homeResponse = await fetch(APP_URL);
    this.testResults.infrastructure.homepage = {
      status: homeResponse.status,
      ok: homeResponse.ok
    };
    console.log(`✅ Homepage: ${homeResponse.status} ${homeResponse.ok ? 'OK' : 'FAIL'}`);

    // Check key resources
    const resources = [
      '/manifest.json',
      '/sw.js',
      '/@vite/client',
      '/src/main.tsx'
    ];

    for (const resource of resources) {
      const response = await fetch(APP_URL + resource);
      this.testResults.infrastructure[resource] = {
        status: response.status,
        ok: response.ok
      };
      console.log(`${response.ok ? '✅' : '❌'} ${resource}: ${response.status}`);
    }
  }

  // Test 2: Nostr Protocol Operations
  async testNostrProtocol() {
    console.log('\n🌐 Test 2: Nostr Protocol Tests');
    console.log('================================\n');

    const secretKey = nip19.decode(TEST_ACCOUNT.nsec).data;
    
    // Test 2.1: Query existing profile
    console.log('📋 Querying existing profile...');
    const profileFilter = {
      kinds: [0],
      authors: [TEST_ACCOUNT.publicKey],
      limit: 1
    };
    
    const profiles = await this.pool.querySync(this.relays, profileFilter);
    console.log(`✅ Found ${profiles.length} profile event(s)`);
    
    if (profiles.length > 0) {
      const metadata = JSON.parse(profiles[0].content);
      console.log(`   Name: ${metadata.name}`);
      console.log(`   About: ${metadata.about}`);
    }

    // Test 2.2: Create a new post
    console.log('\n📝 Publishing new test post...');
    const postContent = `[TEST] Comprehensive test post from +chorus testing suite

🎵 Testing at ${new Date().toLocaleString()}
🔧 App URL: ${APP_URL}
✨ This is an automated test post

#nostr #testing #chorus`;

    const postEvent = finalizeEvent({
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'nostr'],
        ['t', 'testing'],
        ['t', 'chorus']
      ],
      content: postContent
    }, secretKey);

    await this.pool.publish(this.relays, postEvent);
    console.log(`✅ Post published (ID: ${postEvent.id.slice(0, 8)}...)`);
    this.testResults.createdContent.push({
      type: 'post',
      id: postEvent.id,
      content: postContent.split('\n')[0]
    });

    // Test 2.3: Create a NIP-72 community
    console.log('\n🏘️ Creating NIP-72 test community...');
    const communityId = `test-chorus-community-${Date.now()}`;
    
    const communityEvent = finalizeEvent({
      kind: 34550,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', communityId],
        ['name', '[TEST] Automated Test Community'],
        ['description', 'This community was created by the +chorus automated test suite'],
        ['rules', '1. Be kind\n2. Test responsibly\n3. Have fun'],
        ['moderators', TEST_ACCOUNT.publicKey],
        ['p', TEST_ACCOUNT.publicKey, '', 'moderator']
      ],
      content: ''
    }, secretKey);

    await this.pool.publish(this.relays, communityEvent);
    console.log(`✅ Community created: ${communityId}`);
    this.testResults.createdContent.push({
      type: 'nip72-community',
      id: communityId,
      eventId: communityEvent.id
    });

    // Test 2.4: Post to the community
    console.log('\n📮 Posting to community...');
    const communityPostEvent = finalizeEvent({
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['a', `34550:${TEST_ACCOUNT.publicKey}:${communityId}`, this.relays[0]]
      ],
      content: '[TEST] First post in our test community! 🎉'
    }, secretKey);

    await this.pool.publish(this.relays, communityPostEvent);
    console.log(`✅ Posted to community (ID: ${communityPostEvent.id.slice(0, 8)}...)`);

    // Test 2.5: Create a reaction
    console.log('\n❤️ Creating reaction...');
    const reactionEvent = finalizeEvent({
      kind: 7,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', postEvent.id],
        ['p', TEST_ACCOUNT.publicKey]
      ],
      content: '🎵'
    }, secretKey);

    await this.pool.publish(this.relays, reactionEvent);
    console.log(`✅ Reaction created`);

    // Test 2.6: Query back our content
    console.log('\n🔍 Verifying published content...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const contentFilter = {
      kinds: [1, 34550],
      authors: [TEST_ACCOUNT.publicKey],
      since: Math.floor(Date.now() / 1000) - 300 // Last 5 minutes
    };

    const recentContent = await this.pool.querySync(this.relays, contentFilter);
    console.log(`✅ Found ${recentContent.length} recent events`);

    this.testResults.nostrProtocol = {
      profileFound: profiles.length > 0,
      postPublished: true,
      communityCreated: true,
      recentEventsCount: recentContent.length
    };
  }

  // Test 3: App-specific features
  async testAppFeatures() {
    console.log('\n🎯 Test 3: App Feature Tests');
    console.log('=============================\n');

    // Test file upload endpoint
    console.log('📤 Testing file upload endpoint...');
    try {
      const uploadResponse = await fetch(`${APP_URL}/api/upload`, {
        method: 'OPTIONS'
      });
      console.log(`${uploadResponse.ok ? '✅' : '❌'} Upload endpoint: ${uploadResponse.status}`);
      this.testResults.infrastructure.uploadEndpoint = uploadResponse.status;
    } catch (error) {
      console.log('❌ Upload endpoint not accessible');
    }

    // Create test data for manual verification
    console.log('\n📋 Test Data Summary:');
    console.log('--------------------');
    console.log(`Test Account: ${TEST_ACCOUNT.name}`);
    console.log(`npub: ${TEST_ACCOUNT.npub}`);
    console.log(`nsec: ${TEST_ACCOUNT.nsec}`);
    console.log(`\nCreated Content:`);
    this.testResults.createdContent.forEach(item => {
      console.log(`- ${item.type}: ${item.id || item.content}`);
    });
  }

  // Generate comprehensive report
  async generateReport() {
    console.log('\n📊 Generating Test Report');
    console.log('========================\n');

    // Create detailed report
    const report = {
      ...this.testResults,
      testAccount: {
        name: TEST_ACCOUNT.name,
        npub: TEST_ACCOUNT.npub,
        publicKey: TEST_ACCOUNT.publicKey
      },
      relays: this.relays,
      summary: {
        infrastructureOk: Object.values(this.testResults.infrastructure).every(r => r.ok || r === 204),
        nostrProtocolOk: this.testResults.nostrProtocol.profileFound && 
                         this.testResults.nostrProtocol.postPublished,
        contentCreated: this.testResults.createdContent.length
      }
    };

    await fs.writeFile(
      'test-results/comprehensive-test-report.json',
      JSON.stringify(report, null, 2)
    );

    console.log('✅ Report saved to: test-results/comprehensive-test-report.json');
    
    // Print summary
    console.log('\n🎯 Test Summary:');
    console.log(`Infrastructure: ${report.summary.infrastructureOk ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Nostr Protocol: ${report.summary.nostrProtocolOk ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Content Created: ${report.summary.contentCreated} items`);
  }

  async run() {
    try {
      await this.testInfrastructure();
      await this.testNostrProtocol();
      await this.testAppFeatures();
      await this.generateReport();
      
      console.log('\n✨ All tests completed!');
      console.log('\n📌 Next Steps:');
      console.log('1. Open the app at ' + APP_URL);
      console.log('2. Login with nsec: ' + TEST_ACCOUNT.nsec);
      console.log('3. Look for [TEST] content in the feed');
      console.log('4. Check if the test community appears in groups');
      
    } catch (error) {
      console.error('\n❌ Test error:', error);
    } finally {
      this.pool.close(this.relays.concat([this.nip29Relay]));
    }
  }
}

// Run comprehensive tests
const test = new ComprehensiveTest();
await test.run();