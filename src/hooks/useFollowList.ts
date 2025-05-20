import { useNostr } from '@/hooks/useNostr';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { NostrEvent } from '@nostrify/nostrify';

export function useFollowList(pubkey?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  // Get the follow list for the specified pubkey or the current user
  const targetPubkey = pubkey || user?.pubkey;

  // Query to get the follow list
  const followListQuery = useQuery<{ followList: string[], event: NostrEvent | null }>({
    queryKey: ['follow-list', targetPubkey],
    queryFn: async ({ signal }) => {
      if (!targetPubkey || !nostr) {
        return { followList: [], event: null };
      }

      const abortSignal = AbortSignal.any([signal, AbortSignal.timeout(5000)]);
      
      // Get the most recent kind 3 event for the user
      const [event] = await nostr.query(
        [{ kinds: [3], authors: [targetPubkey], limit: 1 }],
        { signal: abortSignal }
      );

      if (!event) {
        return { followList: [], event: null };
      }

      // Extract the list of followed pubkeys from the p tags
      const followList = event.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);

      return { followList, event };
    },
    enabled: !!targetPubkey && !!nostr,
  });

  // Check if the current user is following a specific pubkey
  const isFollowing = (targetToCheck: string): boolean => {
    if (!followListQuery.data?.followList) return false;
    return followListQuery.data.followList.includes(targetToCheck);
  };

  // Mutation to follow/unfollow a user
  const followMutation = useMutation({
    mutationFn: async ({ 
      targetToFollow, 
      follow 
    }: { 
      targetToFollow: string; 
      follow: boolean;
    }) => {
      if (!user) {
        throw new Error('You must be logged in to follow users');
      }

      // Get the current follow list
      const { followList = [], event } = followListQuery.data || {};
      
      // Create a new follow list based on the action (follow or unfollow)
      let newFollowList: string[];
      
      if (follow) {
        // Add the target to the follow list if not already following
        if (followList.includes(targetToFollow)) {
          return { success: true, alreadyFollowing: true };
        }
        newFollowList = [...followList, targetToFollow];
      } else {
        // Remove the target from the follow list
        newFollowList = followList.filter(pk => pk !== targetToFollow);
      }

      // Create tags for the new follow list
      const tags = newFollowList.map(pk => ['p', pk]);

      // Publish the new follow list event
      await publishEvent({
        kind: 3,
        tags,
        content: '',
      });

      return { success: true, alreadyFollowing: false };
    },
    onSuccess: (result, variables) => {
      // Invalidate the follow list query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['follow-list', user?.pubkey] });
      
      if (variables.follow) {
        if (result.alreadyFollowing) {
          toast.info('You are already following this user');
        } else {
          toast.success('User followed successfully');
        }
      } else {
        toast.success('User unfollowed successfully');
      }
    },
    onError: (error) => {
      console.error('Error updating follow list:', error);
      toast.error('Failed to update follow list. Please try again.');
    },
  });

  // Function to follow a user
  const followUser = (targetToFollow: string) => {
    followMutation.mutate({ targetToFollow, follow: true });
  };

  // Function to unfollow a user
  const unfollowUser = (targetToFollow: string) => {
    followMutation.mutate({ targetToFollow, follow: false });
  };

  return {
    followList: followListQuery.data?.followList || [],
    isFollowing,
    followUser,
    unfollowUser,
    isLoading: followListQuery.isLoading,
    isPending: followMutation.isPending,
  };
}