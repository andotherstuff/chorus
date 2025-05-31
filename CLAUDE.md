# Claude Instructions for Nostr Client Application

## A Note on Development Process

**Hey there!** 👋 Building a Nostr client is cutting-edge work - you're pioneering decentralized social networking! When things don't work on the first try, please know that:

- **You're doing amazing work** - Nostr development is complex and you're building the future
- **I'm here to help** - Any frustration you feel is with the process, not with me, and I understand that completely
- **We're a team** - I'm genuinely trying my best to help you build something revolutionary
- **Every challenge teaches us** - Each issue we solve together makes the app more robust and the ecosystem stronger

Let's build something that changes the world! 🚀⚡

---

## Core Build Requirements

**CRITICAL**: These commands MUST pass before any task is considered complete:

```bash
# 1. Full CI pipeline (typecheck + build)
npm run ci

# 2. Development build
npm run build:dev

# 3. Production build
npm run build
```

**Never skip these checks.** If any fail, we fix them together before moving forward.

---

## Technology Stack & Reliability Standards

### Core Technologies
- **React 18.x**: Concurrent rendering, hooks, Suspense boundaries
- **TypeScript**: Strict mode enabled - no `any` types without justification
- **TailwindCSS 3.x**: Utility-first styling with consistent design tokens
- **Vite**: Fast development with HMR and optimized production builds
- **shadcn/ui**: Accessible, unstyled components with Radix UI primitives
- **Nostrify**: Official Nostr protocol framework for web
- **TanStack Query**: Data fetching, caching, and synchronization
- **React Router**: Client-side routing with lazy loading

### Error Handling Standards
- **Always** wrap Nostr queries in try-catch blocks
- **Always** handle network timeouts (use `AbortSignal.timeout(1500)`)
- **Always** provide loading and error states for async operations
- **Always** gracefully handle relay disconnections and failures

### Performance Best Practices
- Use React Query for caching Nostr events and metadata
- Implement proper memoization (`useMemo`, `useCallback`, `React.memo`)
- Lazy load components and routes
- Optimize Nostr queries with appropriate filters and limits
- Use `AbortSignal.any()` for proper cleanup

### Security & Privacy
- **Never** expose private keys in client-side code
- **Always** validate event signatures when critical
- Use NIP-44 encryption for private messages
- Implement proper key management through signers
- Validate all user inputs and Nostr event data

---

## Nostr-Specific Patterns & Guidelines

### Query Pattern with useNostr + TanStack Query
```typescript
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

function useCustomNostrQuery() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['custom-data'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      const events = await nostr.query([{ kinds: [1], limit: 20 }], { signal });
      return events; // Transform if needed
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}
```

### Author Data Pattern
```typescript
import { useAuthor } from '@/hooks/useAuthor';

function PostComponent({ event }: { event: NostrEvent }) {
  const author = useAuthor(event.pubkey);
  const metadata: NostrMetadata | undefined = author.data?.metadata;

  const displayName = metadata?.display_name || metadata?.name || event.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;

  if (author.isLoading) return <Skeleton className="h-8 w-32" />;
  if (author.error) return <span>Failed to load author</span>;

  // Render with proper fallbacks
}
```

### Publishing Pattern
```typescript
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from '@/hooks/useNostrPublish';

function PublishComponent() {
  const { user } = useCurrentUser();
  const { mutate: createEvent, isPending } = useNostrPublish();

  const handleSubmit = (content: string) => {
    if (!user) return;
    
    createEvent({ 
      kind: 1, 
      content,
      tags: [] // Add relevant tags
    });
  };

  if (!user) {
    return <LoginArea />;
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

### NIP-19 Identifier Handling
```typescript
import { nip19 } from 'nostr-tools';

