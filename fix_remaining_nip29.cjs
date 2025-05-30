const fs = require('fs');
const path = require('path');

// List of files to fix
const files = [
  'src/components/groups/Nip29MemberManagement.tsx',
  'src/components/groups/Nip29ReportsList.tsx'
];

files.forEach(filePath => {
  console.log(`Fixing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Pattern 1: Replace publishEvent calls with direct signing
  content = content.replace(
    /await user!\.signer\.signEvent\(({[^}]+}), \{[^}]*}\);/g,
    (match, eventObject) => {
      // Add created_at if not present
      let event = eventObject;
      if (!event.includes('created_at')) {
        event = event.replace(/content: ([^,}]+),?(\s*})/, 'content: $1,\n        created_at: Math.floor(Date.now() / 1000),$2');
      }
      return `await user!.signer.signEvent(${event});`;
    }
  );
  
  // Pattern 2: Add null check for nostr and fix event publishing
  content = content.replace(
    /const event = await user!\.signer\.signEvent\(({[^}]+})\);\s*\n\s*\/\/ Send to relay or handle the signed event/g,
    `const event = await user!.signer.signEvent($1);
      
      if (!nostr) {
        throw new Error("Nostr client not available");
      }
      
      await nostr.event(event, { relays: [relay] });`
  );
  
  // Pattern 3: Fix standalone signEvent calls
  content = content.replace(
    /const event = await user!\.signer\.signEvent\(({[^}]+})\);\s*$/gm,
    (match, eventObject) => {
      return `const event = await user!.signer.signEvent(${eventObject});
      
      if (!nostr) {
        throw new Error("Nostr client not available");
      }
      
      await nostr.event(event, { relays: [relay] });`;
    }
  );
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed ${filePath}`);
});

console.log('All remaining NIP-29 components fixed!');