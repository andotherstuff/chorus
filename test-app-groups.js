#!/usr/bin/env node

import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';

async function testAppGroups() {
  console.log('Testing groups page in the built app...\n');
  
  // Check if dist exists
  if (!existsSync('./dist/index.html')) {
    console.error('Error: Build the app first with "npm run build:dev"');
    process.exit(1);
  }
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Collect console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[') || text.includes('Error') || text.includes('Failed')) {
      console.log(`Console: ${text}`);
    }
  });
  
  // Serve the built files
  console.log('Starting local server...');
  const { exec } = await import('child_process');
  const server = exec('npx serve dist -p 5555', (error, stdout, stderr) => {
    if (error) console.error('Server error:', error);
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    // Navigate to the app
    console.log('\nNavigating to app...');
    await page.goto('http://localhost:5555/', { waitUntil: 'networkidle' });
    
    // Navigate to groups page
    console.log('Navigating to groups page...');
    await page.goto('http://localhost:5555/groups', { waitUntil: 'networkidle' });
    
    // Wait for potential data loading
    console.log('Waiting for data to load...');
    await page.waitForTimeout(10000);
    
    // Check page state
    const hasGroupCards = await page.locator('.grid').count() > 0;
    const groupCardCount = await page.locator('[class*="overflow-hidden"]').count();
    const noGroupsMessage = await page.locator('text="No groups found"').isVisible().catch(() => false);
    const searchingMessage = await page.locator('text="Searching for Groups"').isVisible().catch(() => false);
    
    console.log('\n=== Page State ===');
    console.log(`Has group grid: ${hasGroupCards}`);
    console.log(`Group cards found: ${groupCardCount}`);
    console.log(`"No groups found" visible: ${noGroupsMessage}`);
    console.log(`"Searching for Groups" visible: ${searchingMessage}`);
    
    // Check for specific badges
    const nip72Count = await page.locator('text="NIP-72"').count();
    const nip29Count = await page.locator('text="NIP-29"').count();
    console.log(`NIP-72 badges: ${nip72Count}`);
    console.log(`NIP-29 badges: ${nip29Count}`);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/app-groups-test.png', fullPage: true });
    console.log('\nScreenshot saved to test-results/app-groups-test.png');
    
    // Get group names if any
    if (groupCardCount > 0) {
      console.log('\nGroups found:');
      const groupNames = await page.locator('[class*="text-lg font-semibold"]').allTextContents();
      groupNames.slice(0, 5).forEach(name => console.log(`  - ${name}`));
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    // Clean up
    server.kill();
    await browser.close();
  }
  
  console.log('\nTest complete!');
}

testAppGroups().catch(console.error);