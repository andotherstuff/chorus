import type { NostrEvent } from '@nostrify/nostrify';
import { cn } from '@/lib/utils';
import { PostImage } from '@/components/PostImage';
import { DebugImageDisplay } from '@/components/DebugImageDisplay';
import { DirectImageDisplay } from '@/components/DirectImageDisplay';
import { LinkPreview } from '@/components/LinkPreview';
import { MediaPlayer } from '@/components/MediaPlayer';
import { useProcessedContent } from '@/hooks/useProcessedContent';
import { DEBUG_IMAGES } from '@/lib/debug';

interface NoteContentProps {
  event: NostrEvent;
  className?: string;
}

export function NoteContent({
  event,
  className,
}: NoteContentProps) {
  const { textParts, imageUrls, videoUrls, audioUrls, linkUrl, hasTextContent } = useProcessedContent(event);

  return (
    <div className={cn("whitespace-pre-wrap break-words", className)}>
      {/* Text content */}
      {hasTextContent && (
        <div>
          {textParts.length > 0 ? textParts : event.content}
        </div>
      )}

      {/* Link Preview */}
      {linkUrl && (
        <LinkPreview url={linkUrl} />
      )}

      {/* Videos */}
      {videoUrls.length > 0 && (
        <div className="mt-2 space-y-2">
          {videoUrls.map((url, index) => (
            <MediaPlayer
              key={`video-${index}`}
              url={url}
              type="video"
            />
          ))}
        </div>
      )}

      {/* Audio */}
      {audioUrls.length > 0 && (
        <div className="mt-2 space-y-2">
          {audioUrls.map((url, index) => (
            <MediaPlayer
              key={`audio-${index}`}
              url={url}
              type="audio"
            />
          ))}
        </div>
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

