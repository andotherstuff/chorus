import { useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  url: string;
  className?: string;
}

export function VideoPlayer({ url, className }: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleLoadedData = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (hasError) {
    return (
      <div className={cn("bg-muted rounded-lg p-4 text-center", className)}>
        <p className="text-sm text-muted-foreground">Unable to load video</p>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm text-blue-500 hover:underline mt-2 inline-block"
        >
          Open video in new tab
        </a>
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-lg overflow-hidden bg-black", className)}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="animate-pulse text-muted-foreground">Loading video...</div>
        </div>
      )}
      <video
        ref={videoRef}
        src={url}
        controls
        className="w-full h-auto max-h-[500px]"
        onLoadedData={handleLoadedData}
        onError={handleError}
        preload="metadata"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}