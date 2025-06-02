import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Testing +chorus app at http://10.255.12.206:8080/');
  
  try {
    // Navigate to the app
    await page.goto('http://10.255.12.206:8080/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/app-loaded.png' });
    
    // Check if app loaded
    const title = await page.title();
    console.log('Page title:', title);
    
    // Look for main elements
    const hasHeader = await page.locator('header').count() > 0;
    console.log('Has header:', hasHeader);
    
    // Check for groups link
    const groupsLink = await page.locator('a[href="/groups"]').count() > 0;
    console.log('Has groups link:', groupsLink);
    
    // Check for login area
    const loginButton = await page.locator('button:has-text("Login")').count() > 0;
    console.log('Has login button:', loginButton);
    
    // Test navigation to groups
    if (groupsLink) {
      await page.click('a[href="/groups"]');
      await page.waitForTimeout(2000);
      const url = page.url();
      console.log('Current URL after clicking groups:', url);
      await page.screenshot({ path: 'test-results/groups-page.png' });
    }
    
  } catch (error) {
    console.error('Error during testing:', error);
  }
  
  await browser.close();
})();