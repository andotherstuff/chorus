import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink } from 'lucide-react';

interface LinkPreviewProps {
  url: string;
}

interface LinkMetadata {
  title: string;
  description: string;
  image: string;
  domain: string;
}

export function LinkPreview({ url }: LinkPreviewProps) {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoading(true);
        setError(false);

        // Use a proxy service to avoid CORS issues
        // In a production app, you would use your own backend proxy or a service like Microlink
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
          throw new Error('Failed to fetch link metadata');
        }
        
        const data = await response.json();
        const html = data.contents;
        
        // Create a DOM parser to extract metadata
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
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
          
        // Extract domain from URL
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace('www.', '');
        
        setMetadata({
          title,
          description,
          image,
          domain
        });
      } catch (err) {
        console.error('Error fetching link preview:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (url) {
      fetchMetadata();
    }
  }, [url]);

  if (loading) {
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

  if (error || !metadata) {
    // Fallback to a simple link display
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="text-blue-500 hover:underline flex items-center mt-1 text-sm"
      >
        <ExternalLink className="h-3.5 w-3.5 mr-1" />
        {url}
      </a>
    );
  }

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
            {metadata.image && (
              <div className="sm:w-1/3 h-32 sm:h-auto">
                <div 
                  className="w-full h-full bg-cover bg-center" 
                  style={{ backgroundImage: `url(${metadata.image})` }}
                />
              </div>
            )}
            <div className={`${metadata.image ? 'sm:w-2/3' : 'w-full'} p-3 space-y-1`}>
              <h3 className="font-medium text-sm line-clamp-2">{metadata.title}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2">{metadata.description}</p>
              <div className="flex items-center text-xs text-muted-foreground pt-1">
                <ExternalLink className="h-3 w-3 mr-1" />
                {metadata.domain}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}