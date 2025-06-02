import { chromium } from 'playwright';

async function testNip29Members() {
  console.log('Starting NIP-29 member display test...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  
  const page = await browser.newPage();
  
  // Collect console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    if (text.includes('[NIP-29]') || text.includes('[EnhancedNostrProvider]') || text.includes('members')) {
      console.log(`Console: ${text}`);
    }
  });
  
  // Navigate to the NIP-29 group members page
  const url = 'http://localhost:8080/group/nip29/wss%3A%2F%2Fcommunities.nos.social%2F/MXciDlZ5Me0Q64VL#members';
  console.log(`Navigating to: ${url}\n`);
  
  await page.goto(url, { waitUntil: 'networkidle' });
  
  // Wait for potential member data to load
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
  
  // Check for "No approved members yet" message
  const noMembersMsg = await page.locator('text="No approved members yet"').isVisible().catch(() => false);
  console.log(`"No approved members yet" visible: ${noMembersMsg}`);
  
  // Look for specific console logs about NIP-29 queries
  console.log('\n=== Key Console Logs ===');
  const nip29Logs = consoleLogs.filter(log => 
    log.includes('Filter analysis') || 
    log.includes('Routing query to') ||
    log.includes('Found') ||
    log.includes('members')
  );
  
  nip29Logs.forEach(log => console.log(log));
  
  // Take a screenshot
  await page.screenshot({ path: 'test-results/nip29-members-page.png' });
  console.log('\nScreenshot saved to test-results/nip29-members-page.png');
  
  // Keep browser open for manual inspection
  console.log('\nBrowser will stay open for manual inspection. Press Ctrl+C to close.');
  
  // Wait indefinitely
  await new Promise(() => {});
}

testNip29Members().catch(console.error);