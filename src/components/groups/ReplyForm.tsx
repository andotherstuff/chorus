import { useState } from "react";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { useApprovedMembers } from "@/hooks/useApprovedMembers";
import { useUploadFile } from "@/hooks/useUploadFile";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Send, AlertTriangle, Image, Mic, XCircle } from "lucide-react";
import { NostrEvent } from "@nostrify/nostrify";
import { Link } from "react-router-dom";
import { AudioRecorder } from "@/components/AudioRecorder";
import { AudioPlayer } from "@/components/AudioPlayer";

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
  const { mutateAsync: publishEvent, isPending: isPublishing } = useNostrPublish({
    invalidateQueries: [
      { queryKey: ["replies", postId] },
      { queryKey: ["pending-replies", communityId] },
      ...(parentId ? [{ queryKey: ["nested-replies", parentId] }] : [])
    ],
    onSuccessCallback: onReplySubmitted
  });
  const { isApprovedMember } = useApprovedMembers(communityId);
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
  
  // Check if the current user is an approved member or moderator
  const isUserApproved = isApprovedMember(user.pubkey);

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
      // Determine if this is a direct reply to the post or a nested reply
      const replyToId = parentId || postId;
      const replyToPubkey = parentAuthorPubkey || postAuthorPubkey;
      
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
      
      // Create tags for the reply
      const tags = [
        // Community reference
        ["a", communityId],
        
        // Root post reference (uppercase tags)
        ["E", postId],
        ["K", "11"], // Original post is kind 11
        ["P", postAuthorPubkey],
        
        // Parent reference (lowercase tags)
        ["e", replyToId],
        ["k", parentId ? "1111" : "11"], // Parent is either a reply (1111) or the original post (11)
        ["p", replyToPubkey],
        
        // Media tags
        ...imageTags,
        ...audioTags,
        
        // Hashtag tags
        ...hashtagTags,
      ];
      
      // Publish the reply event (kind 1111)
      await publishEvent({
        kind: 1111,
        tags,
        content: finalContent,
      });
      
      // Reset form
      setContent("");
      setImageFile(null);
      setPreviewUrl(null);
      setAudioFile(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      setAudioDuration(0);
      
      if (isUserApproved) {
        toast.success("Reply posted successfully!");
      } else {
        toast.success("Reply submitted for moderator approval!");
      }
    } catch (error) {
      console.error("Error publishing reply:", error);
      toast.error("Failed to post reply. Please try again.");
    }
  };
  
  return (
    <div className={`flex gap-2.5 ${isNested ? 'pl-2' : ''}`}>
      <Link to={`/profile/${user.pubkey}`} className="flex-shrink-0">
        <Avatar className="h-9 w-9 cursor-pointer hover:opacity-80 transition-opacity rounded-md">
          <AvatarImage src={profileImage} />
          <AvatarFallback>{displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      </Link>
      
      <div className="flex-1 flex flex-col gap-2">
        <Textarea
          placeholder="Write a reply..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-20 resize-none"
        />

        {previewUrl && (
          <div className="relative">
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
          <div className="relative">
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
          <AudioRecorder
            onRecordingComplete={handleAudioRecording}
            onCancel={() => setShowAudioRecorder(false)}
            maxDuration={300}
          />
        )}
        
        {!isUserApproved && (
          <div className="text-xs flex items-center text-amber-600 dark:text-amber-400 mb-1">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Your reply will require moderator approval
          </div>
        )}
        
        <div className="flex justify-between items-center">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="text-muted-foreground h-8 px-2 text-xs" asChild>
              <label htmlFor={`reply-image-upload-${postId}-${parentId || ''}`} className="cursor-pointer flex items-center">
                <Image className="h-3.5 w-3.5 mr-1" />
                Photo
                <input
                  id={`reply-image-upload-${postId}-${parentId || ''}`}
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
            size="sm"
            onClick={handleSubmit}
            disabled={isPublishing || isUploading || (!content.trim() && !imageFile && !audioFile)}
            className="h-8"
          >
            {isPublishing || isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Reply
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}