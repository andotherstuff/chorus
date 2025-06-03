const { Relay } = require('nostr-tools/relay');

async function testChorusRelay() {
  console.log('Testing wss://relay.chorus.community/ directly...\n');
  
  try {
    const relay = new Relay('wss://relay.chorus.community/');
    
    console.log('Connecting to relay...');
    await relay.connect();
    console.log('✅ Connected successfully');
    
    // Test 1: Query for any kind 34550 events
    console.log('\n1. Querying for any NIP-72 communities (kind 34550)...');
    const communities = [];
    
    const sub1 = relay.subscribe([{ kinds: [34550], limit: 50 }], {
      onevent(event) {
        communities.push(event);
      },
      oneose() {
        console.log(`Found ${communities.length} communities`);
        if (communities.length > 0) {
          console.log('First community:', {
            id: communities[0].id,
            pubkey: communities[0].pubkey,
            created_at: communities[0].created_at,
            tags: communities[0].tags.slice(0, 5)
          });
        }
      }
    });
    
    // Wait for query to complete
    await new Promise(resolve => {
      setTimeout(() => {
        sub1.close();
        resolve();
      }, 3000);
    });
    
    // Test 2: Query for recent events
    console.log('\n2. Querying for recent events...');
    const recentEvents = [];
    
    const sub2 = relay.subscribe([{ kinds: [1, 34550], limit: 10 }], {
      onevent(event) {
        recentEvents.push(event);
      },
      oneose() {
        console.log(`Found ${recentEvents.length} recent events`);
      }
    });
    
    await new Promise(resolve => {
      setTimeout(() => {
        sub2.close();
        resolve();
      }, 3000);
    });
    
    // Test 3: Any events
    console.log('\n3. Querying for any events...');
    const anyEvents = [];
    
    const sub3 = relay.subscribe([{ limit: 20 }], {
      onevent(event) {
        anyEvents.push(event);
      },
      oneose() {
        console.log(`Found ${anyEvents.length} total events`);
        if (anyEvents.length > 0) {
          const eventKinds = [...new Set(anyEvents.map(e => e.kind))];
          console.log('Event kinds found:', eventKinds);
        }
      }
    });
    
    await new Promise(resolve => {
      setTimeout(() => {
        sub3.close();
        resolve();
      }, 3000);
    });
    
    if (anyEvents.length > 0) {
      const eventKinds = [...new Set(anyEvents.map(e => e.kind))];
      console.log('Event kinds found:', eventKinds);
    }
    
    await relay.close();
    console.log('\n✅ Test complete');
    
  } catch (error) {
    console.error('❌ Error testing relay:', error.message);
  }
}

testChorusRelay();