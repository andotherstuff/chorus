#!/usr/bin/env node

import { chromium } from 'playwright';

async function testUnifiedGroups() {
  console.log('Testing unified groups loading in the app...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  });
  
  const page = await browser.newPage();
  
  // Inject console logging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Groups]') || 
        text.includes('[NIP-72]') || 
        text.includes('[NIP-29]') ||
        text.includes('[NostrProvider]') ||
        text.includes('[EnhancedNostrProvider]') ||
        text.includes('Found') || 
        text.includes('Query') ||
        text.includes('Error')) {
      console.log(`Console: ${text}`);
    }
  });
  
  // Navigate to app
  console.log('Navigating to app...');
  await page.goto('http://localhost:8081/', { waitUntil: 'domcontentloaded' });
  
  // Wait for app to initialize
  await page.waitForTimeout(3000);
  
  // Navigate to groups page
  console.log('\nNavigating to groups page...');
  await page.goto('http://localhost:8081/groups', { waitUntil: 'domcontentloaded' });
  
  // Wait for potential data loading
  console.log('\nWaiting for data to load...');
  await page.waitForTimeout(10000);
  
  // Check page state
  const groupsGrid = await page.locator('.grid').first().isVisible().catch(() => false);
  const noGroupsMessage = await page.locator('text="No groups found"').isVisible().catch(() => false);
  const loadingMessage = await page.locator('text="Searching for Groups"').isVisible().catch(() => false);
  
  console.log('\n=== Page State ===');
  console.log(`Groups grid visible: ${groupsGrid}`);
  console.log(`"No groups found" message: ${noGroupsMessage}`);
  console.log(`"Searching for Groups" message: ${loadingMessage}`);
  
  // Count actual group cards
  const groupCards = await page.locator('[class*="Card"]').count();
  console.log(`Group cards found: ${groupCards}`);
  
  // Check for specific group types
  const nip72Badges = await page.locator('text="NIP-72"').count();
  const nip29Badges = await page.locator('text="NIP-29"').count();
  console.log(`NIP-72 badges: ${nip72Badges}`);
  console.log(`NIP-29 badges: ${nip29Badges}`);
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/unified-groups-test.png', fullPage: true });
  console.log('\nScreenshot saved to test-results/unified-groups-test.png');
  
  // Keep browser open for inspection
  console.log('\nBrowser will stay open. Press Ctrl+C to close.');
  await new Promise(() => {});
}

testUnifiedGroups().catch(console.error);