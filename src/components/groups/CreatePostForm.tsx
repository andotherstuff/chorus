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
import { Image, Loader2, Send, XCircle, Mic } from "lucide-react";
import { parseNostrAddress } from "@/lib/nostr-utils";
import { Link } from "react-router-dom";
import { AudioRecorder } from "@/components/AudioRecorder";
import { AudioPlayer } from "@/components/AudioPlayer";

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
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);

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

  const handleAudioRecording = (audioBlob: Blob, duration: number) => {
    const file = new File([audioBlob], `voice-memo-${Date.now()}.webm`, {
      type: 'audio/webm'
    });
    setAudioFile(file);
    setAudioDuration(duration);
    
    // Create preview URL for the audio
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
    setShowAudioRecorder(false);
  };

  const removeAudio = () => {
    setAudioFile(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioDuration(0);
  };

  const handleSubmit = async () => {
    if (!content.trim() && !imageFile && !audioFile) {
      toast.error("Please enter some content, add an image, or record a voice memo");
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
      let audioTags: string[][] = [];

      if (imageFile) {
        const tags = await uploadFile(imageFile);
        const [[_, imageUrl]] = tags;
        finalContent += `

${imageUrl}`;
        imageTags = tags;
      }

      if (audioFile) {
        const tags = await uploadFile(audioFile);
        const [[_, audioUrl]] = tags;
        finalContent += `

${audioUrl}`;
        audioTags = tags;
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
        ...audioTags,
        ...hashtagTags,
      ];

      await publishEvent({
        kind: 11,
        tags,
        content: finalContent,
      });

      setContent("");
      setImageFile(null);
      setPreviewUrl(null);
      setAudioFile(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      setAudioDuration(0);

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

            {audioUrl && (
              <div className="mt-1.5 relative">
                <AudioPlayer 
                  audioUrl={audioUrl} 
                  duration={audioDuration}
                  title="Voice Memo"
                  showDownload={false}
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-5 w-5"
                  onClick={removeAudio}
                >
                  <XCircle className="h-3 w-3"/>
                </Button>
              </div>
            )}

            {showAudioRecorder && (
              <div className="mt-1.5">
                <AudioRecorder
                  onRecordingComplete={handleAudioRecording}
                  onCancel={() => setShowAudioRecorder(false)}
                  maxDuration={300}
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between items-center border-t px-3 py-2">
        <div className="flex gap-1">
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
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground h-8 px-2 text-xs"
            onClick={() => setShowAudioRecorder(!showAudioRecorder)}
            disabled={isPublishing || isUploading}
          >
            <Mic className="h-3.5 w-3.5 mr-1" />
            Voice
          </Button>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isPublishing || isUploading || (!content.trim() && !imageFile && !audioFile)}
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
