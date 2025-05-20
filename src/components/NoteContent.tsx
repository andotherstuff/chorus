import { useState, useEffect } from 'react';
import { type NostrEvent } from '@nostrify/nostrify';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useAuthor } from '@/hooks/useAuthor';
import { cn } from '@/lib/utils';

interface NoteContentProps {
  event: NostrEvent;
  className?: string;
}

export function NoteContent({ 
  event, 
  className, 
}: NoteContentProps) {
  const [content, setContent] = useState<React.ReactNode[]>([]);
  
  // Process the content to render mentions, links, etc.
  useEffect(() => {
    if (!event || (event.kind !== 1 && event.kind !== 1111)) return;
    
    const processContent = async () => {
      const text = event.content;
      
      // Regular expressions for different patterns
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const nostrRegex = /nostr:(npub1|note1|nprofile1|nevent1)([a-z0-9]+)/g;
      const hashtagRegex = /#(\w+)/g;
      
      // Split the content by these patterns
      let lastIndex = 0;
      const parts: React.ReactNode[] = [];
      
      // Process URLs
      const processUrls = () => {
        text.replace(urlRegex, (match, url, index) => {
          if (index > lastIndex) {
            parts.push(text.substring(lastIndex, index));
          }
          
          parts.push(
            <a 
              key={`url-${index}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              {url}
            </a>
          );
          
          lastIndex = index + match.length;
          return match;
        });
      };
      
      // Process Nostr references
      const processNostrRefs = () => {
        text.replace(nostrRegex, (match, prefix, datastring, index) => {
          if (index > lastIndex) {
            parts.push(text.substring(lastIndex, index));
          }
          
          try {
            const nostrId = `${prefix}${datastring}`;
            const decoded = nip19.decode(nostrId);
            
            if (decoded.type === 'npub') {
              const pubkey = decoded.data as string;
              parts.push(
                <NostrMention key={`mention-${index}`} pubkey={pubkey} />
              );
            } else if (decoded.type === 'note') {
              parts.push(
                <Link 
                  key={`note-${index}`}
                  to={`/e/${nostrId}`}
                  className="text-blue-500 hover:underline"
                >
                  note
                </Link>
              );
            } else {
              // For other types, just show as a link
              parts.push(
                <Link 
                  key={`nostr-${index}`}
                  to={`https://njump.me/${nostrId}`}
                  className="text-blue-500 hover:underline"
                >
                  {match}
                </Link>
              );
            }
          } catch (e) {
            // If decoding fails, just render as text
            parts.push(match);
          }
          
          lastIndex = index + match.length;
          return match;
        });
      };
      
      // Process hashtags
      const processHashtags = () => {
        text.replace(hashtagRegex, (match, tag, index) => {
          if (index > lastIndex) {
            parts.push(text.substring(lastIndex, index));
          }
          
          parts.push(
            <Link 
              key={`hashtag-${index}`}
              to={`/t/${tag}`}
              className="text-blue-500 hover:underline"
            >
              #{tag}
            </Link>
          );
          
          lastIndex = index + match.length;
          return match;
        });
      };
      
      // Run all processors
      processUrls();
      processNostrRefs();
      processHashtags();
      
      // Add any remaining text
      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
      }
      
      // If no special content was found, just use the plain text
      if (parts.length === 0) {
        parts.push(text);
      }
      
      setContent(parts);
    };
    
    processContent();
  }, [event]);
  
  return (
    <div className={cn("whitespace-pre-wrap break-words", className)}>
      {content.length > 0 ? content : event.content}
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