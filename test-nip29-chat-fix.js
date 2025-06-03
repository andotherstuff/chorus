import { chromium } from 'playwright';

async function testNip29ChatFix() {
  console.log('Testing NIP-29 chat messages with kind 11...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  });
  
  const page = await browser.newPage();
  
  // Collect network requests to see what's being queried
  const requests = [];
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().includes('communities.nos.social')) {
      const postData = request.postData();
      if (postData && postData.includes('REQ')) {
        console.log('\nNostr REQ detected:');
        console.log(postData);
        requests.push(postData);
      }
    }
  });
  
  // Collect console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('nip29-chat-messages') ||
        text.includes('kinds') ||
        text.includes('Chat messages query')) {
      console.log(`Console: ${text}`);
    }
  });
  
  console.log('Loading NIP-29 group chat page...\n');
  
  try {
    await page.goto('http://localhost:8081/group/nip29/wss%3A%2F%2Fcommunities.nos.social%2F/MXciDlZ5Me0Q64VL#chat', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // Wait for loading to complete
    console.log('Waiting for page to load and make requests...');
    await page.waitForTimeout(5000);
    
    // Check for chat messages
    const chatContainer = await page.locator('text="Group Chat"').isVisible().catch(() => false);
    const noMessages = await page.locator('text="No messages yet"').isVisible().catch(() => false);
    const messageCount = await page.locator('[class*="space-y-1"] > div').count();
    
    console.log('\n=== Chat Interface Status ===');
    console.log(`Chat container visible: ${chatContainer}`);
    console.log(`"No messages yet" visible: ${noMessages}`);
    console.log(`Number of message elements found: ${messageCount}`);
    
    // Check if any REQ included kind 11
    console.log('\n=== Request Analysis ===');
    const hasKind11Request = requests.some(req => req.includes('"kinds":[11]'));
    console.log(`Found request with kind 11: ${hasKind11Request}`);
    
    if (hasKind11Request) {
      console.log('\n✅ SUCCESS: The fix is working! Now querying for kind 11 events.');
    } else {
      console.log('\n❌ ISSUE: Still not querying for kind 11 events.');
    }
    
    await page.waitForTimeout(5000); // Keep open to inspect
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await browser.close();
  }
}

testNip29ChatFix().catch(console.error);