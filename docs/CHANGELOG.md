# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed
- Post approval button now visible when moderators view individual unapproved posts via direct link
- Improved error handling for invalid group ID formats (e.g., "protest.net" without full ID)
- Auto-disable "Show only approved posts" filter when moderator navigates to specific post

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **NIP-29 Group Images**: Completely fixed broken image display issues
  - Created new `GroupAvatar` component with proper fallback behavior
  - Added `SafeImage` component that pre-loads images to prevent broken image flash
  - Updated GroupDetail page to use SafeImage for the main group banner
  - Fixed issue where groups without images would still show broken image icon
  - Added placeholder SVG file for fallback display
  - Shows Lock icon for NIP-29 groups and Users icon for NIP-72 groups when image fails
  - Images are now tested before display, eliminating the broken image flash entirely
- **NIP-29 Relay Display**: Added relay server information to group UI
  - Shows relay hostname in group cards for better identification
  - Added relay display in group detail page header
  - Helps users understand which relay hosts their NIP-29 groups
- **NIP-29 Post Approval**: Removed "Show only approved posts" toggle for NIP-29 groups
  - NIP-29 groups use relay-enforced access control, not post approval
  - The toggle now only appears for NIP-72 groups where it's relevant
  - All posts in NIP-29 groups are shown if you have access to the group

### Changed
- **Project Structure Reorganization**: Cleaned up repository for better maintainability
  - Moved all documentation files to `/docs` directory
  - Removed temporary debugging scripts and fix utilities
  - Consolidated test configuration in `/test/test-config.json`
  - Removed backup files and temporary artifacts from version control
  - Maintained only essential configuration and source files in project root

### Added
- **Push Notification System**: Complete native Nostr push notification infrastructure
  - Cloudflare Worker for NIP-72 relay polling and monitoring group activity
  - Service worker for native browser push notification support
  - Push notification settings UI component in Settings page
  - Secure secret management for Cloudflare Worker deployment
  - KV storage integration for user state and notification tracking
  - Scheduled polling system (every 30 minutes) for new Nostr events
  - Health check and stats endpoints for monitoring worker status
  - Custom `usePushSubscription` hook for managing push subscriptions
  - Background sync for offline functionality
  - Notification click handling with deep linking to relevant content
  - **Live Deployment**: Worker deployed at https://nostr-nip72-poller.protestnet.workers.dev
  - **Repository Cleanup**: Removed all backup and temporary files (Git is our backup!)
  - **Security Hardened**: All credentials managed via Cloudflare secrets
  - **Production Ready**: Complete infrastructure with monitoring and health checks
- **PWA Builder Optimization**: Complete App Store readiness with comprehensive icon set
  - Generated missing iOS-specific icons (152×152, 167×167, 180×180, 1024×1024)
  - Enhanced manifest.json with complete icon definitions including maskable variants
  - Added PWA screenshots for app store listings (desktop and mobile)
  - Improved service worker with enhanced caching strategies
  - Expected PWA Builder score of 95%+ for seamless app store conversion
- **Enhanced PWA Utilities**: Advanced PWA detection and management
  - `usePWA` hook for centralized PWA state management
  - Improved PWA install banners and user experience
  - Better detection of PWA mode across different platforms
- **Balance Display**: Enhanced Cashu wallet UI components
- **Group Guidelines**: New group management and moderation features
- **User Nutzap Dialog**: Improved ecash tipping interface
- NIP-05 verification system for user identity verification
- Image display support in posts with automatic URL hiding for posts with images
- Favicon support for better branding
- Chorus relay integration for improved performance
- Restored community activity indicators showing post count and participant count on group cards
- Added loading states for community statistics while data is being fetched
- Enhanced visual presentation of community metrics with badge-style elements
- Added activity indicators to My Groups section showing post count and active participants

### Fixed
- **Member Display for All Group Types**: Complete fix for member lists across NIP-72 and NIP-29 groups
  - **NIP-72 Groups**: Fixed approved members query to use full a-tag format (`34550:pubkey:identifier`) in d-tag
  - **NIP-29 Groups**: Fixed routing logic to properly detect group type and route queries to correct relays
  - **Enhanced Routing**: Updated EnhancedNostrProvider to check both #d and #h tags for NIP-29 queries
  - **Smart Fallback**: Added useGroupPosters hook as fallback for groups without approved members lists
  - **Dual Query Strategy**: Tries simple identifier first, then full a-tag format for maximum compatibility
  - **Comprehensive Logging**: Added detailed debug logs for troubleshooting member queries
  - **UI Improvements**: Members now display correctly with proper counts and pagination
  - **Cross-Protocol Support**: Unified member display works seamlessly across both group protocols
- **Profile Sync on Login**: Added automatic profile (kind 0) synchronization
  - Checks primary relay for user's profile after login
  - Falls back to popular relays (purplepag.es, relay.nos.social, cache2.primal.net) if not found
  - Automatically republishes profile to primary relay for better availability
  - Ensures user profiles are always accessible on the chorus.community relay
