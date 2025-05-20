import { useState } from "react";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useAuthor } from "@/hooks/useAuthor";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Image, Loader2, Send } from "lucide-react";
import { parseNostrAddress } from "@/lib/nostr-utils";
import { Link } from "react-router-dom";

interface CreatePostFormProps {
  communityId: string;
}

export function CreatePostForm({ communityId }: CreatePostFormProps) {
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent, isPending: isPublishing } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  if (!user) return null;
  
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSubmit = async () => {
    if (!content.trim() && !imageFile) {
      toast.error("Please enter some content or add an image");
      return;
    }
    
    try {
      // Parse the community ID
      const parsedId = parseNostrAddress(communityId);
      if (!parsedId) {
        toast.error("Invalid community ID");
        return;
      }
      
      let finalContent = content;
      let imageTags: string[][] = [];
      
      // Upload image if selected
      if (imageFile) {
        const tags = await uploadFile(imageFile);
        const [[_, imageUrl]] = tags;
        
        // Add image URL to content
        finalContent += `\n\n${imageUrl}`;
        
        // Add image tags
        imageTags = tags;
      }
      
      // Create post event (kind 1)
      const tags = [
        // Community reference
        ["a", communityId],
        // Add image tags if any
        ...imageTags,
      ];
      
      // Publish the post event
      await publishEvent({
        kind: 1,
        tags,
        content: finalContent,
      });
      
      // Reset form
      setContent("");
      setImageFile(null);
      setPreviewUrl(null);
      
      toast.success("Post published successfully!");
    } catch (error) {
      console.error("Error publishing post:", error);
      toast.error("Failed to publish post. Please try again.");
    }
  };
  
  // Get user metadata using the useAuthor hook
  const author = useAuthor(user.pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || user.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex gap-4">
          <Link to={`/profile/${user.pubkey}`}>
            <Avatar className="cursor-pointer hover:opacity-80 transition-opacity">
              <AvatarImage src={profileImage} />
              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>
          
          <div className="flex-1">
            <Textarea
              placeholder={`What's on your mind, ${displayName.split(' ')[0]}?`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-24 resize-none"
            />
            
            {previewUrl && (
              <div className="mt-3 relative">
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="max-h-60 rounded-md object-contain"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => {
                    setImageFile(null);
                    setPreviewUrl(null);
                  }}
                >
                  ✕
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between border-t pt-4">
        <div>
          <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
            <label htmlFor="image-upload" className="cursor-pointer">
              <Image className="h-4 w-4 mr-2" />
              Photo
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </label>
          </Button>
        </div>
        
        <Button 
          onClick={handleSubmit}
          disabled={isPublishing || isUploading || (!content.trim() && !imageFile)}
        >
          {isPublishing || isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Posting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Post
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}