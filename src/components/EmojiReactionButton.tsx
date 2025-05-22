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
  showText?: boolean;
}

interface Reaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

export function EmojiReactionButton({ postId, showText = true }: EmojiReactionButtonProps) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish({
    invalidateQueries: [
      { queryKey: ["reactions", postId] }
    ]
  });
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
  
  // Calculate total reactions count
  const totalReactionsCount = Object.values(processedReactions).reduce((sum, reaction) => sum + reaction.count, 0);
  
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
      
      // Close the emoji picker
      setOpen(false);
      
      toast.success("Reaction added!");
    } catch (error) {
      console.error("Error adding reaction:", error);
      toast.error("Failed to add reaction. Please try again.");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground flex items-center h-7 px-1.5"
          disabled={isLoading || !user}
        >
          <SmilePlus className={`h-3.5 w-3.5`} />
          {totalReactionsCount > 0 && (
            <span className="text-xs ml-0.5">{totalReactionsCount}</span>
          )}
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
  );
}