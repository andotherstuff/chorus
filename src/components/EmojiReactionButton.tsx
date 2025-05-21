import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SmilePlus } from "lucide-react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { useTheme } from "@/hooks/useTheme";
import { useNostr } from "@/hooks/useNostr";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface EmojiReactionButtonProps {
  postId: string;
}

interface Reaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

export function EmojiReactionButton({ postId }: EmojiReactionButtonProps) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const [open, setOpen] = useState(false);
  const { theme } = useTheme();
  
  // Query to get all reactions for this event
  const { data: reactions, isLoading, refetch } = useQuery({
    queryKey: ["reactions", postId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      // Get all kind 7 reactions that reference this event
      const events = await nostr.query([{ 
        kinds: [7],
        "#e": [postId],
        limit: 100,
      }], { signal });
      
      return events;
    },
    enabled: !!nostr && !!postId,
  });

  // Process reactions to count each emoji
  const processedReactions = reactions?.reduce<Record<string, Reaction>>((acc, reaction) => {
    // Skip empty content or old "+" likes
    if (!reaction.content || reaction.content === "+") return acc;
    
    const emoji = reaction.content;
    
    if (!acc[emoji]) {
      acc[emoji] = {
        emoji,
        count: 0,
        hasReacted: false
      };
    }
    
    acc[emoji].count += 1;
    
    // Check if current user has reacted with this emoji
    if (user && reaction.pubkey === user.pubkey) {
      acc[emoji].hasReacted = true;
    }
    
    return acc;
  }, {}) || {};
  
  // Convert to array and sort by count (descending)
  const reactionsList = Object.values(processedReactions).sort((a, b) => b.count - a.count);
  
  // Handle emoji selection
  const handleEmojiClick = async (emojiData: EmojiClickData) => {
    if (!user) {
      toast.error("You must be logged in to react to posts");
      return;
    }

    try {
      // Create a reaction event (kind 7)
      await publishEvent({
        kind: 7,
        tags: [
          ["e", postId],
          ["k", "11"], // Assuming we're reacting to a kind 11 post
        ],
        content: emojiData.emoji, // The emoji character
      });
      
      // Refetch reactions to update the UI
      refetch();
      setOpen(false);
      
      toast.success("Reaction added!");
    } catch (error) {
      console.error("Error adding reaction:", error);
      toast.error("Failed to add reaction. Please try again.");
    }
  };

  // Handle clicking on an existing reaction
  const handleReactionClick = async (emoji: string, hasReacted: boolean) => {
    if (!user) {
      toast.error("You must be logged in to react to posts");
      return;
    }

    if (hasReacted) {
      // Find the user's reaction event with this emoji
      const userReaction = reactions?.find(
        reaction => reaction.pubkey === user.pubkey && reaction.content === emoji
      );
      
      if (!userReaction) {
        console.error("No reaction event found to remove");
        return;
      }
      
      try {
        // Create a deletion event (kind 5) that references the reaction event
        await publishEvent({
          kind: 5,
          tags: [
            ["e", userReaction.id], // Reference the reaction event to delete
          ],
          content: "Deleted reaction",
        });
        
        // Refetch reactions to update the UI
        refetch();
        
        toast.success("Reaction removed!");
      } catch (error) {
        console.error("Error removing reaction:", error);
        toast.error("Failed to remove reaction. Please try again.");
      }
    } else {
      // Add the reaction
      try {
        await publishEvent({
          kind: 7,
          tags: [
            ["e", postId],
            ["k", "11"], // Assuming we're reacting to a kind 11 post
          ],
          content: emoji,
        });
        
        // Refetch reactions to update the UI
        refetch();
        
        toast.success("Reaction added!");
      } catch (error) {
        console.error("Error adding reaction:", error);
        toast.error("Failed to add reaction. Please try again.");
      }
    }
  };

  return (
    <div className="flex items-center gap-1">
      {reactionsList.map((reaction) => (
        <Button
          key={reaction.emoji}
          variant="ghost"
          size="sm"
          className={`${
            reaction.hasReacted ? 'bg-muted/50' : ''
          } flex items-center h-7 px-2 rounded-full text-sm`}
          onClick={() => handleReactionClick(reaction.emoji, reaction.hasReacted)}
          disabled={isLoading || !user}
        >
          <span className="mr-1">{reaction.emoji}</span>
          <span className="text-xs">{reaction.count}</span>
        </Button>
      ))}
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground flex items-center h-7 px-2"
            disabled={isLoading || !user}
          >
            <SmilePlus className="h-3.5 w-3.5 mr-1" />
            <span className="text-xs">React</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 border-none shadow-lg" align="start">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
            width="100%"
            height="350px"
            searchPlaceHolder="Search emoji..."
            previewConfig={{ showPreview: false }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}