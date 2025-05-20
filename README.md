# NostrGroups - A NIP-72 Groups Platform

A Facebook-inspired groups platform built on the Nostr protocol using NIP-72 for moderated communities.

## Features

- **Browse Communities**: Discover and join communities created by other users
- **Create Communities**: Start your own community with custom name, description, and image
- **Post to Communities**: Share text and images with community members
- **Moderation**: Community creators can approve posts and manage their communities
- **User Profiles**: View user profiles and their activity
- **Responsive Design**: Works on desktop and mobile devices
- **Community Activity Indicators**: Visual indicators showing community activity levels

## Technology Stack

- **React 18.x**: Modern React with hooks and functional components
- **TailwindCSS 3.x**: Utility-first CSS framework for styling
- **Vite**: Fast build tool and development server
- **shadcn/ui**: Unstyled, accessible UI components built with Radix UI
- **Nostrify**: Nostr protocol framework for web
- **React Router**: Client-side routing
- **TanStack Query**: Data fetching and state management
- **TypeScript**: Type-safe JavaScript development

## Nostr Protocol Integration

This application implements NIP-72 for moderated communities:

- **Kind 34550**: Community definition events
- **Kind 4550**: Post approval events
- **Kind 30000**: Custom list events used for approved users lists
- **Kind 1**: Standard text note events (posts)

## Project Structure

- `/src/components/`: UI components including NostrProvider for Nostr integration
- `/src/hooks/`: Custom hooks including useNostr and useNostrQuery
- `/src/pages/`: Page components used by React Router
- `/src/lib/`: Utility functions and shared logic
- `/public/`: Static assets

## Development Commands

Start the development server on port 8080:

```bash
npm run dev
```

Typecheck the code and validate build:

```bash
npm run ci
```

Run linting:

```bash
npm run lint
```

## Building for Production

```bash
npm run build
```

Build for development:

```bash
npm run build:dev
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

## Post Approval Flow

1. User creates a post in a community (kind 1 with community "a" tag)
2. If the user is in the approved users list, the post is automatically marked as approved
3. If not, a moderator must create a kind 4550 approval event referencing the post
4. The UI shows approved posts by default, with an option to view pending posts

## License

MIT