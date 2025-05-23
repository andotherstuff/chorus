import { useNostr } from "@nostrify/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import { getPostExpirationTimestamp } from "../lib/utils";
import { CASHU_EVENT_KINDS } from "@/lib/cashu";

interface EventTemplate {
  kind: 0 | 3 | 7 | 11 | 1111 | 4550 | 4551 | 4552 | 4553 | 14550 | 14551 | 14552 | 14553 | 17375 | 7375 | 7376 | 7374 | 10019 | 9321 | 34550;
  content?: string;
  tags?: string[][];
  created_at?: number;
}

interface UseNostrPublishOptions {
  invalidateQueries?: { queryKey: unknown[] }[];
  onSuccessCallback?: () => void;
}

// Group Meta
// - 34550: Group meta

// Post Creation
// - 11: Create Post
// - 1111: Reply to post
// - 7: React to post

// Post Moderation
// - 4550: Approve post
// - 4551: Remove post

// Joining Groups
// - 14550: Mod Approved members list
// - 14551: Mod Declined members list
// - 14552: Mod Banned users lists
// - 4552: Request to join group
// - 4553: Request to leave group

// Cashu
// - 17375: Replaceable event for wallet info
// - 7375: Token events for unspent proofs
// - 7376: Spending history events
// - 7374: Quote events (optional)
// - 10019: ZAP info events
// - 9321: ZAP events

const protectedEventKinds = [
  7, // Reactions
  11, // Posts
  1111, // Comments (replies)
  34550, // Group meta
];

const expirationEventKinds = [
  7, // Reactions
  11, // Posts
  1111, // Comments (replies)
];

