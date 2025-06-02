import { chromium } from 'playwright';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import fs from 'fs/promises';

const APP_URL = 'http://10.255.12.206:8080';
const TEST_CONFIG = JSON.parse(await fs.readFile('./test-config.json', 'utf-8'));
const TEST_ACCOUNT = JSON.parse(await fs.readFile('./test-results/test-account.json', 'utf-8'));

class ChorusE2ETests {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.testResults = [];
  }

  async init() {
    console.log('🎭 Starting Playwright E2E Tests for +chorus...');
    this.browser = await chromium.launch({ 
      headless: false,
      slowMo: 100 // Slow down for visibility
    });
    
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      permissions: ['clipboard-read', 'clipboard-write']
    });
    
    this.page = await this.context.newPage();
    
    // Enable console logging
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser Console Error:', msg.text());
      }
    });
  }

  async testHomepage() {
    console.log('\n🏠 Test 1: Homepage Navigation');
    
    await this.page.goto(APP_URL);
    await this.page.waitForLoadState('networkidle');
    
    // Check title
    const title = await this.page.title();
    console.log(`  ✅ Page title: "${title}"`);
    
    // Check for key elements
    const hasLoginButton = await this.page.locator('button:has-text("Sign in"), button:has-text("Get Started")').count() > 0;
    console.log(`  ${hasLoginButton ? '✅' : '❌'} Login/Get Started button present`);
    
    // Check navigation
    const hasGroupsLink = await this.page.locator('a[href="/groups"]').count() > 0;
    console.log(`  ${hasGroupsLink ? '✅' : '❌'} Groups navigation link present`);
    
    await this.page.screenshot({ path: 'test-results/01-homepage.png' });
    
    return { success: hasLoginButton && hasGroupsLink };
  }

  async testOnboarding() {
    console.log('\n👤 Test 2: New User Onboarding');
    
    // Click Get Started
    const getStartedButton = this.page.locator('button:has-text("Get Started")');
    if (await getStartedButton.isVisible()) {
      await getStartedButton.click();
      console.log('  ✅ Clicked Get Started');
      
      // Wait for profile setup page
      await this.page.waitForURL('**/settings/profile**', { timeout: 5000 }).catch(() => {});
      
      // Check if we're on profile setup
      const isProfileSetup = this.page.url().includes('/settings/profile');
      if (isProfileSetup) {
        console.log('  ✅ Navigated to profile setup');
        
        // Check for pre-filled name
        const nameInput = this.page.locator('input[name="name"], input[placeholder*="name" i]').first();
        const prefilledName = await nameInput.inputValue();
        console.log(`  ✅ Pre-filled name: "${prefilledName}"`);
        
        // Update profile
        await nameInput.fill('Test User ' + Date.now());
        
        // Skip for now
        const skipButton = this.page.locator('button:has-text("Skip for now")');
        if (await skipButton.isVisible()) {
          await skipButton.click();
          console.log('  ✅ Clicked Skip for now');
        }
        
        await this.page.screenshot({ path: 'test-results/02-onboarding.png' });
      }
    }
  }

  async testLoginWithNsec() {
    console.log('\n🔐 Test 3: Login with Nsec');
    
    // Go back to homepage
    await this.page.goto(APP_URL);
    await this.page.waitForLoadState('networkidle');
    
    // Click Sign in
    const signInButton = this.page.locator('button:has-text("Sign in")');
    if (await signInButton.isVisible()) {
      await signInButton.click();
      console.log('  ✅ Clicked Sign in');
      
      // Wait for login dialog
      await this.page.waitForSelector('[role="dialog"], .dialog, [data-dialog]', { timeout: 5000 }).catch(() => {});
      
      // Click Nsec tab if visible
      const nsecTab = this.page.locator('button:has-text("Nsec"), [role="tab"]:has-text("Nsec")');
      if (await nsecTab.isVisible()) {
        await nsecTab.click();
        console.log('  ✅ Switched to Nsec tab');
      }
      
      // Enter test nsec
      const nsecInput = this.page.locator('input[type="password"], input[placeholder*="nsec" i]').first();
      await nsecInput.fill(TEST_ACCOUNT.nsec);
      console.log('  ✅ Entered test nsec');
      
      // Click login
      const loginButton = this.page.locator('button:has-text("Login with Nsec"), button:has-text("Login")').last();
      await loginButton.click();
      console.log('  ✅ Clicked login');
      
      // Wait for navigation
      await this.page.waitForURL('**/groups**', { timeout: 10000 }).catch(() => {});
      
      await this.page.screenshot({ path: 'test-results/03-login.png' });
      
      const loggedIn = this.page.url().includes('/groups');
      console.log(`  ${loggedIn ? '✅' : '❌'} Login successful`);
      
      return { success: loggedIn };
    }
  }

  async testGroupsPage() {
    console.log('\n📋 Test 4: Groups Page');
    
    // Navigate to groups if not already there
    if (!this.page.url().includes('/groups')) {
      await this.page.goto(`${APP_URL}/groups`);
    }
    
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(2000); // Wait for data to load
    
    // Check for create group button
    const createGroupButton = this.page.locator('a[href="/create-group"], button:has-text("Create Group")');
    const hasCreateButton = await createGroupButton.count() > 0;
    console.log(`  ${hasCreateButton ? '✅' : '❌'} Create Group button present`);
    
    // Check for group cards
    const groupCards = await this.page.locator('[class*="card"], [data-group-card]').count();
    console.log(`  📊 Found ${groupCards} group cards`);
    
    // Look for test groups
    const testGroups = await this.page.locator(`text="${TEST_CONFIG.testDataPrefix}"`).count();
    console.log(`  📊 Found ${testGroups} test groups`);
    
    await this.page.screenshot({ path: 'test-results/04-groups-page.png' });
  }

  async testCreateGroup() {
    console.log('\n➕ Test 5: Create Group');
    
    // Navigate to create group page
    await this.page.goto(`${APP_URL}/create-group`);
    await this.page.waitForLoadState('networkidle');
    
    // Check if we need to login first
    if (this.page.url() === `${APP_URL}/` || this.page.url() === `${APP_URL}`) {
      console.log('  ⚠️  Redirected to homepage - login required');
      return { success: false, reason: 'Not logged in' };
    }
    
    // Select Public Community (NIP-72)
    const publicOption = this.page.locator('label:has-text("Public Community"), input[value="nip72"]');
    if (await publicOption.isVisible()) {
      await publicOption.click();
      console.log('  ✅ Selected Public Community (NIP-72)');
    }
    
    // Fill in form
    const timestamp = Date.now();
    await this.page.fill('input[name="name"], input[placeholder*="Group Name" i]', `${TEST_CONFIG.testDataPrefix}E2E Test Group ${timestamp}`);
    await this.page.fill('input[name="identifier"], input[placeholder*="Identifier" i]', `test-e2e-${timestamp}`);
    await this.page.fill('textarea[name="description"], textarea[placeholder*="Description" i]', 'This group was created by automated E2E tests');
    
    console.log('  ✅ Filled group creation form');
    
    await this.page.screenshot({ path: 'test-results/05-create-group-form.png' });
    
    // Submit form
    const createButton = this.page.locator('button:has-text("Create Group"), button[type="submit"]').last();
    await createButton.click();
    console.log('  ✅ Clicked Create Group');
    
    // Wait for navigation or success message
    await Promise.race([
      this.page.waitForURL('**/groups**', { timeout: 10000 }),
      this.page.waitForSelector('text="Success"', { timeout: 10000 })
    ]).catch(() => {});
    
    const success = this.page.url().includes('/groups') || await this.page.locator('text="Success"').isVisible();
    console.log(`  ${success ? '✅' : '❌'} Group creation ${success ? 'successful' : 'failed'}`);
    
    return { success };
  }

  async testGroupDetail() {
    console.log('\n🔍 Test 6: Group Detail Page');
    
    // Find and click on a group
    await this.page.goto(`${APP_URL}/groups`);
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(2000);
    
    // Click on first group card
    const groupLink = this.page.locator('a[href*="/group/"]').first();
    if (await groupLink.isVisible()) {
      const groupName = await groupLink.textContent();
      await groupLink.click();
      console.log(`  ✅ Clicked on group: ${groupName}`);
      
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(2000);
      
      // Check for post form
      const postForm = await this.page.locator('textarea[placeholder*="post" i], textarea[placeholder*="message" i]').count() > 0;
      console.log(`  ${postForm ? '✅' : '❌'} Post form present`);
      
      // Check for member count
      const memberInfo = await this.page.locator('text=/\\d+ member/i').count() > 0;
      console.log(`  ${memberInfo ? '✅' : '❌'} Member information present`);
      
      await this.page.screenshot({ path: 'test-results/06-group-detail.png' });
      
      return { success: postForm || memberInfo };
    }
    
    return { success: false, reason: 'No groups found' };
  }

  async generateReport() {
    console.log('\n📊 Generating E2E Test Report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      appUrl: APP_URL,
      testsRun: 6,
      results: this.testResults,
      screenshots: [
        '01-homepage.png',
        '02-onboarding.png',
        '03-login.png',
        '04-groups-page.png',
        '05-create-group-form.png',
        '06-group-detail.png'
      ]
    };
    
    await fs.writeFile(
      'test-results/e2e-test-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('✅ E2E Test report saved to: test-results/e2e-test-report.json');
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run() {
    try {
      await this.init();
      
      // Run all tests
      await this.testHomepage();
      await this.testOnboarding();
      await this.testLoginWithNsec();
      await this.testGroupsPage();
      await this.testCreateGroup();
      await this.testGroupDetail();
      
      await this.generateReport();
      
      console.log('\n🎉 E2E Tests completed!');
      console.log('Check test-results/ directory for screenshots and report.');
      
    } catch (error) {
      console.error('❌ E2E Test error:', error);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the tests
const e2eTests = new ChorusE2ETests();
await e2eTests.run();