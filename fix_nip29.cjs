const fs = require('fs');

// Read the file
const filePath = 'src/hooks/useNip29GroupOperations.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Fix patterns:

// 1. Add created_at to signEvent calls
content = content.replace(
  /await user!\.signer\.signEvent\({\s*kind: (\d+),\s*tags([^}]*),\s*content: ([^,}]*),?\s*}\);/g,
  'await user!.signer.signEvent({\n      kind: $1,\n      tags$2,\n      content: $3,\n      created_at: Math.floor(Date.now() / 1000),\n    });'
);

// 2. Add null check for nostr and fix event publishing
content = content.replace(
  /await nostr\.event\(event, relay\);/g,
  `if (!nostr) {
      throw new Error("Nostr client not available");
    }
    
    await nostr.event(event, { relays: [relay] });`
);

// Write the file back
fs.writeFileSync(filePath, content);

console.log('Fixed useNip29GroupOperations.ts');