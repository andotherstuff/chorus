import { chromium } from 'playwright';

async function debugGroupsLoading() {
  console.log('Debugging groups page loading...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  
  // Collect all console logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    
    // Log important messages immediately
    if (text.includes('[Groups]') || 
        text.includes('[NIP-72]') || 
        text.includes('Found') || 
        text.includes('Query') ||
        text.includes('Error') ||
        text.includes('Failed')) {
      console.log(`Console: ${text}`);
    }
  });
  
  // Collect network errors
  page.on('requestfailed', request => {
    console.log(`Network Failed: ${request.url()} - ${request.failure()?.errorText}`);
  });
  
  // Navigate to groups page
  const url = 'http://localhost:8080/groups';
  console.log(`Navigating to: ${url}\n`);
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for potential data loading
    console.log('Waiting for data to load...');
    await page.waitForTimeout(15000);
    
    // Check what's visible on the page
    const hasGroupCards = await page.locator('[class*="grid grid-cols-1 xs:grid-cols-2"]').first().isVisible().catch(() => false);
    const hasSkeletons = await page.locator('[class*="Skeleton"]').count();
    const hasNoGroupsMessage = await page.locator('text="No groups found"').isVisible().catch(() => false);
    const hasSearchingMessage = await page.locator('text="Searching for Groups"').isVisible().catch(() => false);
    
    console.log('\n=== Page State ===');
    console.log(`Group cards visible: ${hasGroupCards}`);
    console.log(`Skeleton loaders: ${hasSkeletons}`);
    console.log(`"No groups found" message: ${hasNoGroupsMessage}`);
    console.log(`"Searching for Groups" message: ${hasSearchingMessage}`);
    
    // Count actual group cards
    const groupCardCount = await page.locator('[class*="Card"][class*="overflow-hidden"]').count();
    console.log(`Actual group cards found: ${groupCardCount}`);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/groups-debug.png', fullPage: true });
    console.log('\nScreenshot saved to test-results/groups-debug.png');
    
    // Look for specific console patterns
    console.log('\n=== Key Console Logs ===');
    const importantLogs = logs.filter(log => 
      log.includes('communities') || 
      log.includes('Total groups') ||
      log.includes('Found') ||
      log.includes('Error') ||
      log.includes('timeout')
    );
    importantLogs.forEach(log => console.log(log));
    
  } catch (error) {
    console.error('Error during debug:', error.message);
  }
  
  console.log('\nBrowser will stay open for manual inspection. Press Ctrl+C to close.');
  await new Promise(() => {}); // Keep open
}

debugGroupsLoading().catch(console.error);