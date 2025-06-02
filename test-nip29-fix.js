import { chromium } from 'playwright';

async function testNip29Fix() {
  console.log('Testing NIP-29 member display fix...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  
  // Collect console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    // Filter for relevant logs
    if (text.includes('SimpleMembersList') || 
        text.includes('[NIP-29]') || 
        text.includes('Filter analysis') ||
        text.includes('member')) {
      console.log(`Console: ${text}`);
    }
  });
  
  // Navigate to the NIP-29 group members page
  const url = 'http://localhost:8080/group/nip29/wss%3A%2F%2Fcommunities.nos.social%2F/MXciDlZ5Me0Q64VL#members';
  console.log(`Navigating to: ${url}\n`);
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait a bit for data to load
    await page.waitForTimeout(5000);
    
    // Check for member display elements
    const membersSection = await page.locator('text=/Members \\(\\d+\\)/').first();
    const hasMembersSection = await membersSection.isVisible().catch(() => false);
    
    console.log('\n=== Test Results ===');
    console.log(`Members section visible: ${hasMembersSection}`);
    
    if (hasMembersSection) {
      const memberCount = await membersSection.textContent();
      console.log(`Member count text: ${memberCount}`);
    }
    
    // Check for specific member elements
    const memberCards = await page.locator('[class*="rounded-md hover:bg-muted"]').count();
    console.log(`Member cards found: ${memberCards}`);
    
    // Take a screenshot
    await page.screenshot({ path: 'test-results/nip29-members-fixed.png', fullPage: true });
    console.log('\nScreenshot saved to test-results/nip29-members-fixed.png');
    
    // Check specific console logs
    const memberLogs = consoleLogs.filter(log => log.includes('isNip29'));
    if (memberLogs.length > 0) {
      console.log('\n=== NIP-29 Detection ===');
      memberLogs.forEach(log => console.log(log));
    }
    
  } catch (error) {
    console.error('Error during test:', error.message);
  }
  
  console.log('\nTest complete. Browser will close in 5 seconds...');
  await page.waitForTimeout(5000);
  await browser.close();
}

testNip29Fix().catch(console.error);