export function useNostrPublish(options?: UseNostrPublishOptions) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (t: EventTemplate) => {
      if (user) {
        const tags = t.tags ?? [];

        // Add the client tag if it doesn't exist
        if (!tags.some((tag) => tag[0] === "client")) {
          tags.push(["client", "chorus"]);
        }

        // // Add protected tag for all events except kind 0 (metadata) and kind 3 (contacts)
        // if (protectedEventKinds.includes(t.kind) && !tags.some((tag) => tag[0] === "-")) {
        //   tags.push(["-"]);
        // }

        const expiration = getPostExpirationTimestamp();
        if (expirationEventKinds.includes(t.kind) && !tags.some((tag) => tag[0] === "expiration") && expiration) {
          tags.push(["expiration", expiration.toString()]);
        }

        const event = await user.signer.signEvent({
          kind: t.kind,
          content: t.content ?? "",
          tags,
          created_at: t.created_at ?? Math.floor(Date.now() / 1000),
        });

        await nostr.event(event, { signal: AbortSignal.timeout(5000) });
        return event;
      } else {
        throw new Error("User is not logged in");
      }
    },
    onError: (error) => {
      console.error("Failed to publish event:", error);
    },
    onSuccess: (event) => {
      console.log("Event published successfully:", event);
      
      // Invalidate specified queries
      if (options?.invalidateQueries) {
        options.invalidateQueries.forEach(query => {
          queryClient.invalidateQueries(query);
        });
      }
      
      // Call the onSuccess callback if provided
      if (options?.onSuccessCallback) {
        options.onSuccessCallback();
      }
      
      // Auto-invalidate queries based on event kind
      if (event) {
        // Get community ID from tags if present
        const communityTag = event.tags?.find(tag => tag[0] === "a");
        const communityId = communityTag ? communityTag[1] : undefined;
        
        // Invalidate relevant queries based on event kind
        switch (event.kind) {
          case 0: // Profile metadata
            queryClient.invalidateQueries({ queryKey: ['author', event.pubkey] });
            queryClient.invalidateQueries({ queryKey: ['follower-count', event.pubkey] });
            queryClient.invalidateQueries({ queryKey: ['following-count', event.pubkey] });
            queryClient.invalidateQueries({ queryKey: ['logins'] });
            break;
            
          case 3: // Contacts (follow list)
            queryClient.invalidateQueries({ queryKey: ['follow-list', event.pubkey] });
            queryClient.invalidateQueries({ queryKey: ['follower-count'] });
            queryClient.invalidateQueries({ queryKey: ['following-count'] });
            break;
            
          case 34550: // Community definition (group creation/update)
            queryClient.invalidateQueries({ queryKey: ['communities'] });
            queryClient.invalidateQueries({ queryKey: ['user-groups', event.pubkey] });
            break;
            
          case 4550: // Approve post
            if (communityId) {
              queryClient.invalidateQueries({ queryKey: ["approved-posts", communityId] });
              queryClient.invalidateQueries({ queryKey: ["pending-posts", communityId] });
              queryClient.invalidateQueries({ queryKey: ["pending-posts-count", communityId] });
            }
            break;
            
          case 4551: // Remove post
            if (communityId) {
              queryClient.invalidateQueries({ queryKey: ["removed-posts", communityId] });
              queryClient.invalidateQueries({ queryKey: ["approved-posts", communityId] });
              queryClient.invalidateQueries({ queryKey: ["pending-posts", communityId] });
              queryClient.invalidateQueries({ queryKey: ["pending-posts-count", communityId] });
            }
            break;
            
          case 14550: // Approved members list
          case 14551: // Declined members list
            if (communityId) {
              queryClient.invalidateQueries({ queryKey: ["approved-members-list", communityId] });
              queryClient.invalidateQueries({ queryKey: ["approved-members-count", communityId] });
              queryClient.invalidateQueries({ queryKey: ["declined-users", communityId] });
              queryClient.invalidateQueries({ queryKey: ["declined-users-count", communityId] });
              queryClient.invalidateQueries({ queryKey: ["group-membership", communityId] });
              queryClient.invalidateQueries({ queryKey: ["reliable-group-membership", communityId] });
              // Member changes affect pending posts/replies counts since auto-approval depends on membership
              queryClient.invalidateQueries({ queryKey: ["pending-posts-count", communityId] });
              queryClient.invalidateQueries({ queryKey: ["pending-replies", communityId] });
            }
            break;
            
          case 14552: // Ban user
            if (communityId) {
              queryClient.invalidateQueries({ queryKey: ["banned-users", communityId] });
              queryClient.invalidateQueries({ queryKey: ["banned-users-count", communityId] });
              // Also invalidate posts since banned users' posts should be hidden
              queryClient.invalidateQueries({ queryKey: ["approved-posts", communityId] });
              queryClient.invalidateQueries({ queryKey: ["pending-posts", communityId] });
              queryClient.invalidateQueries({ queryKey: ["pending-posts-count", communityId] });
              queryClient.invalidateQueries({ queryKey: ["pending-replies", communityId] });
            }
            break;
            
          case 14553: // Pinned groups
            queryClient.invalidateQueries({ queryKey: ["pinned-groups", event.pubkey] });
            queryClient.invalidateQueries({ queryKey: ["user-groups", event.pubkey] });
            break;
            
          case 7: {
            // Find the event being reacted to
            const reactedEventId = event.tags.find(tag => tag[0] === "e")?.[1];
            if (reactedEventId) {
              queryClient.invalidateQueries({ queryKey: ["reactions", reactedEventId] });
              queryClient.invalidateQueries({ queryKey: ["likes", reactedEventId] });
            }
            break;
          }
            
          case 11: // Post
            if (communityId) {
              queryClient.invalidateQueries({ queryKey: ["pending-posts", communityId] });
              queryClient.invalidateQueries({ queryKey: ["pending-posts-count", communityId] });
            }
            // Also invalidate user posts
            queryClient.invalidateQueries({ queryKey: ["user-posts", event.pubkey] });
            break;
            
          case 1111: {
            if (communityId) {
              queryClient.invalidateQueries({ queryKey: ["pending-posts", communityId] });
              queryClient.invalidateQueries({ queryKey: ["pending-posts-count", communityId] });
              queryClient.invalidateQueries({ queryKey: ["pending-replies", communityId] });
            }
            
            // Find the post being replied to
            const parentPostId = event.tags.find(tag => tag[0] === "e")?.[1];
            if (parentPostId) {
              queryClient.invalidateQueries({ queryKey: ["replies", parentPostId] });
              queryClient.invalidateQueries({ queryKey: ["nested-replies", parentPostId] });
            }
            break;
          }
            
          case 4552: // Request to join group
          case 4553: {
            if (communityId) {
              queryClient.invalidateQueries({ queryKey: ["join-requests", communityId] });
              queryClient.invalidateQueries({ queryKey: ["join-requests-count", communityId] });
              queryClient.invalidateQueries({ queryKey: ["join-request", communityId] });
              queryClient.invalidateQueries({ queryKey: ["group-membership", communityId] });
            }
            break;
          }
          
          case CASHU_EVENT_KINDS.ZAP: {
            // Find the event being zapped
            const zappedEventId = event.tags.find(tag => tag[0] === "e")?.[1];
            if (zappedEventId) {
              queryClient.invalidateQueries({ queryKey: ["nutzaps", zappedEventId] });
            }
            
            // Find the recipient
            const recipientPubkey = event.tags.find(tag => tag[0] === "p")?.[1];
            if (recipientPubkey) {
              queryClient.invalidateQueries({ queryKey: ["nutzap", "received", recipientPubkey] });
            }
            break;
          }
        }
      }
    },
  });
}