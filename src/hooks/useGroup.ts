import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import { KINDS } from "@/lib/nostr-kinds";
import { parseNostrAddress } from "@/lib/nostr-utils";
import { parseGroupRouteId } from "@/lib/group-utils";

export function useGroup(groupId: string | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ["community", groupId],
    queryFn: async (c) => {
      console.log("[useGroup] Fetching group details for:", groupId);
      
      // Try to parse as new format first (nip72:pubkey:identifier)
      const parsedGroup = parseGroupRouteId(groupId!);
      
      let parsedId;
      if (parsedGroup?.type === "nip72") {
        parsedId = {
          pubkey: parsedGroup.pubkey,
          identifier: parsedGroup.identifier
        };
      } else {
        // Fall back to old format
        parsedId = parseNostrAddress(decodeURIComponent(groupId!));
      }
      
      if (!parsedId) throw new Error("Invalid community ID");

      console.log("[useGroup] Parsed ID:", parsedId);

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      const events = await nostr.query([{
        kinds: [KINDS.GROUP],
        authors: [parsedId.pubkey],
        "#d": [parsedId.identifier]
      }], { signal });

      console.log("[useGroup] Query results:", {
        groupId,
        eventsFound: events.length,
        event: events[0] ? {
          id: events[0].id,
          pubkey: events[0].pubkey,
          tags: events[0].tags
        } : null
      });

      if (events.length === 0) throw new Error("Community not found");
      return events[0];
    },
    enabled: !!groupId,
  });
}