import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Link, Image } from 'lucide-react';

interface LinkPreviewProps {
  url: string;
}

interface LinkMetadata {
  title: string;
  description: string;
  image: string;
  domain: string;
}

// Function to extract domain name from a URL
const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch (error) {
    // If URL parsing fails, use a regex fallback
    const match = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n?]+)/i);
    return match ? match[1] : url;
  }
};

export function LinkPreview({ url }: LinkPreviewProps) {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fetchTries, setFetchTries] = useState(0);

  // Clean and format the URL for display
  const displayUrl = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  const domain = extractDomain(url);

  useEffect(() => {
    const fetchMetadata = async () => {
      // Reset state for new URL
      if (fetchTries === 0) {
        setLoading(true);
        setError(false);
      }

      try {
        // Handle special case domains directly
        if (
          url.includes('youtube.com') || 
          url.includes('youtu.be') ||
          url.includes('twitter.com') || 
          url.includes('x.com')
        ) {
          // For these domains, just display a simplified preview without trying to fetch metadata
          setMetadata({
            title: url.includes('youtube') ? 'YouTube Video' : 'Twitter Post',
            description: '',
            image: '',
            domain: domain
          });
          setLoading(false);
          return;
        }

        // Try different proxy services based on retry count
        let proxyUrl = '';
        
        // On first try, use allorigins
        if (fetchTries === 0) {
          proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        }
        // On second try, use another service
        else if (fetchTries === 1) {
          proxyUrl = `https://cors-anywhere.herokuapp.com/${url}`;
        }
        // On third try, give up on proxies and just show a clean preview
        else {
          throw new Error('All proxy attempts failed');
        }
        
        // Add a timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(proxyUrl, { 
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Response not OK: ${response.status}`);
        }
        
        let html = '';
        let doc: Document;
        
        // Parse the response based on the proxy used
        if (fetchTries === 0) {
          const data = await response.json();
          html = data.contents;
          const parser = new DOMParser();
          doc = parser.parseFromString(html, 'text/html');
        } else {
          html = await response.text();
          const parser = new DOMParser();
          doc = parser.parseFromString(html, 'text/html');
        }
        
        // Extract metadata from Open Graph tags, Twitter cards, or regular meta tags
        const title = 
          doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || 
          doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || 
          doc.querySelector('title')?.textContent || 
          '';
          
        const description = 
          doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || 
          doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content') || 
          doc.querySelector('meta[name="description"]')?.getAttribute('content') || 
          '';
          
        const image = 
          doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || 
          doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || 
          '';
          
        setMetadata({
          title: title || url,
          description,
          image,
          domain
        });
        setLoading(false);
      } catch (err) {
        console.error('Error fetching link preview:', err);
        
        // If we haven't exceeded max retries, try another method
        if (fetchTries < 2) {
          setFetchTries(prev => prev + 1);
        } else {
          // After all retries fail, show fallback
          setError(true);
          setLoading(false);
          
          // Still provide basic metadata for fallback display
          setMetadata({
            title: '',
            description: '',
            image: '',
            domain
          });
        }
      }
    };

    if (url) {
      fetchMetadata();
    }
  }, [url, fetchTries, domain]);

  // Show loading state only on first attempt
  if (loading && fetchTries === 0) {
    return (
      <Card className="overflow-hidden mt-2 max-w-md">
        <CardContent className="p-0">
          <div className="flex">
            <div className="w-1/3">
              <Skeleton className="h-24 w-full" />
            </div>
            <div className="w-2/3 p-3 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show fallback for errors or when all retries failed
  if (error || (loading && fetchTries >= 2)) {
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="inline-flex items-center mt-1 px-3 py-2 bg-muted/30 rounded-md text-sm text-primary hover:bg-muted/50 transition-colors"
      >
        {url.includes('youtube.com') || url.includes('youtu.be') ? (
          <Image className="h-4 w-4 mr-2 text-red-500" />
        ) : url.includes('twitter.com') || url.includes('x.com') ? (
          <Link className="h-4 w-4 mr-2 text-blue-400" />
        ) : (
          <ExternalLink className="h-4 w-4 mr-2" />
        )}
        <span className="truncate max-w-[250px]">{displayUrl}</span>
      </a>
    );
  }

  // If metadata has no title but we're not in an error state, show a simplified preview
  if (metadata && !metadata.title) {
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="inline-flex items-center mt-1 px-3 py-2 bg-muted/30 rounded-md text-sm text-primary hover:bg-muted/50 transition-colors"
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        <span className="truncate max-w-[250px]">{displayUrl}</span>
      </a>
    );
  }

  // Full link preview card with metadata
  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="no-underline block mt-2 max-w-md hover:opacity-90 transition-opacity"
    >
      <Card className="overflow-hidden border-muted">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row">
            {metadata?.image && (
              <div className="sm:w-1/3 h-32 sm:h-auto">
                <div 
                  className="w-full h-full bg-cover bg-center" 
                  style={{ backgroundImage: `url(${metadata.image})` }}
                  onError={(e) => {
                    // Hide the image div if it fails to load
                    (e.target as HTMLDivElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className={`${metadata?.image ? 'sm:w-2/3' : 'w-full'} p-3 space-y-1`}>
              <h3 className="font-medium text-sm line-clamp-2">{metadata?.title}</h3>
              {metadata?.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{metadata.description}</p>
              )}
              <div className="flex items-center text-xs text-muted-foreground pt-1">
                <ExternalLink className="h-3 w-3 mr-1" />
                {metadata?.domain}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}