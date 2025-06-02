import { chromium } from 'playwright';

async function testGroupsDetailed() {
  console.log('Detailed test of groups rendering...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  });
  
  const page = await browser.newPage();
  
  // Collect ALL console logs
  const allLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    allLogs.push(text);
    
    // Show key logs immediately
    if (text.includes('Total groups') || 
        text.includes('sortedAndFilteredGroups') ||
        text.includes('allGroups') ||
        text.includes('error') ||
        text.includes('Error')) {
      console.log(`Console: ${text}`);
    }
  });
  
  console.log('Loading groups page...\n');
  
  try {
    await page.goto('http://localhost:8080/groups', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // Wait for loading to complete
    await page.waitForTimeout(10000);
    
    // Check what elements are present
    const gridContainer = await page.locator('.grid.grid-cols-1.xs\\:grid-cols-2').first();
    const isGridVisible = await gridContainer.isVisible().catch(() => false);
    
    const groupCards = await page.locator('[class*="Card"]').count();
    const skeletons = await page.locator('[class*="Skeleton"]').count();
    
    // Check for specific text that might indicate what's happening
    const searchingText = await page.locator('text="Searching for Groups"').isVisible().catch(() => false);
    const noGroupsText = await page.locator('text="No groups found"').isVisible().catch(() => false);
    
    console.log('\n=== Page Elements ===');
    console.log(`Grid container visible: ${isGridVisible}`);
    console.log(`Group cards: ${groupCards}`);
    console.log(`Skeleton loaders: ${skeletons}`);
    console.log(`"Searching for Groups": ${searchingText}`);
    console.log(`"No groups found": ${noGroupsText}`);
    
    // Look for filtering/sorting logs
    console.log('\n=== Filtering/Sorting Logs ===');
    const filterLogs = allLogs.filter(log => 
      log.includes('sortedAndFilteredGroups') ||
      log.includes('allGroups') ||
      log.includes('filter') ||
      log.includes('Group parsing')
    );
    filterLogs.forEach(log => console.log(log));
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/groups-detailed-test.png', fullPage: true });
    console.log('\nScreenshot saved: test-results/groups-detailed-test.png');
    
    await browser.close();
    
  } catch (error) {
    console.error('Error:', error.message);
    await browser.close();
  }
}

testGroupsDetailed();