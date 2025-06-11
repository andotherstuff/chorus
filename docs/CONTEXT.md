# Project Overview

This project is a Nostr client application built with React 18.x, TailwindCSS 3.x, Vite, shadcn/ui, and Nostrify.

## Technology Stack

- **React 18.x**: Stable version of React with hooks, concurrent rendering, and improved performance
- **TailwindCSS 3.x**: Utility-first CSS framework for styling
- **Vite**: Fast build tool and development server
- **shadcn/ui**: Unstyled, accessible UI components built with Radix UI and Tailwind
- **Nostrify**: Nostr protocol framework for Deno and web
- **React Router**: For client-side routing
- **TanStack Query**: For data fetching, caching, and state management
- **TypeScript**: For type-safe JavaScript development

## Project Structure

- `/src/components/`: UI components including NostrProvider for Nostr integration
- `/src/hooks/`: Custom hooks including `useNostr` and `useNostrQuery`
- `/src/pages/`: Page components used by React Router
- `/src/lib/`: Utility functions and shared logic
- `/public/`: Static assets

## UI Components

The project uses shadcn/ui components located in `@/components/ui`. These are unstyled, accessible components built with Radix UI and styled with Tailwind CSS. Available components include:

- **Accordion**: Vertically collapsing content panels
- **Alert**: Displays important messages to users
- **AlertDialog**: Modal dialog for critical actions requiring confirmation
- **AspectRatio**: Maintains consistent width-to-height ratio
- **Avatar**: User profile pictures with fallback support
- **Badge**: Small status descriptors for UI elements
- **Breadcrumb**: Navigation aid showing current location in hierarchy
- **Button**: Customizable button with multiple variants and sizes
- **Calendar**: Date picker component
- **Card**: Container with header, content, and footer sections
- **Carousel**: Slideshow for cycling through elements
- **Chart**: Data visualization component
- **Checkbox**: Selectable input element
- **Collapsible**: Toggle for showing/hiding content
- **Command**: Command palette for keyboard-first interfaces
- **ContextMenu**: Right-click menu component
- **Dialog**: Modal window overlay
- **Drawer**: Side-sliding panel
- **DropdownMenu**: Menu that appears from a trigger element
- **Form**: Form validation and submission handling
- **HoverCard**: Card that appears when hovering over an element
- **InputOTP**: One-time password input field
- **Input**: Text input field
- **Label**: Accessible form labels
- **Menubar**: Horizontal menu with dropdowns
- **NavigationMenu**: Accessible navigation component
- **Pagination**: Controls for navigating between pages
- **Popover**: Floating content triggered by a button
- **Progress**: Progress indicator
- **RadioGroup**: Group of radio inputs
- **Resizable**: Resizable panels and interfaces
- **ScrollArea**: Scrollable container with custom scrollbars
- **Select**: Dropdown selection component
- **Separator**: Visual divider between content
- **Sheet**: Side-anchored dialog component
- **Sidebar**: Navigation sidebar component
- **Skeleton**: Loading placeholder
- **Slider**: Input for selecting a value from a range
- **Sonner**: Toast notification manager
- **Switch**: Toggle switch control
- **Table**: Data table with headers and rows
- **Tabs**: Tabbed interface component
- **Textarea**: Multi-line text input
- **Toast**: Toast notification component
- **ToggleGroup**: Group of toggle buttons
- **Toggle**: Two-state button
- **Tooltip**: Informational text that appears on hover

These components follow a consistent pattern using React's `forwardRef` and use the `cn()` utility for class name merging. Many are built on Radix UI primitives for accessibility and customized with Tailwind CSS.

## Nostr Protocol Integration

This project comes with custom hooks for querying and publishing events on the Nostr network.

### The `useNostr` Hook

The `useNostr` hook returns an object containing a `nostr` property, with `.query()` and `.event()` methods for querying and publishing Nostr events respectively.

```typescript
import { useNostr } from '@nostrify/react';

function useCustomHook() {
  const { nostr } = useNostr();

  // ...
}
```

### Nostr Event Kinds Constants

**Always use the centralized constants from `@/lib/nostr-kinds` instead of hardcoded literals when referencing Nostr event kinds.** This ensures consistency, maintainability, and prevents typos.

```typescript
import { KINDS } from '@/lib/nostr-kinds';

// ✅ Correct: Use constants
const events = await nostr.query([{ kinds: [KINDS.TEXT_NOTE], limit: 20 }], { signal });

// ❌ Wrong: Don't use hardcoded literals
const events = await nostr.query([{ kinds: [1], limit: 20 }], { signal });
```

### Query Nostr Data with `useNostr` and Tanstack Query

When querying Nostr, the best practice is to create custom hooks that combine `useNostr` and `useQuery` to get the required data.

