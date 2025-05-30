import { useCallback } from "react";
import { useEnhancedNostr } from "@/components/EnhancedNostrProvider";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useNip29GroupOperations(groupId: string, relay: string) {
  const { nostr } = useEnhancedNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Create a new NIP-29 group
  const createGroup = useCallback(async (groupData: {
    name: string;
    about?: string;
    picture?: string;
    isPrivate?: boolean;
    isClosed?: boolean;
  }) => {
    if (!user) {
      throw new Error("Must be logged in to create a group");
    }

    console.log('[NIP-29] Creating new group:', groupData);

    const tags: string[][] = [
      ["name", groupData.name],
    ];

    if (groupData.about) {
      tags.push(["about", groupData.about]);
    }

    if (groupData.picture) {
      tags.push(["picture", groupData.picture]);
    }

    if (groupData.isPrivate) {
      tags.push(["private"]);
    }

    if (groupData.isClosed) {
      tags.push(["closed"]);
    }

    const event = await user!.signer.signEvent({
      kind: 9007, // GROUP_CREATE
      tags,
      content: "",
      created_at: Math.floor(Date.now() / 1000),
    });

    if (!nostr) {
      throw new Error("Nostr client not available");
    }

    const result = await nostr.event(event, { relays: [relay] });

    // Invalidate groups queries
    queryClient.invalidateQueries({ queryKey: ["nip29-groups"] });
    
    return result;
  }, [user, nostr, queryClient, relay]);

  // Join a group
  const joinGroup = useCallback(async (options: {
    message?: string;
    inviteCode?: string;
  } = {}) => {
    if (!user) {
      throw new Error("Must be logged in to join a group");
    }

    console.log(`[NIP-29] Joining group ${groupId}`);

    const tags: string[][] = [
      ["h", groupId]
    ];

    if (options.inviteCode) {
      tags.push(["code", options.inviteCode]);
    }

    const event = await user!.signer.signEvent({
      kind: 9021, // GROUP_USER_JOIN_REQUEST
      tags,
      content: options.message || "",
      created_at: Math.floor(Date.now() / 1000),
    });

    if (!nostr) {
      throw new Error("Nostr client not available");
    }
    
    await nostr.event(event, { relays: [relay] });

    // Invalidate membership queries
    queryClient.invalidateQueries({ queryKey: ["nip29-members", groupId, relay] });
  }, [user, nostr, groupId, relay, queryClient]);

  // Leave a group
  const leaveGroup = useCallback(async () => {
    if (!user) {
      throw new Error("Must be logged in to leave a group");
    }

    console.log(`[NIP-29] Leaving group ${groupId}`);

    const event = await user!.signer.signEvent({
      kind: 9022, // GROUP_USER_LEAVE_REQUEST
      tags: [
        ["h", groupId]
      ],
      content: "",
      created_at: Math.floor(Date.now() / 1000),
    });

    if (!nostr) {
      throw new Error("Nostr client not available");
    }
    
    await nostr.event(event, { relays: [relay] });

    // Invalidate membership queries
    queryClient.invalidateQueries({ queryKey: ["nip29-members", groupId, relay] });
  }, [user, nostr, groupId, relay, queryClient]);

  // Admin operations
  const adminOperations = {
    // Add user to group
    addUser: useCallback(async (pubkey: string) => {
      if (!user) {
        throw new Error("Must be logged in to add users");
      }

      console.log(`[NIP-29] Adding user ${pubkey} to group ${groupId}`);

      const event = await user!.signer.signEvent({
        kind: 9000, // GROUP_ADD_USER
        tags: [
          ["h", groupId],
          ["p", pubkey]
        ],
        content: "",
        created_at: Math.floor(Date.now() / 1000),
      });

      if (!nostr) {
        throw new Error("Nostr client not available");
      }
      
      await nostr.event(event, { relays: [relay] });

      queryClient.invalidateQueries({ queryKey: ["nip29-members", groupId, relay] });
    }, [user, nostr, groupId, relay, queryClient]),

    // Remove user from group
    removeUser: useCallback(async (pubkey: string) => {
      if (!user) {
        throw new Error("Must be logged in to remove users");
      }

      console.log(`[NIP-29] Removing user ${pubkey} from group ${groupId}`);

      const event = await user!.signer.signEvent({
        kind: 9001, // GROUP_REMOVE_USER
        tags: [
          ["h", groupId],
          ["p", pubkey]
        ],
        content: "",
        created_at: Math.floor(Date.now() / 1000),
      });

      if (!nostr) {
        throw new Error("Nostr client not available");
      }
      
      await nostr.event(event, { relays: [relay] });

      queryClient.invalidateQueries({ queryKey: ["nip29-members", groupId, relay] });
    }, [user, nostr, groupId, relay, queryClient]),

    // Update group metadata
    updateMetadata: useCallback(async (metadata: {
      name?: string;
      about?: string;
      picture?: string;
      isPrivate?: boolean;
      isClosed?: boolean;
    }) => {
      if (!user) {
        throw new Error("Must be logged in to update group");
      }

      console.log(`[NIP-29] Updating group ${groupId} metadata`);

      const tags: string[][] = [
        ["h", groupId]
      ];

      if (metadata.name !== undefined) {
        tags.push(["name", metadata.name]);
      }

      if (metadata.about !== undefined) {
        tags.push(["about", metadata.about]);
      }

      if (metadata.picture !== undefined) {
        tags.push(["picture", metadata.picture]);
      }

      if (metadata.isPrivate !== undefined) {
        tags.push(["private", metadata.isPrivate ? "add" : "remove"]);
      }

      if (metadata.isClosed !== undefined) {
        tags.push(["closed", metadata.isClosed ? "add" : "remove"]);
      }

      const event = await user!.signer.signEvent({
        kind: 9002, // GROUP_EDIT_METADATA
        tags,
        content: "",
        created_at: Math.floor(Date.now() / 1000),
      });

      if (!nostr) {
        throw new Error("Nostr client not available");
      }
      
      await nostr.event(event, { relays: [relay] });

      queryClient.invalidateQueries({ queryKey: ["nip29-group", groupId, relay] });
    }, [user, nostr, groupId, relay, queryClient]),

    // Set user role
    setRole: useCallback(async (pubkey: string, role: string) => {
      if (!user) {
        throw new Error("Must be logged in to set roles");
      }

      console.log(`[NIP-29] Setting role ${role} for user ${pubkey} in group ${groupId}`);

      const event = await user!.signer.signEvent({
        kind: 9006, // GROUP_SET_ROLES
        tags: [
          ["h", groupId],
          ["p", pubkey, role]
        ],
        content: "",
        created_at: Math.floor(Date.now() / 1000),
      });

      if (!nostr) {
        throw new Error("Nostr client not available");
      }
      
      await nostr.event(event, { relays: [relay] });

      queryClient.invalidateQueries({ queryKey: ["nip29-members", groupId, relay] });
    }, [user, nostr, groupId, relay, queryClient]),

    // Delete event
    deleteEvent: useCallback(async (eventId: string, reason?: string) => {
      if (!user) {
        throw new Error("Must be logged in to delete events");
      }

      console.log(`[NIP-29] Deleting event ${eventId} from group ${groupId}`);

      const event = await user!.signer.signEvent({
        kind: 9005, // GROUP_DELETE_EVENT
        tags: [
          ["h", groupId],
          ["e", eventId]
        ],
        content: reason || "",
        created_at: Math.floor(Date.now() / 1000),
      });

      if (!nostr) {
        throw new Error("Nostr client not available");
      }
      
      await nostr.event(event, { relays: [relay] });

      // Invalidate post queries
      queryClient.invalidateQueries({ queryKey: ["nip29-posts", groupId, relay] });
    }, [user, nostr, groupId, relay, queryClient]),

    // Create invite code
    createInvite: useCallback(async (options: {
      maxUses?: number;
      expiresAt?: number;
    } = {}) => {
      if (!user) {
        throw new Error("Must be logged in to create invites");
      }

      console.log(`[NIP-29] Creating invite for group ${groupId}`);

      const tags: string[][] = [
        ["h", groupId]
      ];

      if (options.maxUses !== undefined) {
        tags.push(["max_uses", String(options.maxUses)]);
      }

      if (options.expiresAt !== undefined) {
        tags.push(["expires_at", String(options.expiresAt)]);
      }

      const event = await user!.signer.signEvent({
        kind: 9009, // GROUP_CREATE_INVITE
        tags,
        content: "",
        created_at: Math.floor(Date.now() / 1000),
      });

      if (!nostr) {
        throw new Error("Nostr client not available");
      }
      
      await nostr.event(event, { relays: [relay] });

      queryClient.invalidateQueries({ queryKey: ["nip29-invites", groupId, relay] });
    }, [user, nostr, groupId, relay, queryClient]),

    // Delete group
    deleteGroup: useCallback(async () => {
      if (!user) {
        throw new Error("Must be logged in to delete group");
      }

      console.log(`[NIP-29] Deleting group ${groupId}`);

      const event = await user!.signer.signEvent({
        kind: 9008, // GROUP_DELETE
        tags: [
          ["h", groupId]
        ],
        content: "",
        created_at: Math.floor(Date.now() / 1000),
      });

      if (!nostr) {
        throw new Error("Nostr client not available");
      }
      
      await nostr.event(event, { relays: [relay] });

      queryClient.invalidateQueries({ queryKey: ["nip29-groups"] });
      queryClient.invalidateQueries({ queryKey: ["nip29-group", groupId, relay] });
    }, [user, nostr, groupId, relay, queryClient])
  };

  // Post message to group
  const postMessage = useCallback(async (content: string, replyTo?: string) => {
    if (!user) {
      throw new Error("Must be logged in to post messages");
    }

    console.log(`[NIP-29] Posting message to group ${groupId}`);

    const tags: string[][] = [
      ["h", groupId]
    ];

    if (replyTo) {
      tags.push(["e", replyTo, relay, "reply"]);
    }

    const event = await user!.signer.signEvent({
      kind: 11, // Group chat message
      tags,
      content,
      created_at: Math.floor(Date.now() / 1000),
    });

    if (!nostr) {
      throw new Error("Nostr client not available");
    }
    
    await nostr.event(event, { relays: [relay] });

    queryClient.invalidateQueries({ queryKey: ["nip29-posts", groupId, relay] });
  }, [user, nostr, groupId, relay, queryClient]);

  // Report content
  const reportContent = useCallback(async (eventId: string, reason: string, type: string = 'other') => {
    if (!user) {
      throw new Error("Must be logged in to report content");
    }

    console.log(`[NIP-29] Reporting event ${eventId} in group ${groupId}`);

    const event = await user!.signer.signEvent({
      kind: 1984, // Report
      tags: [
        ["e", eventId],
        ["h", groupId],
        ["report", type],
        ["p", user.pubkey] // Reporter
      ],
      content: reason,
      created_at: Math.floor(Date.now() / 1000),
    });

    if (!nostr) {
      throw new Error("Nostr client not available");
    }
    
    await nostr.event(event, { relays: [relay] });

    queryClient.invalidateQueries({ queryKey: ["nip29-reports", groupId, relay] });
    toast.success("Content reported successfully");
  }, [user, nostr, groupId, relay, queryClient]);

  return {
    // Basic operations
    createGroup,
    joinGroup,
    leaveGroup,
    postMessage,
    reportContent,
    
    // Admin operations
    ...adminOperations
  };
}