import { cn } from "@/lib/utils";

interface MediaPlayerProps {
  url: string;
  type: 'video' | 'audio';
  className?: string;
}

export function MediaPlayer({ url, type, className }: MediaPlayerProps) {
  if (type === 'audio') {
    return (
      <div className={cn("rounded-lg overflow-hidden", className)}>
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
    <div className={cn("rounded-lg overflow-hidden", className)}>
      <video
        src={url}
        controls
        className="w-full h-auto max-h-[500px]"
        preload="metadata"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}