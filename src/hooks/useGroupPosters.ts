import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import { parseNostrAddress } from "@/lib/nostr-utils";
import { KINDS } from "@/lib/nostr-kinds";

/**
 * Hook to fetch active posters in a NIP-72 community
 * Used as a fallback when no approved members list exists
 */
export function useGroupPosters(communityId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ["group-posters", communityId],
    queryFn: async (c) => {
      if (!communityId || communityId.startsWith("nip29:")) {
        return [];
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Parse the community ID to get the author and identifier
      const parsedId = parseNostrAddress(decodeURIComponent(communityId));
      if (!parsedId) {
        console.log("[useGroupPosters] Failed to parse community ID:", communityId);
        return [];
      }

      // Construct the a-tag for this group
      const aTag = `${KINDS.GROUP}:${parsedId.pubkey}:${parsedId.identifier}`;
      
      console.log("[useGroupPosters] Querying posts with a-tag:", aTag);
      
      // Query for posts in this group
      const posts = await nostr.query([{
        kinds: [KINDS.TEXT_NOTE],
        "#a": [aTag],
        limit: 100 // Get more posts to find more unique posters
      }], { signal });
      
      console.log(`[useGroupPosters] Found ${posts.length} posts in group`);
      
      // Extract unique poster pubkeys
      const posterSet = new Set<string>();
      posts.forEach(post => {
        posterSet.add(post.pubkey);
      });
      
      const posters = Array.from(posterSet);
      console.log(`[useGroupPosters] Found ${posters.length} unique posters`);
      
      return posters;
    },
    enabled: !!nostr && !!communityId && !communityId.startsWith("nip29:"),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}