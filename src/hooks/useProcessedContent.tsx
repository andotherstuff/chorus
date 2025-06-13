// ABOUTME: Custom hook that processes Nostr event content into structured data
// ABOUTME: Extracts text, images, videos, audio, and links from event content and tags

import { useState, useEffect, useCallback } from 'react';
import type { NostrEvent } from '@nostrify/nostrify';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useAuthor } from '@/hooks/useAuthor';
import { useExtractUrls } from '@/hooks/useExtractUrls';

// Constants for media detection
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|bmp|tiff|avif|heic)(\?\S*)?$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg|mov|avi|mkv|m4v|3gp)(\?\S*)?$/i;
const AUDIO_EXTENSIONS = /\.(mp3|wav|flac|m4a|aac|opus|oga|wma)(\?\S*)?$/i;

// Image hosting service patterns
const IMAGE_HOST_REGEX = /https?:\/\/(i\.imgur\.com|imgur\.com\/[a-zA-Z0-9]+|pbs\.twimg\.com|i\.ibb\.co|nostr\.build|void\.cat\/d\/|imgproxy\.snort\.social|image\.nostr\.build|media\.tenor\.com|cloudflare-ipfs\.com\/ipfs\/|ipfs\.io\/ipfs\/|files\.zaps\.lol|img\.zaps\.lol|primal\.b-cdn\.net|cdn\.nostr\.build|nitter\.net\/pic|postimages\.org|ibb\.co|cdn\.discordapp\.com\/attachments)\S+/gi;

// Patterns to skip for link previews
const SKIP_LINK_PREVIEW_PATTERNS = [
  'api.', 'data:', '.json', '.csv', '.pdf', '.xml', 
  'localhost', '127.0.0.1', 'blockstream.info'
];

interface ProcessedContent {
  textParts: React.ReactNode[];
  imageUrls: string[];
  videoUrls: string[];
  audioUrls: string[];
  linkUrl: string | null;
  hasTextContent: boolean;
}

interface MatchPosition {
  index: number;
  length: number;
  node: React.ReactNode | null;
}

// Helper component for Nostr mentions
function NostrMention({ pubkey }: { pubkey: string }) {
  const author = useAuthor(pubkey);
  const displayName = author.data?.metadata?.name || pubkey.slice(0, 8);

  return (
    <Link
      to={`/p/${pubkey}`}
      className="font-medium text-blue-500 hover:underline"
    >
      @{displayName}
    </Link>
  );
}

