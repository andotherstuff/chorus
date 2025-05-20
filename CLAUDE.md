# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project Overview

NostrGroups is a Nostr client application built with React 18.x, TailwindCSS 3.x, Vite, shadcn/ui, and Nostrify. It implements a Facebook-inspired groups platform using NIP-72 for moderated communities.

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

# Essential Development Commands

## Development Server

Start the development server on port 8080:

```bash
npm run dev
```

## Building the Application

Build for production (includes copying index.html to 404.html for SPA routing):

```bash
npm run build
```

Build for development:

```bash
npm run build:dev
```

## Testing and Validation

Typecheck the code and validate build:

```bash
npm run ci
```

This command must pass without errors for any changes to be considered complete.

Run linting:

```bash
npm run lint
```

Preview the built application:

```bash
npm run preview
```

## Deployment

Deploy the application to Surge:

```bash
npm run deploy
```

# Nostr Protocol Integration

This project implements NIP-72 for moderated communities on Nostr.

## Key Event Types

- **Kind 34550**: Community definition events that include community metadata and moderator lists
- **Kind 4550**: Post approval events that moderators use to approve posts 
- **Kind 30000**: Custom list events used for approved users lists
- **Kind 1**: Standard text note events used for posts within communities

## Custom Hooks

### The `useNostr` Hook

The `useNostr` hook returns an object containing a `nostr` property, with `.query()` and `.event()` methods for querying and publishing Nostr events respectively.

```typescript
import { useNostr } from '@nostrify/react';

function useCustomHook() {
  const { nostr } = useNostr();

  // ...
}
```

### Query Nostr Data with `useNostr` and Tanstack Query

When querying Nostr, the best practice is to create custom hooks that combine `useNostr` and `useQuery` to get the required data.

```typescript
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/query';

function usePosts() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['posts'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      const events = await nostr.query([{ kinds: [1], limit: 20 }], { signal });
      return events; // these events could be transformed into another format
    },
  });
}
```

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

### The `useNostrPublish` Hook

To publish events, use the `useNostrPublish` hook in this project.

```tsx
import { useState } from 'react';

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from '@/hooks/useNostrPublish';

export function MyComponent() {
  const [ data, setData] = useState<Record<string, string>>({});

  const { user } = useCurrentUser();
  const { mutate: createEvent } = useNostrPublish();

  const handleSubmit = () => {
    createEvent({ kind: 1, content: data.content });
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

### File Uploads with `useUploadFile`

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

# Authentication and User Management

## Nostr Login

To enable login with Nostr, use the `LoginArea` component:

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

The `LoginArea` component displays a "Log in" button when the user is logged out, and changes to an account switcher once the user is logged in. It should not be wrapped in conditional logic.

## Profile Management

To include an Edit Profile form, use the `EditProfileForm` component:

```tsx
import { EditProfileForm } from "@/components/EditProfileForm";

function EditProfilePage() {
  return (
    <div>
      <EditProfileForm />
    </div>
  );
}
```

# Working with Nostr Identifiers

## NIP-19 Identifiers

When working with Nostr identifiers, be aware of the different formats:

- `npub`: public keys
- `nsec`: private keys
- `note`: note ids
- `nprofile`: a nostr profile
- `nevent`: a nostr event
- `naddr`: a nostr replaceable event coordinate

Always decode NIP-19 identifiers before using them in filters:

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

// Use decoded values in filters
const events = await nostr.query(
  [{
    kinds: [naddr.kind],
    authors: [naddr.pubkey],
    '#d': [naddr.identifier],
  }],
  { signal }
);
```

# NostrGroups Post Approval Flow

1. User creates a post in a community (kind 1 with community "a" tag)
2. If the user is in the approved users list, the post is automatically marked as approved
3. If not, a moderator must create a kind 4550 approval event referencing the post
4. The UI shows approved posts by default, with an option to view pending posts

# Architecture Patterns

- Use the shadcn/ui component patterns for UI components
- Use the path alias `@/` for imports from the src directory
- Follow React Query patterns for data fetching and caching
- Implement custom hooks that wrap Nostr functionality
- Use React Router for navigation between pages
- Rely on the Nostr protocol for data storage and retrieval