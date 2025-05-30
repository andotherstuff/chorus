const fs = require('fs');

// Read the file
const filePath = 'src/hooks/useNip29GroupOperations.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Fix indentation and add created_at to remaining signEvent calls
const fixes = [
  // Pattern for signEvent without created_at
  {
    pattern: /const event = await user!\.signer\.signEvent\({\s*kind: (\d+),[^}]*content: ([^,}]*),?\s*}\);/g,
    replacement: `const event = await user!.signer.signEvent({
        kind: $1,
        tags,
        content: $2,
        created_at: Math.floor(Date.now() / 1000),
      });`
  },
  
  // Fix indentation for nostr checks
  {
    pattern: /^(\s*)if \(!nostr\) {\s*throw new Error\("Nostr client not available"\);\s*}\s*await nostr\.event\(event, \{ relays: \[relay\] \}\);/gm,
    replacement: `$1if (!nostr) {
$1  throw new Error("Nostr client not available");
$1}
$1
$1await nostr.event(event, { relays: [relay] });`
  }
];

fixes.forEach(fix => {
  content = content.replace(fix.pattern, fix.replacement);
});

fs.writeFileSync(filePath, content);
console.log('Applied all fixes to useNip29GroupOperations.ts');