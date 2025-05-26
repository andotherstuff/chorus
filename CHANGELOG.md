# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- **Profile Sync on Login**: Added automatic profile (kind 0) synchronization
  - Checks primary relay for user's profile after login
  - Falls back to popular relays (purplepag.es, relay.nos.social, cache2.primal.net) if not found
  - Automatically republishes profile to primary relay for better availability
  - Ensures user profiles are always accessible on the chorus.community relay