```typescript
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/query';
import { KINDS } from '@/lib/nostr-kinds';

function usePosts() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['posts'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      const events = await nostr.query([{ kinds: [KINDS.TEXT_NOTE], limit: 20 }], { signal });
      return events; // these events could be transformed into another format
    },
  });
}
```

The data may be transformed into a more appropriate format if needed, and multiple calls to `nostr.query()` may be made in a single queryFn.

### The `useAuthor` Hook

To display profile data for a user by their Nostr pubkey (such as an event author), use the `useAuthor` hook.

```tsx
import { NostrEvent, NostrMetadata } from '@nostrify/nostrify';
import { useAuthor } from '@/hooks/useAuthor';

function Post({ event }: { event: NostrEvent }) {
  const author = useAuthor(event.pubkey);
  const metadata: NostrMetadata | undefined = author.data?.metadata;

  const displayName = metadata?.name || event.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;

  // ...render elements with this data
}
```

#### `NostrMetadata` type

```ts
/** Kind 0 metadata. */
interface NostrMetadata {
  /** A short description of the user. */
  about?: string;
  /** A URL to a wide (~1024x768) picture to be optionally displayed in the background of a profile screen. */
  banner?: string;
  /** A boolean to clarify that the content is entirely or partially the result of automation, such as with chatbots or newsfeeds. */
  bot?: boolean;
  /** An alternative, bigger name with richer characters than `name`. `name` should always be set regardless of the presence of `display_name` in the metadata. */
  display_name?: string;
  /** A bech32 lightning address according to NIP-57 and LNURL specifications. */
  lud06?: string;
  /** An email-like lightning address according to NIP-57 and LNURL specifications. */
  lud16?: string;
  /** A short name to be displayed for the user. */
  name?: string;
  /** An email-like Nostr address according to NIP-05. */
  nip05?: string;
  /** A URL to the user's avatar. */
  picture?: string;
  /** A web URL related in any way to the event author. */
  website?: string;
}
```

### The `useNostrPublish` Hook

To publish events, use the `useNostrPublish` hook in this project.

```tsx
import { useState } from 'react';
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { KINDS } from '@/lib/nostr-kinds';

export function MyComponent() {
  const [ data, setData] = useState<Record<string, string>>({});

  const { user } = useCurrentUser();
  const { mutate: createEvent } = useNostrPublish();

  const handleSubmit = () => {
    createEvent({ kind: KINDS.TEXT_NOTE, content: data.content });
  };

  if (!user) {
    return <span>You must be logged in to use this form.</span>;
  }

  return (
    <form onSubmit={handleSubmit} disabled={!user}>
      {/* ...some input fields */}
    </form>
  );
}
```

The `useCurrentUser` hook should be used to ensure that the user is logged in before they are able to publish Nostr events.

### Nostr Login

To enable login with Nostr, simply use the `LoginArea` component already included in this project.

```tsx
import { LoginArea } from "@/components/auth/LoginArea";

function MyComponent() {
  return (
    <div>
      {/* other components ... */}

      <LoginArea />
    </div>
  );
}
```

The `LoginArea` component displays a "Log in" button when the user is logged out, and changes to an account switcher once the user is logged in. It handles all the login-related UI and interactions internally, including displaying login dialogs and switching between accounts. It should not be wrapped in any conditional logic.

### `npub`, `naddr`, and other Nostr addresses

Nostr defines a set identifiers in NIP-19. Their prefixes:

- `npub`: public keys
- `nsec`: private keys
- `note`: note ids
- `nprofile`: a nostr profile
- `nevent`: a nostr event
- `naddr`: a nostr replaceable event coordinate
- `nrelay`: a nostr relay (deprecated)

NIP-19 identifiers include a prefix, the number "1", then a base32-encoded data string.

#### Use in Filters

The base Nostr protocol uses hex string identifiers when filtering by event IDs and pubkeys. Nostr filters only accept hex strings.

```ts
// ❌ Wrong: naddr is not decoded
const events = await nostr.query(
  [{ ids: [naddr] }],
  { signal }
);
```

Corrected example:

```ts
// Import nip19 from nostr-tools
import { nip19 } from 'nostr-tools';

// Decode a NIP-19 identifier
const decoded = nip19.decode(value);

// Optional: guard certain types (depending on the use-case)
if (decoded.type !== 'naddr') {
  throw new Error('Unsupported Nostr identifier');
}

// Get the addr object
const naddr = decoded.data;

// ✅ Correct: naddr is expanded into the correct filter
const events = await nostr.query(
  [{
    kinds: [naddr.kind],
    authors: [naddr.pubkey],
    '#d': [naddr.identifier],
  }],
  { signal }
);
```

