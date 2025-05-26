import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import { KINDS } from "@/lib/nostr-kinds";
import { parseNostrAddress } from "@/lib/nostr-utils";

export function useGroup(groupId: string | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ["community", groupId],
    queryFn: async (c) => {
      const parsedId = parseNostrAddress(decodeURIComponent(groupId!));
      if (!parsedId) throw new Error("Invalid community ID");

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      const events = await nostr.query([{
        kinds: [KINDS.GROUP],
        authors: [parsedId.pubkey],
        "#d": [parsedId.identifier]
      }], { signal });

      if (events.length === 0) throw new Error("Community not found");
      return events[0];
    },
    enabled: !!groupId,
  });
}