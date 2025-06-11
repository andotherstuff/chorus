import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ImageOff } from 'lucide-react';

interface ImagePreviewProps {
  src: string;
  alt?: string;
  className?: string;
}

export function ImagePreview({ src, alt = 'Image', className }: ImagePreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  
  // Process and normalize the URL
  useEffect(() => {
    if (!src) {
      setHasError(true);
      return;
    }
    
    try {
      let url = src.trim();
      
      // Fix common URL issues
      
      // 1. Handle nostr.build URLs
      if (url.includes('nostr.build') && !url.includes('/i/')) {
        // Convert regular nostr.build URLs to their image endpoint
        url = url.replace(/nostr\.build\/([^/i])/i, 'nostr.build/i/$1');
      }
      
      // 2. Handle imgur URLs without direct image links
      if (url.match(/imgur\.com\/[a-zA-Z0-9]+$/i) && !url.includes('.jpg') && !url.includes('.png')) {
        // Add .jpg to direct imgur links
        url = `${url}.jpg`;
      }
      
      // 3. Handle Twitter/X image URLs
      if (url.includes('pbs.twimg.com') && url.includes('&name=')) {
        // Remove size parameters for Twitter images
        url = url.replace(/&name=[^&]+/, '');
      }

      // 4. Handle Discord CDN URLs
      if (url.includes('cdn.discordapp.com/attachments')) {
        // Add cache-busting parameter for Discord images
        url = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
      }
      
      // 5. Handle URLs with unescaped characters
      if (url.includes(' ')) {
        url = url.replace(/ /g, '%20');
      }
      
      // Set the processed URL
      setImageUrl(url);
      setIsLoading(true);
      setHasError(false);
      setRetryCount(0);
      
    } catch (error) {
      console.error('Error processing image URL:', src, error);
      setHasError(true);
    }
  }, [src]);
  
  const handleLoad = () => {
    setIsLoading(false);
  };
  
  const handleError = () => {
    console.error(`Failed to load image (attempt ${retryCount + 1}):`, imageUrl, 'Original URL:', src);

    // Max retry attempts
    if (retryCount >= 2) {
      setIsLoading(false);
      setHasError(true);
      return;
    }

    // Increment retry counter
    setRetryCount(prev => prev + 1);
    
    // Try alternative formats based on retry count
    if (retryCount === 0) {
      // First retry: Try different format
      if (imageUrl.includes('.png')) {
        // Try jpg instead
        const newUrl = imageUrl.replace('.png', '.jpg');
        console.log('Trying JPG format:', newUrl);
        setImageUrl(newUrl);
        setIsLoading(true);
      } else if (imageUrl.includes('.jpg') || imageUrl.includes('.jpeg')) {
        // Try png instead
        const newUrl = imageUrl.replace(/\.(jpg|jpeg)/, '.png');
        console.log('Trying PNG format:', newUrl);
        setImageUrl(newUrl);
        setIsLoading(true);
      } else {
        // Add format parameter
        const newUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}format=jpg`;
        console.log('Trying with format parameter:', newUrl);
        setImageUrl(newUrl);
        setIsLoading(true);
      }
    } else if (retryCount === 1) {
      // Second retry: Try with cache busting parameter
      const cacheBuster = Date.now();
      const newUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}_=${cacheBuster}`;
      console.log('Trying with cache buster:', newUrl);
      setImageUrl(newUrl);
      setIsLoading(true);
    }
  };
  
  if (!imageUrl || (hasError && !isLoading)) {
    return (
      <div className={cn("flex items-center justify-center bg-muted/20 rounded-md my-2 h-32", className)}>
        <div className="flex flex-col items-center text-muted-foreground">
          <ImageOff size={24} className="mb-2" />
          <span className="text-xs">Image unavailable</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn("relative rounded-md overflow-hidden my-2 max-w-full", className)}>
      {isLoading && (
        <Skeleton className="w-full h-48 rounded-md" />
      )}
      <img
        src={imageUrl}
        alt={alt}
        className={cn(
          "max-w-full max-h-[512px] rounded-md object-contain",
          isLoading ? "opacity-0" : "opacity-100"
        )}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
      />
    </div>
  );
}