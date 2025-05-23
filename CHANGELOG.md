# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- NIP-05 verification system for user identity verification
- Image display support in posts with automatic URL hiding for posts with images
- Favicon support for better branding
- Chorus relay integration for improved performance
- Restored community activity indicators showing post count and participant count on group cards
- Added loading states for community statistics while data is being fetched
- Enhanced visual presentation of community metrics with badge-style elements
- Added activity indicators to My Groups section showing post count and active participants

### Fixed
- Fixed NIP-07 browser extension login recognition issue by adding fallback mechanism in useCurrentUser hook
- Enhanced EditProfileForm to preserve all existing metadata fields when updating profile, preventing loss of profile data like about, banner, nip05, lud16, website, etc. when using the minimal edit interface
- Fixed DOM nesting validation warnings in MyGroupCard component by replacing div elements with span elements inside CardDescription
- Various notification wording improvements and fixes
- Removed unnecessary "view details" links where not applicable
- Resolved merge conflicts in LoginArea and Groups components
- Fixed TypeScript errors in LoginArea component preventing build
- Restored missing activity indicators that were lost during merge

### Changed
- Switched default relay to Chorus for better reliability
- Group cards now display focused activity metrics (posts and participants)
- Improved UI consistency for community statistics with proper loading states
- Enhanced My Groups display with consistent activity metrics across all group views
- Removed moderator count badge to focus on activity metrics

## [0.1.0] - 2025-01-21

### Added
- **Core NIP-72 Groups Implementation**
  - Basic Nostr group creation and management
  - Group moderation system with role-based permissions
  - Post approval system for moderators
  - Member management (approve, decline, ban users)
  - Group search functionality with filtering
  - Pin/unpin groups to "My Groups" section

- **User Authentication & Profiles**
  - Multiple login methods (browser extension, nsec key, bunker URI)
  - Account switching and management
  - User profile pages with group memberships
  - Follow/unfollow functionality
  - Profile editing and setup

- **Content & Interaction Features**
  - Post creation and display in groups
  - Threaded replies system with moderation
  - Like/reaction system for posts
  - Image support in posts
  - Notifications system for group activities

- **Moderation Tools**
  - Pending posts/replies approval system
  - User banning and unbanning
  - Moderator promotion and demotion
  - Protected events and privacy controls

- **UI/UX Enhancements**
  - Responsive design with mobile optimization
  - Dark mode support with system theme detection
  - Skeleton loading states
  - Toast notifications for user feedback
  - Consistent header and navigation
  - Group role badges and indicators

- **Technical Features**
  - Cashu wallet integration
  - Automatic approval for approved members
  - Performance optimizations for membership fetching
  - Test CI pipeline
  - TypeScript support throughout

### Changed
- Terminology from "community" to "group" for consistency
- Simplified onboarding flow with profile setup
- Improved group list styling and layout
- Enhanced notification system with group tags
- Replaced hardcoded reaction counts with real Nostr event data
- Updated to use Nostr kind 11 for certain events

### Fixed
- Login/logout functionality issues
- TypeScript errors throughout the codebase
- Group membership display and fetching
- Reply moderation and threading
- Approved replies showing as top-level posts
- Performance issues with large member lists
- Various UI consistency and spacing issues

### Development
- Added vibe-tools for AI-assisted development
- Implemented comprehensive testing framework
- Set up proper CI/CD pipeline
- Added repomix configuration for code analysis
- Established consistent code organization

---

## Project Overview

This project is a decentralized social application built on the Nostr protocol, specifically implementing NIP-72 moderated groups. It allows users to create and participate in moderated communities with various roles and permissions.

### Technology Stack
- **Frontend**: React 18, TypeScript, TailwindCSS
- **Build Tool**: Vite
- **UI Components**: shadcn/ui (Radix UI + Tailwind)
- **Protocol**: Nostr (specifically NIP-72 for groups)
- **State Management**: TanStack Query
- **Routing**: React Router

### Key Features
- Decentralized group management
- Role-based moderation system
- Multi-method authentication
- Real-time notifications
- Mobile-responsive design
- Dark mode support
- Image sharing capabilities
