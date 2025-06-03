import { chromium } from 'playwright';

async function testNip72Posts() {
  console.log('Testing NIP-72 posts loading...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  });
  
  const page = await browser.newPage();
  
  // Collect console logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    
    // Show key logs immediately
    if (text.includes('[PostList]') || 
        text.includes('pending-posts') ||
        text.includes('approved-posts') ||
        text.includes('NIP-72') ||
        text.includes('#a')) {
      console.log(`Console: ${text}`);
    }
  });
  
  // Collect network requests
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().includes('relay')) {
      const postData = request.postData();
      if (postData && postData.includes('REQ')) {
        console.log('\nNostr REQ detected:');
        console.log(postData);
      }
    }
  });
  
  console.log('Loading NIP-72 group posts page...\n');
  
  try {
    await page.goto('http://localhost:8081/group/nip72:76c71aae3a491f1d9eec47cba17e229cda4113a0bbb6e6ae1776d7643e29cafa:protest-net-mb3ghoz8#posts', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // Wait for loading to complete
    console.log('Waiting for page to load...');
    await page.waitForTimeout(5000);
    
    // Check for posts
    const noPostsMessage = await page.locator('text="No posts yet"').isVisible().catch(() => false);
    const loadingIndicator = await page.locator('[class*="animate-pulse"]').count();
    const postCount = await page.locator('[data-testid="post-item"]').count();
    const postCards = await page.locator('[class*="card"]').count();
    
    console.log('\n=== Posts Display Status ===');
    console.log(`"No posts yet" visible: ${noPostsMessage}`);
    console.log(`Loading indicators: ${loadingIndicator}`);
    console.log(`Post items found: ${postCount}`);
    console.log(`Card elements found: ${postCards}`);
    
    // Check for specific UI elements
    const pendingTab = await page.locator('button:has-text("Pending")').isVisible().catch(() => false);
    const approvedTab = await page.locator('button:has-text("Approved")').isVisible().catch(() => false);
    
    console.log('\n=== UI Elements ===');
    console.log(`Pending tab visible: ${pendingTab}`);
    console.log(`Approved tab visible: ${approvedTab}`);
    
    // Check what's in the logs
    const postLogs = logs.filter(log => log.includes('NIP-72 posts'));
    console.log('\n=== Post Query Logs ===');
    postLogs.forEach(log => console.log(log));
    
    await page.waitForTimeout(5000); // Keep open to inspect
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await browser.close();
  }
}

testNip72Posts().catch(console.error);