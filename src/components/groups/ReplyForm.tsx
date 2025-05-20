import { useState } from "react";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { NostrEvent } from "@nostrify/nostrify";
import { Link } from "react-router-dom";

interface ReplyFormProps {
  postId: string;
  communityId: string;
  postAuthorPubkey: string;
  parentId?: string; // Optional: for nested replies
  parentAuthorPubkey?: string; // Optional: for nested replies
  onReplySubmitted?: () => void; // Callback when reply is submitted
  isNested?: boolean; // Whether this is a nested reply form
}

export function ReplyForm({ 
  postId, 
  communityId, 
  postAuthorPubkey,
  parentId,
  parentAuthorPubkey,
  onReplySubmitted,
  isNested = false
}: ReplyFormProps) {
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent, isPending: isPublishing } = useNostrPublish();
  
  const [content, setContent] = useState("");
  
  if (!user) return null;
  
  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error("Please enter some content for your reply");
      return;
    }
    
    try {
      // Determine if this is a direct reply to the post or a nested reply
      const replyToId = parentId || postId;
      const replyToPubkey = parentAuthorPubkey || postAuthorPubkey;
      
      // Create tags for the reply
      const tags = [
        // Community reference
        ["a", communityId],
        
        // Root post reference (uppercase tags)
        ["E", postId],
        ["K", "11"], // Original post is kind 11 (or 1 for backward compatibility)
        ["P", postAuthorPubkey],
        
        // Parent reference (lowercase tags)
        ["e", replyToId],
        ["k", parentId ? "1111" : "11"], // Parent is either a reply (1111) or the original post (11 or 1)
        ["p", replyToPubkey],
      ];
      
      // Publish the reply event (kind 1111)
      await publishEvent({
        kind: 1111,
        tags,
        content,
      });
      
      // Reset form
      setContent("");
      
      // Call the callback if provided
      if (onReplySubmitted) {
        onReplySubmitted();
      }
      
      toast.success("Reply posted successfully!");
    } catch (error) {
      console.error("Error publishing reply:", error);
      toast.error("Failed to post reply. Please try again.");
    }
  };
  
  // Get user metadata using the useAuthor hook
  const author = useAuthor(user.pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || user.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  
  return (
    <div className={`flex gap-3 ${isNested ? 'pl-6' : ''}`}>
      <Link to={`/profile/${user.pubkey}`}>
        <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
          <AvatarImage src={profileImage} />
          <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      </Link>
      
      <div className="flex-1 flex flex-col gap-2">
        <Textarea
          placeholder="Write a reply..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-20 resize-none text-sm"
        />
        
        <div className="flex justify-end">
          <Button 
            size="sm"
            onClick={handleSubmit}
            disabled={isPublishing || !content.trim()}
          >
            {isPublishing ? (
              <>
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <Send className="h-3 w-3 mr-2" />
                Reply
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}