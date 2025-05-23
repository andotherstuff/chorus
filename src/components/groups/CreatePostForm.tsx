import { useState, useEffect } from "react";
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
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Clean up object URLs when component unmounts or preview changes
  useEffect(() => {
    return () => {
      if (previewUrl && (mediaFile?.type.startsWith('video/') || mediaFile?.type.startsWith('audio/'))) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, mediaFile]);

  if (!user) return null;

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      
      // Clean up previous object URL if it exists
      if (previewUrl && (mediaFile?.type.startsWith('video/') || mediaFile?.type.startsWith('audio/'))) {
        URL.revokeObjectURL(previewUrl);
      }
      
      setMediaFile(file);

      // For videos and audio, use object URL for preview
      if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        // For images, use FileReader as before
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() && !mediaFile) {
      toast.error("Please enter some content or add media");
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

      if (mediaFile) {
        const tags = await uploadFile(mediaFile);
        const [[_, mediaUrl]] = tags;
        finalContent += `

${mediaUrl}`;
        imageTags = tags;
      }

      // Extract hashtags from content and create 't' tags
      const hashtagMatches = content.match(/#(\w+)/g);
      const hashtagTags: string[][] = hashtagMatches 
        ? hashtagMatches.map(hashtag => ["t", hashtag.slice(1).toLowerCase()])
        : [];

      const tags = [
        ["a", communityId],
        ["subject", `Post in ${parsedId?.identifier || 'group'}`],
        ...imageTags,
        ...hashtagTags,
      ];

      await publishEvent({
        kind: 11,
        tags,
        content: finalContent,
      });

      setContent("");
      setMediaFile(null);
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
                {mediaFile?.type.startsWith('video/') ? (
                  <video
                    src={previewUrl}
                    controls
                    className="max-h-52 rounded-md object-contain border w-full"
                  />
                ) : mediaFile?.type.startsWith('audio/') ? (
                  <audio
                    src={previewUrl}
                    controls
                    className="w-full rounded-md border"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-52 rounded-md object-contain border"
                  />
                )}
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-5 w-5"
                  onClick={() => {
                    // Clean up object URL if it's a video or audio
                    if (previewUrl && (mediaFile?.type.startsWith('video/') || mediaFile?.type.startsWith('audio/'))) {
                      URL.revokeObjectURL(previewUrl);
                    }
                    setMediaFile(null);
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
            <label htmlFor="media-upload" className="cursor-pointer flex items-center">
              <Image className="h-3.5 w-3.5 mr-1" />
              Media
              <input
                id="media-upload"
                type="file"
                accept="image/*,video/*,audio/*"
                onChange={handleMediaSelect}
                className="hidden"
              />
            </label>
          </Button>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isPublishing || isUploading || (!content.trim() && !mediaFile)}
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
