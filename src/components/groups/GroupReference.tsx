import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useNostr } from "@/hooks/useNostr";
import { Badge } from "@/components/ui/badge";
import { parseNostrAddress } from "@/lib/nostr-utils";
import { KINDS } from "@/lib/nostr-kinds";

interface GroupReferenceProps {
  groupId: string;
}

export function GroupReference({ groupId }: GroupReferenceProps) {
  const { nostr } = useNostr();
  const [groupName, setGroupName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchGroupInfo = async () => {
      try {
        setIsLoading(true);
        const parsedAddress = parseNostrAddress(groupId);
        
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
          setGroupName(parsedAddress.identifier);
        }
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
      <Link to={`/group/${encodeURIComponent(groupId)}`} className="hover:underline">
        {groupName}
      </Link>
    </Badge>
  );
}