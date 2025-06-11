import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useNostr } from "@/hooks/useNostr";
import { Badge } from "@/components/ui/badge";
import { parseNostrAddress } from "@/lib/nostr-utils";
import { KINDS } from "@/lib/nostr-kinds";
import { createGroupRouteId } from "@/lib/group-utils";

interface GroupReferenceProps {
  groupId: string;
}

export function GroupReference({ groupId }: GroupReferenceProps) {
  const { nostr } = useNostr();
  const [groupName, setGroupName] = useState<string | null>(null);
  const [groupRouteId, setGroupRouteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchGroupInfo = async () => {
      try {
        setIsLoading(true);
        
        // Handle different group ID formats
        let parsedAddress;
        
        // Check if it's already in the route format (nip72:pubkey:identifier)
        if (groupId.startsWith("nip72:") || groupId.startsWith("nip29:")) {
          // It's already in the route format, extract the parts
          if (groupId.startsWith("nip72:")) {
            const parts = groupId.substring(6).split(":");
            if (parts.length >= 2) {
              parsedAddress = {
                kind: KINDS.GROUP,
                pubkey: parts[0],
                identifier: parts.slice(1).join(":") // Handle identifiers with colons
              };
            }
          } else {
            // For NIP-29, we don't need to fetch from regular relays
            console.log("NIP-29 group reference not supported in this component");
            setIsLoading(false);
            return;
          }
        } else {
          // Try to parse as standard Nostr address (34550:pubkey:identifier)
          parsedAddress = parseNostrAddress(groupId);
        }
        
        if (!parsedAddress || parsedAddress.kind !== KINDS.GROUP) {
          console.error("Invalid group ID format:", groupId);
          setIsLoading(false);
          return;
        }

        const events = await nostr.query(
          [{ 
            kinds: [KINDS.GROUP], 
            authors: [parsedAddress.pubkey], 
            "#d": [parsedAddress.identifier] 
          }],
          { signal: AbortSignal.timeout(3000) }
        );

        if (events.length > 0) {
          const nameTag = events[0].tags.find(tag => tag[0] === "name");
          setGroupName(nameTag ? nameTag[1] : parsedAddress.identifier);
        } else {
          // Use identifier as fallback name
          setGroupName(parsedAddress.identifier);
        }
        
        // Always create proper route ID for NIP-72 groups
        const routeId = `nip72:${parsedAddress.pubkey}:${parsedAddress.identifier}`;
        setGroupRouteId(routeId);
      } catch (error) {
        console.error("Error fetching group info:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (groupId) {
      fetchGroupInfo();
    }
  }, [groupId, nostr]);

  if (isLoading) {
    return <Badge variant="outline" className="animate-pulse">Loading group...</Badge>;
  }

  if (!groupName) {
    return null;
  }

  return (
    <Badge variant="secondary" className="ml-1">
      <Link to={`/group/${encodeURIComponent(groupRouteId || groupId)}`} className="hover:underline">
        {groupName}
      </Link>
    </Badge>
  );
}