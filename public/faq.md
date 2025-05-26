# Frequently Asked Questions

## What is +chorus?

+chorus is a simple, decentralized space for communities to gather, share, and grow — built by the team at [And Other Stuff (AOS)](https://andotherstuff.org/) on the open [Nostr](https://github.com/nostr-protocol/nostr) protocol.

**You can use +chorus to create or join groups, post freely, and connect with others** — without handing over your personal data or relying on big tech.

Whether you're organizing a movement or supporting one, +chorus gives you the tools to do it on your terms.

**And, you can fuel your community with more than words.** Support the people and projects you care about securely and instantly, without leaving the app or adding a credit card.

With +chorus, we give you the keys. You drive the conversation — and the economy around it.

## How can I send or receive funds through +chorus?

+chorus makes it easy to support the people and projects you care about — and just as easy to receive support for your own work.

You can send small, instant eCash payments to show appreciation, fund ideas, or back a cause. These payments are powered by a privacy-first system called [Cashu](https://cashu.space).

If you're sharing your voice, leading a community, or building something meaningful, others can support you directly — right in the conversation.

## Do I need a wallet to send or receive payments?

No wallet? No problem. Click on your screen name in the top-right corner and select **Wallet** to set up eCash. With one click, we will have you ready to send and receive funds.

## Do I need to create an account?

Nope. There are no accounts to create. +chorus uses cryptographic key pairs instead of usernames and passwords.

This means **you control your identity** — no company owns your login.

## What is a cryptographic key?

A cryptographic key is a string of characters used to secure your identity and content. Think of it like a master password that proves who you are and allows you to post, sign messages, and access your communities.

- Your **public key** is like your username — others can see it. It usually starts with `npub…`
- Your **private key** must be kept secret — it's what proves you're really you. It usually starts with `nsec…`

**If someone else gets your private key, they can act as you forever — so keep it safe.**

## Can I delete my +chorus account?

There's no traditional account to delete. Your identity on +chorus is tied to a cryptographic key.

If you want to stop using +chorus:

- You can remove your key from your browser, extension, or device.
- If you used a temporary key, just stop using it.

Your content may also disappear over time if the relays you used remove old data — but this depends on each relay's policy and isn't guaranteed.

## Is +chorus private?

+chorus doesn't track you or collect personal data. You don't need an email, phone number, or name to join or post. You can use a pseudonym or stay anonymous.

However, Nostr is a public protocol — so unless you're using encrypted direct messages or private groups (which are not currently supported in +chorus), your posts are visible to anyone using a compatible app.

**Always be thoughtful about what you share.**

## Is +chorus secure?

+chorus is designed with security by default. But because you control your keys, some of the responsibility lies with you.

- Your identity is tied to your **private key** (the one that starts with `nsec…`). Keep it safe and never share it.
- If someone else gets your private key, they can impersonate you — permanently.
- To protect your key, you can use tools like [Alby](https://getalby.com/) to log in without exposing it directly.

## Who can see what I post?

+chorus groups are public communities meaning anyone using +chorus or another Nostr app can see your content.

Posts are stored on public relays. +chorus helps you create and manage posts and communities — it doesn't control what's stored or shared.

## Can I remove something I posted?

You can request that relays delete your content. However, because the protocol is decentralized, content can persist if relays or users choose to keep it.

## How can I access +chorus?

+chorus is a browser-based app designed with mobile use in mind. No app store required — just visit the site on your phone and save to your homescreen for quick access.

## What if I'm new to Nostr?

That's totally cool. +chorus is designed for people who have never used Nostr before. If you have a Nostr key, you can use it. If not, you can generate one in seconds.

## How can I check out the technical details?

+chorus is an open-source project built on several key technologies:

**Nostr Protocol Integration**
- Implements [NIP-72](https://github.com/nostr-protocol/nips/blob/master/72.md) for moderated communities
- Uses [NIP-60](https://github.com/nostr-protocol/nips/blob/master/60.md) for Cashu wallet integration
- Supports [NIP-57](https://github.com/nostr-protocol/nips/blob/master/57.md) for Lightning zaps
- Implements [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md) for encrypted payloads

**Cashu Integration**
- Built-in Cashu wallet for instant eCash payments
- Support for multiple Cashu mints
- Private, non-custodial transactions
- Encrypted transaction history
- Automatic wallet configuration via Nostr events

**Technical Stack**
- React 18.x with TypeScript
- TailwindCSS 3.x for styling
- Vite for fast development
- shadcn/ui for accessible components
- TanStack Query for data management

You can explore our code, design decisions, and documentation on [GitHub](https://github.com/andotherstuff/chorus).

## Something isn't working — how can I get help?

Feel free to ask in our [+chorus group](https://chorus.community/group/34550%3A932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d%3Aand-other-stuff-mb3c9stb), visit our [GitHub](https://github.com/andotherstuff), or check out our [website](https://andotherstuff.org). We welcome your questions, feedback, ideas, contributions, and [bug reports](https://github.com/andotherstuff/chorus/issues/new).
