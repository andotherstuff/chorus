import { cn } from "@/lib/utils";
import { Music } from "lucide-react";

interface MediaPlayerProps {
  url: string;
  type: 'video' | 'audio';
  className?: string;
}

export function MediaPlayer({ url, type, className }: MediaPlayerProps) {
  if (type === 'audio') {
    return (
      <div className={cn("rounded-lg flex items-center", className)}>
        <audio
          src={url}
          controls
          className="w-full"
          preload="metadata"
        >
          Your browser does not support the audio element.
        </audio>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg overflow-hidden bg-black/5 dark:bg-white/5", className)}>
      <video
        src={url}
        controls
        className="w-full h-auto max-w-2xl mx-auto"
        style={{ 
          maxHeight: '70vh',
          // For audio-only WebM files, this prevents a tall black box
          minHeight: '54px' 
        }}
        preload="metadata"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}