### Nostr Edit Profile

To include an Edit Profile form, place the `EditProfileForm` component in the project:

```tsx
import { EditProfileForm } from "@/components/EditProfileForm";

function EditProfilePage() {
  return (
    <div>
      {/* you may want to wrap this in a layout or include other components depending on the project ... */}

      <EditProfileForm />
    </div>
  );
}
```

The `EditProfileForm` component displays just the form. It requires no props, and will "just work" automatically.

### Uploading Files on Nostr

Use the `useUploadFile` hook to upload files.

```tsx
import { useUploadFile } from "@/hooks/useUploadFile";

function MyComponent() {
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();

  const handleUpload = async (file: File) => {
    try {
      // Provides an array of NIP-94 compatible tags
      // The first tag in the array contains the URL
      const [[_, url]] = await uploadFile(file);
      // ...use the url
    } catch (error) {
      // ...handle errors
    }
  };

  // ...rest of component
}
```

To attach files to kind 1 events, each file's URL should be appended to the event's `content`, and an `imeta` tag should be added for each file. For kind 0 events, the URL by itself can be used in relevant fields of the JSON content.

### Nostr Encryption and Decryption

The logged-in user has a `signer` object (matching the NIP-07 signer interface) that can be used for encryption and decryption.

```ts
// Get the current user
const { user } = useCurrentUser();

// Optional guard to check that nip44 is available
if (!user.signer.nip44) {
  throw new Error("Please upgrade your signer extension to a version that supports NIP-44 encryption");
}

// Encrypt message to self
const encrypted = await user.signer.nip44.encrypt(user.pubkey, "hello world");
// Decrypt message to self
const decrypted = await user.signer.nip44.decrypt(user.pubkey, encrypted) // "hello world"
```

## Development Practices

- Uses React Query for data fetching and caching
- Follows shadcn/ui component patterns
- Implements Path Aliases with `@/` prefix for cleaner imports
- Uses Vite for fast development and production builds
- Component-based architecture with React hooks
- Default connection to multiple Nostr relays for network redundancy

## Build & Deployment

- Build for production: `npm run build`
- Development build: `npm run build:dev`

## Testing Your Changes

Whenever you modify code, you should test your changes after you're finished by running:

```bash
npm run ci
```

This command will typecheck the code and attempt to build it.

Your task is not considered finished until this test passes without errors.

# Chorus Project

Chorus is a Facebook-inspired groups platform built on the Nostr protocol using NIP-72 for moderated communities. This section provides specific information about the Chorus implementation.

## NIP-72 Implementation

