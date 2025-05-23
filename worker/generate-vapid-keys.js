import webpush from 'web-push';

// Generate VAPID keys
const vapidKeys = webpush.generateVAPIDKeys();

console.log('VAPID Keys Generated:\n');
console.log('Public Key (safe to use in client/frontend):');
console.log(vapidKeys.publicKey);
console.log('\nPrivate Key (KEEP SECRET - use only in server/worker):');
console.log(vapidKeys.privateKey);
console.log('\n\nInstructions:');
console.log('1. Add to your .env file (client):');
console.log(`   VITE_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log('\n2. Add to Cloudflare Worker secrets:');
console.log('   Run: wrangler secret put VAPID_PRIVATE_KEY');
console.log(`   Then paste: ${vapidKeys.privateKey}`);
console.log('\n3. Also add to Worker environment:');
console.log('   VAPID_SUBJECT=mailto:your-email@example.com');
EOF 2>&1
