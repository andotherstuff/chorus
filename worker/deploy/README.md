# Cloudflare Worker Deployment

## Security Setup

**⚠️ NEVER commit wrangler.toml with real credentials to Git!**

### 1. Setup Configuration

1. Copy the template:
   ```bash
   cp wrangler.toml.template wrangler.toml
   ```

2. Edit wrangler.toml with your real values:
   - Set `account_id` to your Cloudflare account ID
   - Set `id` and `preview_id` for KV namespaces

### 2. Set Secrets (Recommended)

Use Wrangler secrets instead of vars for sensitive data:

```bash
# Set bot token as secret (not in wrangler.toml)
wrangler secret put BOT_TOKEN

# Set any API keys as secrets
wrangler secret put PUSH_API_KEY
```

### 3. Deploy

```bash
wrangler deploy
```

## KV Namespaces

Create KV namespaces:

```bash
# Production
wrangler kv:namespace create "notifications-store"

# Preview  
wrangler kv:namespace create "notifications-store" --preview
```

## Environment Variables

Safe to commit:
- RELAY_URL
- PUSH_DISPATCH_API (if public endpoint)

Use secrets for:
- BOT_TOKEN
- API keys
- Private endpoints
