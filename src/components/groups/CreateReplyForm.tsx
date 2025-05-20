import { useState } from "react";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

interface CreateReplyFormProps {
  postId: string;
  communityId: string;
  postAuthorPubkey: string;
  onReplyCreated?: () => void;
}

export function CreateReplyForm({ 
  postId, 
  communityId, 
  postAuthorPubkey,
  onReplyCreated 
}: CreateReplyFormProps) {
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent, isPending: isPublishing } = useNostrPublish();
  
  const [content, setContent] = useState("");
  
  if (!user) return null;
  
  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error("Please enter some content for your comment");
      return;
    }
    
    try {
      // Create reply event (kind 1111)
      const tags = [
        // Community reference
        ["a", communityId],
        // Reference to the parent post
        ["e", postId, "", "reply"],
        // Reference to the post author
        ["p", postAuthorPubkey],
        // Kind of the parent post
        ["k", "1"]
      ];
      
      // Publish the reply event
      await publishEvent({
        kind: 1111,
        tags,
        content,
      });
      
      // Reset form
      setContent("");
      
      // Notify parent component
      if (onReplyCreated) {
        onReplyCreated();
      }
      
      toast.success("Comment posted successfully!");
    } catch (error) {
      console.error("Error publishing reply:", error);
      toast.error("Failed to post comment. Please try again.");
    }
  };
  
  // Get user metadata using the useAuthor hook
  const author = useAuthor(user.pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || user.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  
  return (
    <div className="flex gap-2 mt-2 pl-6 border-l-2 border-muted">
      <Avatar className="h-8 w-8">
        <AvatarImage src={profileImage} />
        <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1 flex gap-2">
        <Textarea
          placeholder="Write a comment..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-12 text-sm resize-none flex-1"
        />
        
        <Button 
          onClick={handleSubmit}
          disabled={isPublishing || !content.trim()}
          size="sm"
          className="self-end"
        >
          {isPublishing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}