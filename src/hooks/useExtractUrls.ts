import { useCallback } from 'react';
/**
 * A hook to extract URLs from text content
 */
export function useExtractUrls() {
  /**
   * Extracts URLs from text content
   * @param text The text to extract URLs from
   * @param excludeImageUrls Whether to exclude image URLs (default: true)
   * @returns An array of URLs
   */
  const extractUrls = useCallback((text: string, excludeImageUrls = true): string[] => {
    if (!text) return [];

    // Regular expression to match URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    // Regular expression to match image URLs
    const imageUrlRegex = /https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|bmp|tiff|avif|heic)(\?\S*)?/gi;

    // Regular expression to match URLs from common image hosting services
    const imageHostRegex = /https?:\/\/(i\.imgur\.com|imgur\.com\/[a-zA-Z0-9]+|pbs\.twimg\.com|i\.ibb\.co|nostr\.build|void\.cat\/d\/|imgproxy\.snort\.social|image\.nostr\.build|media\.tenor\.com|cloudflare-ipfs\.com\/ipfs\/|ipfs\.io\/ipfs\/|files\.zaps\.lol|img\.zaps\.lol|primal\.b-cdn\.net|cdn\.nostr\.build|nitter\.net\/pic|postimages\.org|ibb\.co|cdn\.discordapp\.com\/attachments)\S+/gi;

    // Extract all URLs
    const urls = text.match(urlRegex) || [];

    if (excludeImageUrls) {
      // Filter out image URLs
      return urls.filter(url => {
        imageUrlRegex.lastIndex = 0;
        imageHostRegex.lastIndex = 0;
        return !imageUrlRegex.test(url) && !imageHostRegex.test(url);
      });
    }

    return urls;
  }, []);

  /**
   * Gets the first URL from text content
   * @param text The text to extract the URL from
   * @param excludeImageUrls Whether to exclude image URLs (default: true)
   * @returns The first URL found, or null if none
   */
  const getFirstUrl = useCallback((text: string, excludeImageUrls = true): string | null => {
    const urls = extractUrls(text, excludeImageUrls);
    return urls.length > 0 ? urls[0] : null;
  }, [extractUrls]);

  return {
    extractUrls,
    getFirstUrl
  };
}