export function useProcessedContent(event: NostrEvent | undefined): ProcessedContent {
  const [processedContent, setProcessedContent] = useState<React.ReactNode[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const { getFirstUrl } = useExtractUrls();

  // Extract media URLs from event tags and content
  const extractMediaUrls = useCallback((event: NostrEvent) => {
    const extractedImages: string[] = [];
    const extractedVideos: string[] = [];
    const extractedAudios: string[] = [];

    // Create a map of URLs to their MIME types from tags
    const urlMimeTypes: Record<string, string> = {};
    
    // First, find all URLs in tags
    const urlsInTags: string[] = [];
    event.tags.forEach(tag => {
      if (tag[0] === 'url' && tag[1]) {
        urlsInTags.push(tag[1]);
      }
    });
    
    // Then find 'm' tags and associate them with URLs
    event.tags.forEach(tag => {
      if (tag[0] === 'm' && tag[1]) {
        urlsInTags.forEach(url => {
          urlMimeTypes[url] = tag[1];
        });
      }
    });

    // 1. Extract images from tags
    const tagImages = event.tags
      .filter(tag => ['image', 'img', 'media'].includes(tag[0]) && tag[1]?.startsWith('http'))
      .map(tag => tag[1]);

    // 2. Extract images from imeta tags
    const imetaImages = event.tags
      .filter(tag => tag[0] === 'imeta' && tag.length > 1 && tag[1]?.startsWith('http'))
      .map(tag => tag[1]);

    // Add all tag-based images
    extractedImages.push(...tagImages, ...imetaImages);

    // 3. Extract media from content URLs
    if (event.content) {
      const urlRegex = /https?:\/\/[^\s]+/gi;
      let match;
      const contentUrls: string[] = [];
      
      while ((match = urlRegex.exec(event.content)) !== null) {
        contentUrls.push(match[0]);
      }
      
      // Process each URL
      contentUrls.forEach(url => {
        const mimeType = urlMimeTypes[url];
        
        if (mimeType) {
          // Use the mime type from the tag
          if (mimeType.startsWith('audio/')) {
            extractedAudios.push(url);
          } else if (mimeType.startsWith('video/')) {
            extractedVideos.push(url);
          } else if (mimeType.startsWith('image/')) {
            if (!extractedImages.includes(url)) {
              extractedImages.push(url);
            }
          }
        } else {
          // Fall back to file extension matching
          if (IMAGE_EXTENSIONS.test(url)) {
            if (!extractedImages.includes(url)) {
              extractedImages.push(url);
            }
          } else if (VIDEO_EXTENSIONS.test(url)) {
            extractedVideos.push(url);
          } else if (AUDIO_EXTENSIONS.test(url)) {
            extractedAudios.push(url);
          }
        }
      });

      // Match URLs from common image hosting services
      IMAGE_HOST_REGEX.lastIndex = 0;
      while ((match = IMAGE_HOST_REGEX.exec(event.content)) !== null) {
        if (!extractedImages.includes(match[0])) {
          extractedImages.push(match[0]);
        }
      }
    }

    return {
      images: extractedImages,
      videos: extractedVideos,
      audios: extractedAudios
    };
  }, []);

  // Check if URL should have link preview
  const shouldCreateLinkPreview = useCallback((url: string, allMediaUrls: string[]): boolean => {
    // Skip preview if the URL is already displayed as media
    if (allMediaUrls.includes(url)) return false;
    
    // Skip if it matches any of the patterns
    if (SKIP_LINK_PREVIEW_PATTERNS.some(pattern => url.includes(pattern))) return false;
    
    return true;
  }, []);

  // Process text content with links, mentions, hashtags
  const processTextContent = useCallback((
    text: string, 
    currentImageUrls: string[], 
    currentVideoUrls: string[], 
    currentAudioUrls: string[], 
    currentLinkUrl: string | null
  ) => {
    // Regular expressions for different patterns
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const nostrRegex = /nostr:(npub1|note1|nprofile1|nevent1)([a-z0-9]+)/g;
    const hashtagRegex = /#(\w+)/g;

    const parts: React.ReactNode[] = [];

    // Helper function to process matches
    const processMatches = (regex: RegExp, processor: (match: RegExpExecArray) => React.ReactNode | null) => {
      regex.lastIndex = 0;
      let match;
      const matchPositions: MatchPosition[] = [];

      while ((match = regex.exec(text)) !== null) {
        const node = processor(match);
        matchPositions.push({
          index: match.index,
          length: match[0].length,
          node
        });
      }

      return matchPositions;
    };

    // Process URLs
    const urlMatches = processMatches(urlRegex, (match) => {
      const url = match[0];

      // Check if this URL should be hidden (displayed as media or link preview)
      const isHidden = currentImageUrls.includes(url) || 
                      currentVideoUrls.includes(url) || 
                      currentAudioUrls.includes(url) || 
                      currentLinkUrl === url;

      if (isHidden) {
        return null; // Hide URLs that will be displayed separately
      }

      return (
        <a
          key={`url-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          {url}
        </a>
      );
    });

    // Process Nostr references
    const nostrMatches = processMatches(nostrRegex, (match) => {
      const prefix = match[1];
      const datastring = match[2];
      const nostrId = `${prefix}${datastring}`;

      try {
        const decoded = nip19.decode(nostrId);

        if (decoded.type === 'npub') {
          const pubkey = decoded.data as string;
          return <NostrMention key={`mention-${match.index}`} pubkey={pubkey} />;
        } else if (decoded.type === 'note') {
          return (
            <Link
              key={`note-${match.index}`}
              to={`/e/${nostrId}`}
              className="text-blue-500 hover:underline"
            >
              note
            </Link>
          );
        } else {
          return (
            <Link
              key={`nostr-${match.index}`}
              to={`https://njump.me/${nostrId}`}
              className="text-blue-500 hover:underline"
            >
              {match[0]}
            </Link>
          );
        }
      } catch {
        return match[0];
      }
    });

    // Process hashtags
    const hashtagMatches = processMatches(hashtagRegex, (match) => {
      const tag = match[1];
      return (
        <Link
          key={`hashtag-${match.index}`}
          to={`/t/${tag}`}
          className="text-blue-500 hover:underline"
        >
          #{tag}
        </Link>
      );
    });

    // Combine all matches and sort by position
    const allMatches = [...urlMatches, ...nostrMatches, ...hashtagMatches]
      .sort((a, b) => a.index - b.index);

    // Build the final content
    if (allMatches.length === 0) {
      parts.push(text);
    } else {
      let lastIndex = 0;
      
      for (const match of allMatches) {
        // Add text before this match
        if (match.index > lastIndex) {
          parts.push(text.substring(lastIndex, match.index));
        }

        // Add the special content if it's not null
        if (match.node !== null) {
          parts.push(match.node);
        }

        lastIndex = match.index + match.length;
      }

      // Add any remaining text
      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
      }
    }

    return parts;
  }, []);

  // Main processing effect
  useEffect(() => {
    if (!event) {
      setProcessedContent([]);
      setImageUrls([]);
      setVideoUrls([]);
      setAudioUrls([]);
      setLinkUrl(null);
      return;
    }

    // Extract media URLs
    const { images, videos, audios } = extractMediaUrls(event);
    
    setImageUrls(images);
    setVideoUrls(videos);
    setAudioUrls(audios);

    // Process text content
    if (event.content) {
      const allMediaUrls = [...images, ...videos, ...audios];
      const firstUrl = getFirstUrl(event.content);
      
      const determinedLinkUrl = firstUrl && shouldCreateLinkPreview(firstUrl, allMediaUrls) ? firstUrl : null;
      
      const processed = processTextContent(event.content, images, videos, audios, determinedLinkUrl);
      setProcessedContent(processed);
      setLinkUrl(determinedLinkUrl);
    } else {
      setProcessedContent([]);
      setLinkUrl(null);
    }
  }, [event, getFirstUrl, extractMediaUrls, processTextContent, shouldCreateLinkPreview]);

  // Check if there's meaningful text content
  const hasTextContent = processedContent.some(part => 
    typeof part === 'string' ? part.trim().length > 0 : true
  );

  return {
    textParts: processedContent,
    imageUrls,
    videoUrls,
    audioUrls,
    linkUrl,
    hasTextContent
  };
}