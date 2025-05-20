# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Enhanced community cards in Groups page to display post count and participant count
- Added loading indicators for community statistics
- Improved visual presentation of community metrics with badge-like elements

### Changed
- Replaced moderator count with more meaningful activity metrics (posts and participants)
- Updated LoginArea component to fix TypeScript errors
- Improved UI for community statistics with better visual hierarchy

### Fixed
- Fixed TypeScript errors in the LoginArea component
- Fixed build issues related to the Nostr login implementation
- Fixed TypeScript errors for post.reactions property in PostList component
- Improved reaction count display with proper null/undefined checks