# +chorus - Grow and give back to the communities that matter to you

+chorus is a simple space for communities to gather, share, and support each other. It is built on the decentralized Nostr protocol.

## Key Features

- **Create & Curate Communities**: Start your own space with a custom name, image, and description — and moderate it your way
- **Browse & Join Groups**: Discover and participate in public communities that match your interests
- **Post Freely**: Share notes and images with your groups via the [Nostr protocol](https://github.com/nostr-protocol)
- **Built-in Payments to Give & Get Support**: Contribute to the communities you care about or receive support for your work using simple, privacy-respecting payments powered by [Cashu](https://cashu.space)
- **Pseudonymous Profiles**: Find like-minded people and follow their work—without sharing more than you want to
- **Lightweight & On-the-Go Design**: Mobile-first, browser-based for use on any smartphone

### Content & Interaction
- **Rich Posts**: Share text and images with your community
- **Threaded Replies**: Engage in meaningful discussions with nested replies
- **Reactions**: React to posts with customizable emojis
- **Notifications**: Stay updated with community activities

### Privacy & Security
- **Pseudonymous**: Use any Nostr key for identity
- **Decentralized**: No central authority controls your data
- **User-Moderated**: Communities are managed by their members
- **Claim Your Handle**: Link your profile to a human-readable handle (like an email or domain)

### Built-in Payments & Support
- **Cashu Integration**: Native support for the [Cashu](https://cashu.space/) protocol
- **Community Funding**: Crowdfund causes through community-driven micropayments
- **Support Creators**: Pay fellow contributors and reward organizers
- **Receive Support**: Get funded for your work, activism, or ideas
- **Bitcoin Payments**: All payments powered by Bitcoin
- **Privacy-Focused**: Private, non-custodial payments
- **Instant Transfers**: Fast, lightweight transactions
- **Multiple Mints**: Support for various Cashu mints

## Supported Nostr Event Kinds

### Core Protocol
- Kind 0: User metadata/profile
- Kind 1: Text note
- Kind 3: Follow list
- Kind 5: Deletion
- Kind 7: Reaction
- Kind 9735: Zap
- Kind 1984: Report

### Groups
- Kind 11: Post in a group
- Kind 1111: Reply to group posts
- Kind 34550: Community definition
- Kind 4550: Post approval
- Kind 4551: Post removal
- Kind 4552: Join request
- Kind 4553: Leave request
- Kind 4554: Close report
- Kind 34551: Approved members list
- Kind 34552: Declined members list
- Kind 34553: Banned members list
- Kind 34554: Pinned posts list
- Kind 34555: Pinned groups list


## Getting Started

1. **Visit the Site**: Open [chorus.community](https://chorus.community) in your browser
2. **Create an Account**: Use any Nostr key or generate a new one
3. **Join Communities**: Browse and join groups that interest you
4. **Start Contributing**: Create posts, reply to others, and engage with your communities
5. **Set Up Payments**: Configure your Cashu wallet to start supporting others

## Development

### Technology Stack
- **Frontend**: React 18.x with TypeScript
- **Styling**: TailwindCSS 3.x
- **Build Tool**: Vite
- **UI Components**: shadcn/ui (Radix UI + Tailwind)
- **State Management**: TanStack Query
- **Routing**: React Router

### Local Development
```bash
# Clone the repository
git clone https://github.com/andotherstuff/chorus.git

# Start development server
npm run dev

# Build for production
npm run build
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- [Website](https://chorus.community)
- [GitHub](https://github.com/andotherstuff/chorus)
- [+chorus Group](https://chorus.community/group/34550%3A932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d%3Aand-other-stuff-mb3c9stb)
- [Bug Reports](https://github.com/andotherstuff/chorus/issues/new)
