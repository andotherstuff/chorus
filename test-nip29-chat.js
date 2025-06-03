import { chromium } from 'playwright';

async function testNip29Chat() {
  console.log('Testing NIP-29 chat messages loading...\\n');
  
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
    if (text.includes('[Query]') || 
        text.includes('nip29-chat-messages') ||
        text.includes('NIP-29') ||
        text.includes('kinds') ||
        text.includes('communities.nos.social')) {
      console.log(`Console: ${text}`);
    }
  });
  
  console.log('Loading NIP-29 group chat page...\\n');
  
  try {
    await page.goto('http://localhost:8080/group/nip29/wss%3A%2F%2Fcommunities.nos.social%2F/MXciDlZ5Me0Q64VL#chat', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // Wait for loading to complete
    console.log('Waiting for page to load...');
    await page.waitForTimeout(10000);
    
    // Check for chat interface elements
    const chatContainer = await page.locator('text="Group Chat"').isVisible().catch(() => false);
    const messageArea = await page.locator('textarea[placeholder*="Type your message"]').isVisible().catch(() => false);
    const sendButton = await page.locator('button:has-text("Send")').isVisible().catch(() => false);
    const noMessages = await page.locator('text="No messages yet"').isVisible().catch(() => false);
    const hasMessages = await page.locator('[class*="space-y-1"] > div').count();
    
    console.log('\\n=== Chat Interface Status ===');
    console.log(`Chat container visible: ${chatContainer}`);
    console.log(`Message textarea visible: ${messageArea}`);
    console.log(`Send button visible: ${sendButton}`);
    console.log(`"No messages yet" shown: ${noMessages}`);
    console.log(`Message count: ${hasMessages}`);
    
    // Look for relevant query logs
    console.log('\\n=== Query Logs ===');
    const queryLogs = logs.filter(log => 
      log.includes('nip29-chat-messages') ||
      log.includes('kinds: [1]') ||
      log.includes('#h') ||
      log.includes('communities.nos.social')
    );
    queryLogs.forEach(log => console.log(log));
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/nip29-chat-test.png', fullPage: true });
    console.log('\\nScreenshot saved: test-results/nip29-chat-test.png');
    
    await browser.close();
    
  } catch (error) {
    console.error('Error:', error.message);
    await browser.close();
  }
}

testNip29Chat();