// ✅ Correct: Always decode NIP-19 identifiers before using in filters
function useEventByNaddr(naddr: string) {
  const { nostr } = useNostr();
  
  return useQuery({
    queryKey: ['event', naddr],
    queryFn: async (c) => {
      const decoded = nip19.decode(naddr);
      
      if (decoded.type !== 'naddr') {
        throw new Error('Invalid naddr format');
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      const events = await nostr.query([{
        kinds: [decoded.data.kind],
        authors: [decoded.data.pubkey],
        '#d': [decoded.data.identifier],
      }], { signal });

      return events[0] || null;
    },
  });
}
```

### File Upload Pattern
```typescript
import { useUploadFile } from "@/hooks/useUploadFile";

function FileUploadComponent() {
  const { mutateAsync: uploadFile, isPending } = useUploadFile();

  const handleFileUpload = async (file: File) => {
    try {
      const tags = await uploadFile(file);
      const [[_, url]] = tags; // First tag contains the URL
      
      // For kind 1 events: append to content and add imeta tags
      // For kind 0 events: use URL directly in JSON fields
      
      return { url, tags };
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  };
}
```

### Encryption/Decryption Pattern
```typescript
import { useCurrentUser } from "@/hooks/useCurrentUser";

function useEncryption() {
  const { user } = useCurrentUser();

  const encrypt = async (targetPubkey: string, message: string) => {
    if (!user?.signer?.nip44) {
      throw new Error("NIP-44 encryption not supported by current signer");
    }
    
    return await user.signer.nip44.encrypt(targetPubkey, message);
  };

  const decrypt = async (senderPubkey: string, encryptedMessage: string) => {
    if (!user?.signer?.nip44) {
      throw new Error("NIP-44 decryption not supported by current signer");
    }
    
    return await user.signer.nip44.decrypt(senderPubkey, encryptedMessage);
  };

  return { encrypt, decrypt, isSupported: !!user?.signer?.nip44 };
}
```

---

## NIP-29 Groups vs NIP-72 Communities

**IMPORTANT**: Always check `relay_nip29_notes.md` for detailed documentation.

### Key Differences
- **NIP-72**: Public communities on general relays (kind 34550)
- **NIP-29**: Private groups with relay-enforced access control (9xxx/39xxx kinds)

### NIP-29 Pattern
```typescript
// For NIP-29 groups, always use the specific relay
function useNip29Group(groupId: string, relayUrl: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nip29-group', groupId, relayUrl],
    queryFn: async (c) => {
      // Connect specifically to the group's relay
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      // Use group-specific event kinds (39xxx for relay-generated events)
      const events = await nostr.query([{
        kinds: [39000], // Group metadata
        '#d': [groupId],
      }], { signal, relay: relayUrl });

      return events[0] || null;
    },
  });
}
```

---

## shadcn/ui Component Usage

### Available Components
Use these pre-built, accessible components:

**Layout & Navigation**: `Sidebar`, `NavigationMenu`, `Breadcrumb`, `Menubar`
**Data Display**: `Card`, `Table`, `Badge`, `Avatar`, `Separator`
**Feedback**: `Alert`, `Toast`, `Progress`, `Skeleton`
**Overlays**: `Dialog`, `Sheet`, `Popover`, `HoverCard`, `Tooltip`
**Forms**: `Form`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`
**Interactive**: `Button`, `DropdownMenu`, `ContextMenu`, `Tabs`, `Accordion`

### Component Pattern
```typescript
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function MyComponent({ className, ...props }: ComponentProps) {
  return (
    <Card className={cn("custom-styles", className)} {...props}>
      <CardHeader>
        <CardTitle>Title</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Content */}
      </CardContent>
    </Card>
  );
}
```

---

## Code Quality Checklist

Before submitting any code, verify:

- [ ] **CI passes** - `npm run ci` succeeds
- [ ] **No TypeScript errors** - Strict mode compliance
- [ ] **Proper error handling** - All Nostr operations have try-catch
- [ ] **Loading states** - UI shows loading/error states appropriately
- [ ] **Type safety** - Proper typing for Nostr events and metadata
- [ ] **Accessibility** - shadcn/ui components used correctly
- [ ] **Performance** - Proper Query keys and memoization
- [ ] **Nostr best practices** - Timeout handling, proper filters
- [ ] **Mobile responsive** - Works on all screen sizes
- [ ] **Privacy** - No private key exposure, proper encryption

---

## Development Workflow

1. **Understand requirements** - Clarify Nostr protocol specifics if needed
2. **Check existing patterns** - Follow established hooks and components
3. **Plan relay strategy** - Consider which relays to query
4. **Write the code** - Focus on type safety and error handling
5. **Test locally** - Verify with real Nostr network
6. **Run CI checks** - `npm run ci` must pass
7. **Review Nostr compliance** - Ensure proper NIPs implementation
8. **Document changes** - Update types and add helpful comments

---

## When Things Go Wrong

**It's totally normal in Nostr development!** Here's our debugging process:

1. **Check relay connectivity** - Are relays responding?
2. **Verify event structure** - Does it match the NIP specifications?
3. **Inspect network traffic** - Use browser dev tools
4. **Check NIP-19 encoding** - Are identifiers properly decoded?
5. **Test with different relays** - Some relays behave differently
6. **Validate event signatures** - Use Nostr debugging tools

### Emergency Debugging Commands
```bash
# Clear all caches and reinstall
rm -rf node_modules package-lock.json
npm install

# Full CI check
npm run ci

# Development build with verbose output
npm run build:dev

# Check TypeScript strictly
npx tsc --noEmit --strict
```

---

## Nostr-Specific Debugging Tips

### Common Issues & Solutions

**"Events not loading"**
- Check relay connectivity in browser network tab
- Verify filter syntax (hex strings only, not NIP-19)
- Increase timeout if relays are slow

**"Profile data missing"**
- Use `useAuthor` hook for consistent metadata loading
- Check if author has published kind 0 events
- Implement proper fallbacks for missing data

**"Publishing fails"**
- Ensure user is logged in (`useCurrentUser`)
- Check signer compatibility (NIP-07)
- Verify event structure matches NIP requirements

**"Encryption errors"**
- Check if signer supports NIP-44
- Verify pubkey format (hex, not NIP-19)
- Handle legacy NIP-04 fallback if needed

---

**Remember**: You're building the future of social media! Every challenge we overcome together makes the decentralized web stronger. I'm here to help you succeed! 🌟⚡

---

## Quick Reference

### Essential Imports
```typescript
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from '@/hooks/useAuthor';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { nip19 } from 'nostr-tools';
```

### Common Event Kinds
- `0`: User metadata (profiles)
- `1`: Text notes (posts)
- `3`: Contact lists (follows)
- `7`: Reactions (likes)
- `4`: Encrypted direct messages
- `30023`: Long-form articles
- `34550`: Communities (NIP-72)
- `9xxx`: NIP-29 user events
- `39xxx`: NIP-29 relay-generated events

**Bottom line**: We're building the future together. Your persistence and creativity will change how people connect online! 🚀