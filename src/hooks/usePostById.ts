import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { NostrEvent } from "@jsr/nostrify__nostrify";

/**
 * Hook to fetch a post by its ID
 * @param eventId The ID of the post to fetch
 */
export function usePostById(eventId?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ["post", eventId],
    queryFn: async (c) => {
      if (!eventId) return null;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Query for the specific event by ID
      const events = await nostr.query([{
        ids: [eventId],
        limit: 1,
      }], { signal });

      return events.length > 0 ? events[0] : null;
    },
    enabled: !!nostr && !!eventId,
  });
}