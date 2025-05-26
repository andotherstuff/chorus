import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { KINDS } from "@/lib/nostr-kinds";
import { useGroup } from "./useGroup";

export function usePendingJoinRequests(communityId: string) {
  const { nostr } = useNostr();
  const { data: group } = useGroup(communityId);

  const { data: joinRequests } = useQuery({
    queryKey: ["join-requests-count", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      const events = await nostr.query([{ 
        kinds: [KINDS.GROUP_JOIN_REQUEST],
        "#a": [communityId],
        limit: 50,
      }], { signal });
      
      return events;
    },
    enabled: !!nostr && !!communityId,
  });

  // Query for approved members to filter out already approved users
  const { data: approvedMembersEvents } = useQuery({
    queryKey: ["approved-members-count", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      const events = await nostr.query([{ 
        kinds: [KINDS.GROUP_APPROVED_MEMBERS_LIST],
        "#d": [communityId],
        limit: 10,
      }], { signal });
      
      return events;
    },
    enabled: !!nostr && !!communityId,
  });

  // Query for declined users to filter out already declined users
  const { data: declinedUsersEvents } = useQuery({
    queryKey: ["declined-users-count", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      const events = await nostr.query([{ 
        kinds: [KINDS.GROUP_DECLINED_MEMBERS_LIST],
        "#d": [communityId],
        limit: 50,
      }], { signal });
      
      return events;
    },
    enabled: !!nostr && !!communityId,
  });

  // Query for banned users to filter out banned users
  const { data: bannedUsersEvents } = useQuery({
    queryKey: ["banned-users-count", communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      const events = await nostr.query([{ 
        kinds: [KINDS.GROUP_BANNED_MEMBERS_LIST],
        "#d": [communityId],
        limit: 50,
      }], { signal });
      
      return events;
    },
    enabled: !!nostr && !!communityId,
  });

  // Extract all approved member pubkeys from the events
  const approvedMembers = approvedMembersEvents?.flatMap(event => 
    event.tags.filter(tag => tag[0] === "p").map(tag => tag[1])
  ) || [];

  // Extract all declined user pubkeys from the events
  const declinedUsers = declinedUsersEvents?.flatMap(event => 
    event.tags.filter(tag => tag[0] === "p").map(tag => tag[1])
  ) || [];

  // Extract all banned user pubkeys from the events
  const bannedUsers = bannedUsersEvents?.flatMap(event => 
    event.tags.filter(tag => tag[0] === "p").map(tag => tag[1])
  ) || [];

  // Remove duplicates
  const uniqueApprovedMembers = [...new Set(approvedMembers)];
  const uniqueDeclinedUsers = [...new Set(declinedUsers)];
  const uniqueBannedUsers = [...new Set(bannedUsers)];

  // Filter out join requests from users who are already approved, declined, or banned
  const pendingRequests = joinRequests?.filter(request => 
    !uniqueApprovedMembers.includes(request.pubkey) && 
    !uniqueDeclinedUsers.includes(request.pubkey) &&
    !uniqueBannedUsers.includes(request.pubkey)
  ) || [];

  return {
    pendingRequestsCount: pendingRequests.length,
    isLoading: !joinRequests || !approvedMembersEvents || !declinedUsersEvents || !bannedUsersEvents
  };
}