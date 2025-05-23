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
import { Image, Loader2, Send, XCircle } from "lucide-react"; // Added XCircle
import { parseNostrAddress } from "@/lib/nostr-utils";
import { Link } from "react-router-dom";

interface CreatePostFormProps {
  communityId: string;
  onPostSuccess?: () => void;
}

export function CreatePostForm({ communityId, onPostSuccess }: CreatePostFormProps) {
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent, isPending: isPublishing } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  
  // Move useAuthor hook before any conditional returns
  const author = useAuthor(user?.pubkey || '');
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || user?.pubkey.slice(0, 8) || '';
  const profileImage = metadata?.picture;

  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (!user) return null;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setImageFile(file);

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
      const parsedId = parseNostrAddress(communityId);
      if (!parsedId) {
        toast.error("Invalid group ID");
        return;
      }

      let finalContent = content;
      let imageTags: string[][] = [];

      if (imageFile) {
        const tags = await uploadFile(imageFile);
        const [[_, imageUrl]] = tags;
        finalContent += `

${imageUrl}`;
        imageTags = tags;
      }

      const tags = [
        ["a", communityId],
        ["subject", `Post in ${parsedId?.identifier || 'group'}`],
        ...imageTags,
      ];

      await publishEvent({
        kind: 11,
        tags,
        content: finalContent,
      });

      setContent("");
      setImageFile(null);
      setPreviewUrl(null);

      toast.success("Post published successfully!");
      
      // Call the onPostSuccess callback if provided
      if (onPostSuccess) {
        onPostSuccess();
      }
    } catch (error) {
      console.error("Error publishing post:", error);
      toast.error("Failed to publish post. Please try again.");
    }
  };

  return (
    <Card className="mb-4">
      <CardContent className="p-3">
        <div className="flex gap-2">
          <Link to={`/profile/${user.pubkey}`}>
            <Avatar className="h-10 w-10 cursor-pointer hover:opacity-80 transition-opacity rounded-md">
              <AvatarImage src={profileImage} />
              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>

          <div className="flex-1">
            <Textarea
              placeholder={`What's on your mind, ${displayName.split(' ')[0]}?`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-20 resize-none p-2"
            />

            {previewUrl && (
              <div className="mt-1.5 relative">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-52 rounded-md object-contain border"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-5 w-5"
                  onClick={() => {
                    setImageFile(null);
                    setPreviewUrl(null);
                  }}
                >
                  <XCircle className="h-3 w-3"/>
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between items-center border-t px-3 py-2">
        <div>
          <Button variant="ghost" size="sm" className="text-muted-foreground h-8 px-2 text-xs" asChild>
            <label htmlFor="image-upload" className="cursor-pointer flex items-center">
              <Image className="h-3.5 w-3.5 mr-1" />
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
          size="sm"
          className="h-8 px-3 text-xs"
        >
          {isPublishing || isUploading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Posting...
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Post
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
