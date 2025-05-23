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
      <div className={cn("bg-secondary/30 rounded-lg p-3 flex items-center gap-3", className)}>
        <div className="bg-primary/10 rounded-full p-2 flex-shrink-0">
          <Music className="h-4 w-4 text-primary" />
        </div>
        <audio
          src={url}
          controls
          className="flex-1 h-10"
          preload="metadata"
          style={{ maxWidth: '400px' }}
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
        style={{ maxHeight: '70vh' }}
        preload="metadata"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}