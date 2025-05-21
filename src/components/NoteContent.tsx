import { useState, useEffect } from 'react';
import { type NostrEvent } from '@nostrify/nostrify';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useAuthor } from '@/hooks/useAuthor';
import { cn } from '@/lib/utils';
import { PostImage } from '@/components/PostImage';
import { DebugImageDisplay } from '@/components/DebugImageDisplay';
import { DirectImageDisplay } from '@/components/DirectImageDisplay';
import { LinkPreview } from '@/components/LinkPreview';
import { useExtractUrls } from '@/hooks/useExtractUrls';
import { DEBUG_IMAGES } from '@/lib/debug';

interface NoteContentProps {
  event: NostrEvent;
  className?: string;
}

export function NoteContent({ 
  event, 
  className, 
}: NoteContentProps) {
  const [processedContent, setProcessedContent] = useState<React.ReactNode[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const { getFirstUrl } = useExtractUrls();
  
  // Process the content to extract text, images, and links
  useEffect(() => {
    if (!event) return;
    
    // Extract images from content
    const extractedImages: string[] = [];
    
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
    
    // 3. Extract images from content
    if (event.content) {
      // Match image URLs with common extensions
      const imageExtensionRegex = /https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|bmp|tiff|avif|heic)(\?\S*)?/gi;
      let match;
      while ((match = imageExtensionRegex.exec(event.content)) !== null) {
        extractedImages.push(match[0]);
      }
      
      // Match URLs from common image hosting services
      const imageHostRegex = /https?:\/\/(i\.imgur\.com|imgur\.com\/[a-zA-Z0-9]+|pbs\.twimg\.com|i\.ibb\.co|nostr\.build|void\.cat\/d\/|imgproxy\.snort\.social|image\.nostr\.build|media\.tenor\.com|cloudflare-ipfs\.com\/ipfs\/|ipfs\.io\/ipfs\/|files\.zaps\.lol|img\.zaps\.lol|primal\.b-cdn\.net|cdn\.nostr\.build|nitter\.net\/pic|postimages\.org|ibb\.co|cdn\.discordapp\.com\/attachments)\S+/gi;
      
      imageHostRegex.lastIndex = 0; // Reset regex
      while ((match = imageHostRegex.exec(event.content)) !== null) {
        // Only add if not already in the list
        if (!extractedImages.includes(match[0])) {
          extractedImages.push(match[0]);
        }
      }
      
      // Extract the first non-image URL for link preview
      const firstUrl = getFirstUrl(event.content);
      setLinkUrl(firstUrl);
    }
    
    // Set the extracted image URLs
    setImageUrls(extractedImages);
    
    // Process the text content
    if (event.content) {
      processTextContent(event.content);
    }
  }, [event, getFirstUrl]);
  
  // Process text content with links, mentions, etc.
  const processTextContent = (text: string) => {
    // Regular expressions for different patterns
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const nostrRegex = /nostr:(npub1|note1|nprofile1|nevent1)([a-z0-9]+)/g;
    const hashtagRegex = /#(\w+)/g;
    
    let lastIndex = 0;
    const parts: React.ReactNode[] = [];
    
    // Helper function to process matches
    const processMatches = (regex: RegExp, processor: (match: RegExpExecArray) => React.ReactNode | null) => {
      regex.lastIndex = 0; // Reset regex
      let match;
      const matchPositions: {index: number; length: number; node: React.ReactNode | null}[] = [];
      
      // Find all matches
      while ((match = regex.exec(text)) !== null) {
        const node = processor(match);
        
        // Only add to matches if the processor returned a node (not null)
        if (node !== null) {
          matchPositions.push({
            index: match.index,
            length: match[0].length,
            node
          });
        } else {
          // For null nodes (like hidden image URLs), we still need to record the position
          // but we'll handle them differently when building the content
          matchPositions.push({
            index: match.index,
            length: match[0].length,
            node: null
          });
        }
      }
      
      return matchPositions;
    };
    
    // Process URLs
    const urlMatches = processMatches(urlRegex, (match) => {
      const url = match[0];
      
      // Check if this URL is an image URL that will be displayed separately
      const isImageUrl = imageUrls.includes(url);
      
      if (isImageUrl) {
        // Return null for image URLs - they'll be displayed as images below
        return null;
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
      } catch (e) {
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
      // No special content, just use the plain text
      parts.push(text);
    } else {
      // Add text and special content in the correct order
      for (let i = 0; i < allMatches.length; i++) {
        const match = allMatches[i];
        
        // Add text before this match
        if (match.index > lastIndex) {
          parts.push(text.substring(lastIndex, match.index));
        }
        
        // Add the special content if it's not null (skip null nodes which are hidden image URLs)
        if (match.node !== null) {
          parts.push(match.node);
        }
        
        // Update lastIndex
        lastIndex = match.index + match.length;
      }
      
      // Add any remaining text
      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
      }
    }
    
    setProcessedContent(parts);
  };
  
  return (
    <div className={cn("whitespace-pre-wrap break-words", className)}>
      {/* Text content */}
      <div>
        {processedContent.length > 0 ? processedContent : event.content}
      </div>
      
      {/* Link Preview */}
      {linkUrl && (
        <LinkPreview url={linkUrl} />
      )}
      
      {/* Images */}
      {imageUrls.length > 0 && (
        <div className="mt-2 space-y-2">
          {imageUrls.map((url, index) => (
            <PostImage 
              key={`img-${index}`}
              url={url}
            />
          ))}
        </div>
      )}
      
      {/* Debug section - shown when DEBUG_IMAGES is true */}
      {DEBUG_IMAGES && imageUrls.length > 0 && (
        <div className="mt-4 border-t pt-2">
          <h4 className="text-sm font-medium mb-2">Debug: Detected Images</h4>
          {imageUrls.map((url, index) => (
            <div key={`debug-container-${index}`} className="mb-4">
              <DebugImageDisplay key={`debug-${index}`} url={url} />
              <DirectImageDisplay key={`direct-${index}`} url={url} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper component to display user mentions
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