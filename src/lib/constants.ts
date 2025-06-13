// ABOUTME: Application-wide constants for media detection and URL patterns
// ABOUTME: Centralizes configuration for easy maintenance and reusability

// Image hosting service domains and patterns
export const IMAGE_HOST_DOMAINS = [
  'i\\.imgur\\.com',
  'imgur\\.com/[a-zA-Z0-9]+',
  'pbs\\.twimg\\.com',
  'i\\.ibb\\.co',
  'nostr\\.build',
  'void\\.cat/d/',
  'imgproxy\\.snort\\.social',
  'image\\.nostr\\.build',
  'media\\.tenor\\.com',
  'cloudflare-ipfs\\.com/ipfs/',
  'ipfs\\.io/ipfs/',
  'files\\.zaps\\.lol',
  'img\\.zaps\\.lol',
  'primal\\.b-cdn\\.net',
  'cdn\\.nostr\\.build',
  'nitter\\.net/pic',
  'postimages\\.org',
  'ibb\\.co',
  'cdn\\.discordapp\\.com/attachments'
] as const;

// Compiled regex for image hosting services
export const IMAGE_HOST_REGEX = new RegExp(
  `https?://(${IMAGE_HOST_DOMAINS.join('|')})\\S+`,
  'gi'
);

// File extension patterns for media detection
export const MEDIA_EXTENSIONS = {
  IMAGE: /\.(jpg|jpeg|png|gif|webp|bmp|tiff|avif|heic)(\?\S*)?$/i,
  VIDEO: /\.(mp4|webm|ogg|mov|avi|mkv|m4v|3gp)(\?\S*)?$/i,
  AUDIO: /\.(mp3|wav|flac|m4a|aac|opus|oga|wma)(\?\S*)?$/i,
} as const;

// URL patterns to skip for link previews
export const SKIP_LINK_PREVIEW_PATTERNS = [
  'api.',
  'data:',
  '.json',
  '.csv',
  '.pdf',
  '.xml',
  'localhost',
  '127.0.0.1',
  'blockstream.info'
] as const;