const WebSocket = require('ws');

// Test both regular posts and approval events
async function testQueries() {
  const ws = new WebSocket('wss://relay.chorus.community/');
  
  ws.on('open', () => {
    console.log('Connected to relay.chorus.community');
    
    // Query for regular posts
    const postsFilter = {
      kinds: [1],
      '#a': ['34550:826be9c067e944d87299e42e7d72a1508f4a3c1ebeaaa8c4c96c4d3e5733ad68:Oslo-Freedom-Forum-2025'],
      limit: 10
    };
    
    console.log('Querying for posts with filter:', JSON.stringify(postsFilter, null, 2));
    ws.send(JSON.stringify(['REQ', 'sub1', postsFilter]));
    
    // Also query for approval events
    setTimeout(() => {
      const approvalFilter = {
        kinds: [4550],
        '#a': ['34550:826be9c067e944d87299e42e7d72a1508f4a3c1ebeaaa8c4c96c4d3e5733ad68:Oslo-Freedom-Forum-2025'],
        limit: 10
      };
      
      console.log('\nQuerying for approval events with filter:', JSON.stringify(approvalFilter, null, 2));
      ws.send(JSON.stringify(['REQ', 'sub2', approvalFilter]));
    }, 500);
  });
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg[0] === 'EVENT') {
      const event = msg[2];
      const eventType = event.kind === 1 ? 'Post' : 'Approval';
      console.log(`\n${eventType} found:`, {
        id: event.id,
        kind: event.kind,
        pubkey: event.pubkey,
        content: event.content.substring(0, 100) + (event.content.length > 100 ? '...' : ''),
        tags: event.tags
      });
    } else if (msg[0] === 'EOSE') {
      console.log(`End of ${msg[1]}`);
      if (msg[1] === 'sub2') {
        ws.close();
      }
    }
  });
  
  ws.on('error', (err) => {
    console.error('Error:', err);
  });
}

testQueries();