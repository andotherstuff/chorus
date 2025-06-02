import { chromium } from 'playwright';

async function testNip72Final() {
  console.log('Testing NIP-72 member display after fixes...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  
  // Collect console logs
  page.on('console', msg => {
    const text = msg.text();
    
    // Filter for relevant logs
    if (text.includes('useApprovedMembers') || 
        text.includes('useGroupPosters') ||
        text.includes('SimpleMembersList') ||
        text.includes('Query filters') ||
        text.includes('Member strategy') ||
        text.includes('Found') && text.includes('posts') ||
        text.includes('Using') && text.includes('members')) {
      console.log(`Console: ${text}`);
    }
  });
  
  // Navigate to the Oslo Freedom Forum NIP-72 group members page
  const url = 'http://localhost:8080/group/nip72:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:oslo-freedom-forum-2025-mb3ch5ft#members';
  console.log(`Navigating to: ${url}\n`);
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for data to load
    await page.waitForTimeout(8000);
    
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
    
    // Check for member cards
    const memberCards = await page.locator('[class*="rounded-md hover:bg-muted"]').count();
    console.log(`Member cards found: ${memberCards}`);
    
    // Check for Group Owner & Moderators section
    const moderatorsSection = await page.locator('text="Group Owner & Moderators"').isVisible().catch(() => false);
    console.log(`Moderators section visible: ${moderatorsSection}`);
    
    // Take a screenshot
    await page.screenshot({ path: 'test-results/nip72-members-final.png', fullPage: true });
    console.log('\nScreenshot saved to test-results/nip72-members-final.png');
    
  } catch (error) {
    console.error('Error during test:', error.message);
  }
  
  console.log('\nTest complete. Browser will close in 10 seconds...');
  await page.waitForTimeout(10000);
  await browser.close();
}

testNip72Final().catch(console.error);