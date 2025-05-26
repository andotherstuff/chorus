import { useQuery } from "@tanstack/react-query";
import { useNostr } from "./useNostr";
import { KINDS } from "@/lib/nostr-kinds";

// The specific Site Admin group ID
const SITE_ADMIN_GROUP_ID = "34550:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:and-other-stuff-mb3c9stb";

/**
 * Hook to get the list of hidden groups based on 1984 events from Site Admins
 */
export function useHiddenGroups() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ["hidden-groups"],
    queryFn: async (c) => {
      try {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
        
        // First, get the Site Admin group to find its owners and moderators
        const siteAdminGroups = await nostr.query(
          [{ 
            kinds: [KINDS.GROUP], 
            "#d": ["and-other-stuff-mb3c9stb"],
            authors: ["932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d"]
          }],
          { signal }
        );

        if (!siteAdminGroups || siteAdminGroups.length === 0) {
          return new Set<string>();
        }

        const siteAdminGroup = siteAdminGroups[0];
        
        // Extract site admin pubkeys (owner + moderators)
        const siteAdminPubkeys = new Set<string>();
        
        // Add the owner (group creator)
        siteAdminPubkeys.add(siteAdminGroup.pubkey);
        
        // Add moderators
        for (const tag of siteAdminGroup.tags) {
          if (tag[0] === "p" && tag[3] === "moderator") {
            siteAdminPubkeys.add(tag[1]);
          }
        }

        if (siteAdminPubkeys.size === 0) {
          return new Set<string>();
        }

        // Now get all 1984 events from Site Admins
        const reportEvents = await nostr.query(
          [{ 
            kinds: [KINDS.REPORT],
            authors: Array.from(siteAdminPubkeys),
            limit: 1000
          }],
          { signal }
        );

        // Extract hidden group IDs from the reports
        const hiddenGroupIds = new Set<string>();
        
        for (const event of reportEvents) {
          // Look for "a" tags that reference groups (kind 34550)
          for (const tag of event.tags) {
            if (tag[0] === "a" && tag[1] && tag[1].startsWith("34550:")) {
              hiddenGroupIds.add(tag[1]);
            }
          }
        }

        return hiddenGroupIds;
      } catch (error) {
        console.error("Error fetching hidden groups:", error);
        return new Set<string>();
      }
    },
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });
}