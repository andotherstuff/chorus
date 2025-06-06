import { useState, useEffect, useRef } from "react";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { useApprovedMembers } from "@/hooks/useApprovedMembers";
import { useUploadFile } from "@/hooks/useUploadFile";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Send, AlertTriangle, Image, Mic, Square, XCircle } from "lucide-react";
import { NostrEvent } from "@jsr/nostrify__nostrify";
import { Link } from "react-router-dom";
import { KINDS } from "@/lib/nostr-kinds";

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
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { isApprovedMember } = useApprovedMembers(communityId);
  
  // Move useAuthor hook before any conditional returns
  const author = useAuthor(user?.pubkey || '');
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || user?.pubkey.slice(0, 8) || '';
  const profileImage = metadata?.picture;
  
  const [content, setContent] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up object URLs when component unmounts or preview changes
  useEffect(() => {
    return () => {
      if (previewUrl && (mediaFile?.type.startsWith('video/') || mediaFile?.type.startsWith('audio/'))) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, mediaFile]);

  // Clean up recording interval on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);
  
  if (!user) return null;
  
  // Check if the current user is an approved member or moderator
  const isUserApproved = isApprovedMember(user.pubkey);
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Try to use audio-specific MIME types in order of preference
      const audioMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus', 
        'audio/mp4',
        'audio/webm'  // fallback
      ];
      
      let selectedMimeType = 'audio/webm';
      for (const mimeType of audioMimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Get the MIME type that was actually used
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        
        // Determine file extension based on MIME type
        let extension = 'webm';
        if (mimeType.includes('ogg')) {
          extension = 'ogg';
        } else if (mimeType.includes('mp4')) {
          extension = 'm4a';
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioFile = new File([audioBlob], `voice_memo_${Date.now()}.${extension}`, { type: mimeType });
        
        // Clean up previous media if any
        if (previewUrl && (mediaFile?.type.startsWith('video/') || mediaFile?.type.startsWith('audio/'))) {
          URL.revokeObjectURL(previewUrl);
        }
        
        setMediaFile(audioFile);
        // Create URL from the blob instead of the file for better compatibility
        const url = URL.createObjectURL(audioBlob);
        setPreviewUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration counter
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
      toast.error("Please enter some content or add media for your reply");
      return;
    }
    
    try {
      // Determine if this is a direct reply to the post or a nested reply
      const replyToId = parentId || postId;
      const replyToPubkey = parentAuthorPubkey || postAuthorPubkey;
      
      // Add mic emoji to content if this is a voice recording
      let baseContent = content;
      if (mediaFile && mediaFile.name.includes('voice_memo')) {
        baseContent = `🎤 ${content}`.trim();
      }
      
      let finalContent = baseContent;
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
        
        // Hashtag tags
        ...hashtagTags,
      ];
      
      // Publish the reply event (kind 1111)
      await publishEvent({
        kind: KINDS.GROUP_POST_REPLY,
        tags,
        content: finalContent,
      });
      
      // Reset form
      setContent("");
      setMediaFile(null);
      setPreviewUrl(null);
      
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
            {mediaFile?.type.startsWith('video/') ? (
              <video
                src={previewUrl}
                controls
                className="max-h-32 rounded-md object-contain border w-full"
              />
            ) : mediaFile?.type.startsWith('audio/') ? (
              <div className="bg-secondary/50 rounded-md border p-2 flex items-center gap-2">
                {mediaFile.name.includes('voice_memo') ? (
                  <>
                    <div className="bg-green-500/10 rounded-full p-1.5">
                      <Mic className="h-3.5 w-3.5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">Voice Recording</div>
                      <div className="text-xs text-muted-foreground">
                        Ready • {(mediaFile.size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{mediaFile.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Audio • {(mediaFile.size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                    <audio
                      src={previewUrl}
                      controls
                      className="h-8"
                      style={{ width: '150px' }}
                      onError={(e) => {
                        console.error('Audio preview error:', e);
                      }}
                    />
                  </>
                )}
              </div>
            ) : (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-32 rounded-md object-contain border"
              />
            )}
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-5 w-5"
              onClick={() => {
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
        
        {!isUserApproved && (
          <div className="text-xs flex items-center text-amber-600 dark:text-amber-400 mb-1">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Your reply will require moderator approval
          </div>
        )}
        
        <div className="flex justify-between items-center">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="text-muted-foreground h-7 px-2 text-xs" asChild>
              <label htmlFor={`reply-media-upload-${postId}-${parentId || ''}`} className="cursor-pointer flex items-center">
                <Image className="h-3 w-3 mr-1" />
                Media
                <input
                  id={`reply-media-upload-${postId}-${parentId || ''}`}
                  type="file"
                  accept="image/*,video/*,audio/*"
                  onChange={handleMediaSelect}
                  className="hidden"
                  disabled={isRecording}
                />
              </label>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className={`text-muted-foreground h-7 px-2 text-xs ${isRecording ? 'text-red-500' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isPublishing || isUploading}
            >
              {isRecording ? (
                <>
                  <Square className="h-3 w-3 mr-1 fill-current" />
                  {formatDuration(recordingDuration)}
                </>
              ) : (
                <>
                  <Mic className="h-3 w-3 mr-1" />
                  Record
                </>
              )}
            </Button>
          </div>
          
          <Button 
            size="sm"
            onClick={handleSubmit}
            disabled={isPublishing || isUploading || (!content.trim() && !mediaFile)}
            className="h-7 text-xs"
          >
            {isPublishing || isUploading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <Send className="h-3 w-3 mr-1" />
                Reply
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}