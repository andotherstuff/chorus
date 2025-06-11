// ABOUTME: This component safely loads images without showing broken image icons
// ABOUTME: It uses a hidden img element to test if the image loads before displaying it

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  onLoadSuccess?: () => void;
  onLoadError?: () => void;
}

export function SafeImage({
  src,
  fallbackSrc = "/placeholder-community.svg",
  className,
  onLoadSuccess,
  onLoadError,
  alt = "",
  ...props
}: SafeImageProps) {
  const [imageSrc, setImageSrc] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!src) {
      setImageSrc(fallbackSrc);
      setIsLoading(false);
      return;
    }

    // Create a new image element to test loading
    const img = new Image();
    
    img.onload = () => {
      setImageSrc(src);
      setIsLoading(false);
      onLoadSuccess?.();
    };

    img.onerror = () => {
      setImageSrc(fallbackSrc);
      setIsLoading(false);
      onLoadError?.();
    };

    // Start loading
    img.src = src;

    // Cleanup
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, fallbackSrc, onLoadSuccess, onLoadError]);

  // Show placeholder while loading
  if (!imageSrc && isLoading) {
    return (
      <div 
        className={cn(
          "bg-muted animate-pulse",
          className
        )}
        style={{ width: '100%', height: '100%' }}
      />
    );
  }
  
  // Don't render anything if no image source
  if (!imageSrc) {
    return null;
  }

  return (
    <img
      {...props}
      src={imageSrc}
      alt={alt}
      className={cn(
        "transition-opacity duration-200",
        isLoading ? "opacity-0" : "opacity-100",
        className
      )}
    />
  );
}