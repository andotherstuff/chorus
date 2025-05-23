import { toast } from "sonner";

export interface ShareOptions {
  title?: string;
  text?: string;
  url: string;
}

export async function shareContent(options: ShareOptions): Promise<void> {
  // Check if Web Share API is available and we're in a secure context
  if (navigator.share && window.isSecureContext) {
    try {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url,
      });
      return; // Share was successful
    } catch (error) {
      // User cancelled the share or there was an error
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing:', error);
        // Fall through to clipboard fallback
      } else {
        // User cancelled, don't show any notification
        return;
      }
    }
  }

  // Fallback to clipboard
  try {
    await navigator.clipboard.writeText(options.url);
    toast.success("Link copied to clipboard!");
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    toast.error("Failed to copy link");
  }
}