Chorus implements [NIP-72](https://github.com/nostr-protocol/nips/blob/master/72.md), which defines a standard for moderated communities on Nostr, along with custom extensions documented in `NIP.md`. The implementation uses:

- **Kind 34550**: Community definition events that include community metadata and moderator lists
- **Kind 4550**: Post approval events that moderators use to approve posts
- **Kind 11**: Text note events used for posts within communities

**📋 IMPORTANT: This project extends NIP-72 with custom event kinds documented in `NIP.md`. When working with group functionality, always reference this specification and update it when making changes to event kinds or their usage patterns.**

## Key Features

- **Community Creation**: Users can create communities with custom names, descriptions, and images
- **Community Browsing**: Users can discover and join existing communities
- **Post Creation**: Users can create text and image posts within communities
- **Post Moderation**: Community moderators can approve or reject posts
- **Approved Users**: Communities can maintain lists of approved users whose posts are automatically approved
- **User Profiles**: Integration with Nostr profiles for user identity

## Project Components

### Pages

- **Index.tsx**: Landing page with introduction to the platform
- **Groups.tsx**: Main page listing all available communities
- **GroupDetail.tsx**: Detailed view of a specific community with posts and member information
- **CreateGroup.tsx**: Form for creating new communities

### Custom Components

- **CreatePostForm.tsx**: Component for creating posts within a community
- **PostList.tsx**: Component for displaying posts with approval status
- **ApprovedUsersList.tsx**: Component for managing approved users in a community

## Post Approval Flow

1. User creates a post in a community (kind 1 with community "a" tag)
2. If the user is in the approved users list, the post is automatically marked as approved
3. If not, a moderator must create a kind 4550 approval event referencing the post
4. The UI shows approved posts by default, with an option to view pending posts

## Approved Users System

The approved users system uses kind 30000 list events with:
- A "d" tag set to "approved-users" to identify the purpose of the list
- An "a" tag referencing the community
- "p" tags for each approved user's pubkey

Posts from approved users are automatically displayed in the community without requiring manual moderator approval.

## UI Features

- **Toggle for Approved Posts**: Users can toggle between seeing all posts or only approved posts
- **Visual Indicators**: Clear visual indicators for approved, auto-approved, and pending posts
- **Moderation Tools**: Moderators have access to tools for approving posts and managing approved users
- **Responsive Design**: Works on both desktop and mobile devices

## Group Event Tagging Patterns

This project follows NIP-72 and NIP-01 specifications for proper event tagging. **It is critical to understand the difference between addressable and regular events when working with group functionality.**

### Addressable Events (3455x kinds) - Use "d" tags for self-identification

These events are replaceable and use "d" tags to identify themselves:

- **Kind 34550** (`GROUP`): Community definition events
  - Use `["d", "community-identifier"]` to identify the community
  - Example: `["d", "bitcoin-discussion"]`

- **Kind 34551** (`GROUP_APPROVED_MEMBERS_LIST`): Approved members lists
  - Use `["d", communityId]` to identify which community this list belongs to
  - Example: `["d", "34550:pubkey:bitcoin-discussion"]`

- **Kind 34552** (`GROUP_DECLINED_MEMBERS_LIST`): Declined members lists
  - Use `["d", communityId]` to identify which community this list belongs to

- **Kind 34553** (`GROUP_BANNED_MEMBERS_LIST`): Banned members lists
  - Use `["d", communityId]` to identify which community this list belongs to

- **Kind 34554** (`GROUP_PINNED_POSTS_LIST`): Pinned posts lists
  - Use `["d", communityId]` to identify which community this list belongs to

- **Kind 34555** (`PINNED_GROUPS_LIST`): User's pinned groups list
  - Use `["d", "pinned-groups"]` to identify this as the user's pinned groups list
  - Use `["a", communityId]` tags to reference each pinned community

### Regular Events (455x kinds) - Use "a" tags to reference communities

These events are not replaceable and use "a" tags to reference the community they target:

- **Kind 4550** (`GROUP_POST_APPROVAL`): Post approval events
  - Use `["a", communityId]` to reference the target community
  - Example: `["a", "34550:pubkey:bitcoin-discussion"]`

- **Kind 4551** (`GROUP_POST_REMOVAL`): Post removal events
  - Use `["a", communityId]` to reference the target community

- **Kind 4552** (`GROUP_JOIN_REQUEST`): Join request events
  - Use `["a", communityId]` to reference the target community

- **Kind 4553** (`GROUP_LEAVE_REQUEST`): Leave request events
  - Use `["a", communityId]` to reference the target community

- **Kind 4554** (`GROUP_CLOSE_REPORT`): Close report events
  - Use `["a", communityId]` to reference the target community

### Querying Events

When querying events, use the appropriate filter:

```typescript
// ✅ Correct: Query addressable events by "d" tag
const approvedMembers = await nostr.query([{
  kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST],
  "#d": [communityId]
}], { signal });

// ✅ Correct: Query regular events by "a" tag
const approvals = await nostr.query([{
  kinds: [KINDS.GROUP_POST_APPROVAL],
  "#a": [communityId]
}], { signal });

// ❌ Wrong: Don't mix up the tag types
const wrongQuery = await nostr.query([{
  kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST],
  "#a": [communityId] // Wrong! Should be "#d"
}], { signal });
```

### Creating Events

When creating events, use the appropriate tag structure:

```typescript
// ✅ Correct: Create addressable event with "d" tag
await publishEvent({
  kind: KINDS.GROUP_APPROVED_MEMBERS_LIST,
  tags: [
    ["d", communityId], // Identifies which community this list belongs to
    ["p", userPubkey1],
    ["p", userPubkey2]
  ],
  content: ""
});

// ✅ Correct: Create regular event with "a" tag
await publishEvent({
  kind: KINDS.GROUP_POST_APPROVAL,
  tags: [
    ["a", communityId], // References the target community
    ["e", postId],
    ["p", authorPubkey],
    ["k", "1"]
  ],
  content: JSON.stringify(originalPost)
});
```

## Development Guidelines

When extending the Chorus platform:

1. Follow the established patterns for Nostr event creation and querying
2. Use the existing hooks for Nostr integration (`useNostr`, `useNostrPublish`, etc.)
3. Maintain the separation between community definition, post content, and moderation actions
4. Ensure proper error handling for network operations
5. Keep the UI consistent with the existing design language
6. Test all changes with `npm run ci` before considering them complete
7. Always use `for...of` instead of `forEach` in loops
8. **Always use constants from `@/lib/nostr-kinds` instead of hardcoded event kind literals**
9. **Follow the correct tagging patterns for addressable vs regular events as documented above**
10. **When adding new event kinds or modifying existing ones, update `NIP.md` to reflect the changes**
11. **Reference `NIP.md` for the complete specification of all custom event kinds used in this project**
