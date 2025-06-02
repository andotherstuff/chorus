import { chromium } from 'playwright';

async function testGroupsQuick() {
  console.log('Quick test of groups loading...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  });
  
  const page = await browser.newPage();
  
  // Collect console logs
  page.on('console', msg => {
    const text = msg.text();
    
    // Show key logs
    if (text.includes('[Groups]') || 
        text.includes('[NIP-72]') || 
        text.includes('Found') ||
        text.includes('Base provider') ||
        text.includes('communities')) {
      console.log(`Console: ${text}`);
    }
  });
  
  // Navigate to groups page
  console.log('Loading http://localhost:8080/groups...\n');
  
  try {
    await page.goto('http://localhost:8080/groups', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // Wait for loading
    await page.waitForTimeout(8000);
    
    // Check group count
    const groupCards = await page.locator('[class*="Card"][class*="overflow-hidden"]').count();
    const hasNoGroups = await page.locator('text="No groups found"').isVisible().catch(() => false);
    const hasSearching = await page.locator('text="Searching for Groups"').isVisible().catch(() => false);
    
    console.log('\n=== Results ===');
    console.log(`Group cards found: ${groupCards}`);
    console.log(`"No groups found" message: ${hasNoGroups}`);
    console.log(`Still searching: ${hasSearching}`);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/groups-quick-test.png' });
    console.log('Screenshot: test-results/groups-quick-test.png');
    
    await browser.close();
    
    if (groupCards > 0) {
      console.log('\n✅ SUCCESS: Groups are loading!');
    } else {
      console.log('\n❌ ISSUE: No groups found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    await browser.close();
  }
}

testGroupsQuick();