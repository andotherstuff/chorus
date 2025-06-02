import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { SimplePool } from 'nostr-tools/pool';
import WebSocket from 'ws';
import fetch from 'node-fetch';

// Polyfills
global.WebSocket = WebSocket;
global.fetch = fetch;

const APP_URL = 'http://10.255.12.206:8080';
const TEST_ACCOUNT = JSON.parse(await fs.readFile('./test-results/test-account.json', 'utf-8'));

class ChorusAppTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.pool = new SimplePool();
    this.testResults = {
      timestamp: new Date().toISOString(),
      tests: [],
      screenshots: [],
      errors: []
    };
  }

  async init() {
    console.log('🚀 Starting +chorus App Testing');
    console.log('================================\n');
    
    this.browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 800 }
    });
    
    this.page = await this.browser.newPage();
    
    // Log console messages
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.testResults.errors.push(msg.text());
      }
    });
    
    // Create test results directory
    await fs.mkdir('test-results/screenshots', { recursive: true });
  }

  async takeScreenshot(name) {
    const filename = `test-results/screenshots/${name}.png`;
    await this.page.screenshot({ path: filename, fullPage: true });
    this.testResults.screenshots.push(filename);
    return filename;
  }

  async addTestResult(name, success, details = {}) {
    const result = {
      name,
      success,
      timestamp: new Date().toISOString(),
      ...details
    };
    this.testResults.tests.push(result);
    console.log(`${success ? '✅' : '❌'} ${name}`);
    if (details.message) {
      console.log(`   ${details.message}`);
    }
  }

  // Test 1: Homepage and Navigation
  async testHomepage() {
    console.log('\n📱 Test 1: Homepage and Navigation');
    console.log('-----------------------------------');
    
    await this.page.goto(APP_URL, { waitUntil: 'networkidle0' });
    await this.page.waitForTimeout(2000);
    
    const title = await this.page.title();
    await this.addTestResult('Page loads', true, { title });
    
    // Check for key elements
    const hasHeader = await this.page.$('header') !== null;
    await this.addTestResult('Header present', hasHeader);
    
    const hasLoginButton = await this.page.$('button::-p-text(Sign in), button::-p-text(Get Started)') !== null;
    await this.addTestResult('Login button present', hasLoginButton);
    
    await this.takeScreenshot('01-homepage');
  }

  // Test 2: Login with nsec
  async testLogin() {
    console.log('\n🔐 Test 2: Authentication');
    console.log('-------------------------');
    
    try {
      // Click Sign in button
      await this.page.click('button::-p-text(Sign in)');
      await this.page.waitForTimeout(1000);
      
      await this.addTestResult('Login dialog opened', true);
      
      // Click Nsec tab
      const nsecTab = await this.page.$('button::-p-text(Nsec), [role="tab"]::-p-text(Nsec)');
      if (nsecTab) {
        await nsecTab.click();
        await this.page.waitForTimeout(500);
      }
      
      // Find and fill nsec input
      const nsecInput = await this.page.$('input[type="password"], input[placeholder*="nsec"]');
      if (nsecInput) {
        await nsecInput.type(TEST_ACCOUNT.nsec);
        await this.addTestResult('Entered nsec', true);
        
        // Click login button
        await this.page.click('button::-p-text(Login with Nsec), button::-p-text(Login)');
        
        // Wait for navigation
        await this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {});
        await this.page.waitForTimeout(2000);
        
        const currentUrl = this.page.url();
        const loggedIn = currentUrl.includes('/groups') || currentUrl !== APP_URL;
        
        await this.addTestResult('Login successful', loggedIn, { 
          url: currentUrl,
          account: TEST_ACCOUNT.name 
        });
        
        await this.takeScreenshot('02-after-login');
      } else {
        await this.addTestResult('Nsec input found', false);
      }
    } catch (error) {
      await this.addTestResult('Login process', false, { error: error.message });
    }
  }

  // Test 3: Groups Page
  async testGroupsPage() {
    console.log('\n📋 Test 3: Groups Page');
    console.log('----------------------');
    
    // Navigate to groups
    if (!this.page.url().includes('/groups')) {
      await this.page.goto(`${APP_URL}/groups`, { waitUntil: 'networkidle0' });
    }
    await this.page.waitForTimeout(3000);
    
    // Check for create group button
    const createButton = await this.page.$('a[href="/create-group"], button::-p-text(Create Group)');
    await this.addTestResult('Create Group button', createButton !== null);
    
    // Count group cards
    const groupCards = await this.page.$$('a[href*="/group/"]');
    await this.addTestResult('Groups displayed', groupCards.length > 0, { 
      count: groupCards.length 
    });
    
    await this.takeScreenshot('03-groups-page');
  }

  // Test 4: Create NIP-72 Group
  async testCreateNip72Group() {
    console.log('\n🏘️ Test 4: Create NIP-72 Community');
    console.log('-----------------------------------');
    
    try {
      await this.page.goto(`${APP_URL}/create-group`, { waitUntil: 'networkidle0' });
      await this.page.waitForTimeout(2000);
      
      // Select Public Community
      const publicRadio = await this.page.$('input[value="nip72"], label::-p-text(Public Community)');
      if (publicRadio) {
        await publicRadio.click();
      }
      
      // Fill form
      const timestamp = Date.now();
      const groupName = `[TEST] Automated Test Community ${timestamp}`;
      const groupId = `test-auto-${timestamp}`;
      
      await this.page.type('input[name="name"]', groupName);
      await this.page.type('input[name="identifier"]', groupId);
      await this.page.type('textarea[name="description"]', 'This community was created by automated testing');
      
      await this.addTestResult('Filled NIP-72 form', true, { groupName, groupId });
      
      await this.takeScreenshot('04-create-nip72-form');
      
      // Submit
      await this.page.click('button::-p-text(Create Group), button[type="submit"]');
      
      // Wait for result
      await this.page.waitForTimeout(5000);
      
      const success = this.page.url().includes('/groups') || 
                     await this.page.$('::-p-text(Success)') !== null;
      
      await this.addTestResult('NIP-72 group created', success);
      
      if (success) {
        this.testResults.createdGroups = this.testResults.createdGroups || [];
        this.testResults.createdGroups.push({ type: 'nip72', name: groupName, id: groupId });
      }
      
    } catch (error) {
      await this.addTestResult('Create NIP-72 group', false, { error: error.message });
    }
  }

  // Test 5: Create and Post to Group
  async testPostToGroup() {
    console.log('\n📝 Test 5: Post to Group');
    console.log('------------------------');
    
    try {
      // Go back to groups page
      await this.page.goto(`${APP_URL}/groups`, { waitUntil: 'networkidle0' });
      await this.page.waitForTimeout(3000);
      
      // Click on first group
      const groupLink = await this.page.$('a[href*="/group/"]');
      if (groupLink) {
        const groupText = await this.page.evaluate(el => el.textContent, groupLink);
        await groupLink.click();
        await this.page.waitForTimeout(3000);
        
        await this.addTestResult('Opened group', true, { group: groupText });
        
        // Find post textarea
        const postTextarea = await this.page.$('textarea[placeholder*="post"], textarea[placeholder*="message"]');
        if (postTextarea) {
          const postContent = `[TEST] Automated test post - ${new Date().toLocaleString()}\n\nThis post was created by automated testing.`;
          await postTextarea.type(postContent);
          
          await this.takeScreenshot('05-post-form');
          
          // Click Post button
          const postButton = await this.page.$('button::-p-text(Post), button::-p-text(Send)');
          if (postButton) {
            await postButton.click();
            await this.page.waitForTimeout(3000);
            
            // Check if post appeared
            const postVisible = await this.page.$('::-p-text([TEST] Automated test post)') !== null;
            await this.addTestResult('Post published', postVisible);
            
            await this.takeScreenshot('06-after-post');
          }
        } else {
          await this.addTestResult('Post form found', false);
        }
      } else {
        await this.addTestResult('Group found', false);
      }
    } catch (error) {
      await this.addTestResult('Post to group', false, { error: error.message });
    }
  }

  // Test 6: Profile and Settings
  async testProfileSettings() {
    console.log('\n👤 Test 6: Profile and Settings');
    console.log('-------------------------------');
    
    try {
      // Click on account switcher
      const accountButton = await this.page.$('button[aria-label*="Account"], button:has(img[alt*="Avatar"])');
      if (accountButton) {
        await accountButton.click();
        await this.page.waitForTimeout(1000);
        
        // Click Settings
        const settingsLink = await this.page.$('a::-p-text(Settings)');
        if (settingsLink) {
          await settingsLink.click();
          await this.page.waitForTimeout(2000);
          
          await this.addTestResult('Opened settings', true);
          await this.takeScreenshot('07-settings');
        }
      }
    } catch (error) {
      await this.addTestResult('Profile settings', false, { error: error.message });
    }
  }

  // Test 7: Verify Nostr Events
  async testNostrEvents() {
    console.log('\n🌐 Test 7: Verify Nostr Events');
    console.log('------------------------------');
    
    try {
      // Query for our test profile
      const profileFilter = {
        kinds: [0],
        authors: [TEST_ACCOUNT.publicKey],
        limit: 1
      };
      
      const profiles = await this.pool.querySync(['wss://nos.lol', 'wss://relay.primal.net'], profileFilter);
      await this.addTestResult('Profile event exists', profiles.length > 0, {
        eventId: profiles[0]?.id
      });
      
      // Query for recent posts
      const postFilter = {
        kinds: [1],
        authors: [TEST_ACCOUNT.publicKey],
        limit: 5
      };
      
      const posts = await this.pool.querySync(['wss://nos.lol', 'wss://relay.primal.net'], postFilter);
      await this.addTestResult('Posts published', posts.length > 0, {
        count: posts.length
      });
      
    } catch (error) {
      await this.addTestResult('Nostr verification', false, { error: error.message });
    }
  }

  async generateReport() {
    console.log('\n📊 Generating Test Report');
    console.log('========================');
    
    const summary = {
      total: this.testResults.tests.length,
      passed: this.testResults.tests.filter(t => t.success).length,
      failed: this.testResults.tests.filter(t => !t.success).length
    };
    
    this.testResults.summary = summary;
    
    await fs.writeFile(
      'test-results/automated-test-report.json',
      JSON.stringify(this.testResults, null, 2)
    );
    
    console.log(`\n✅ Passed: ${summary.passed}/${summary.total}`);
    console.log(`❌ Failed: ${summary.failed}/${summary.total}`);
    console.log('\n📁 Report saved to: test-results/automated-test-report.json');
    console.log(`📸 Screenshots: ${this.testResults.screenshots.length} captured`);
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
    this.pool.close(['wss://nos.lol', 'wss://relay.primal.net']);
  }

  async run() {
    try {
      await this.init();
      
      // Run all tests in sequence
      await this.testHomepage();
      await this.testLogin();
      await this.testGroupsPage();
      await this.testCreateNip72Group();
      await this.testPostToGroup();
      await this.testProfileSettings();
      await this.testNostrEvents();
      
      await this.generateReport();
      
    } catch (error) {
      console.error('\n❌ Test suite error:', error);
      this.testResults.errors.push(error.message);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the tests
const tester = new ChorusAppTester();
await tester.run();