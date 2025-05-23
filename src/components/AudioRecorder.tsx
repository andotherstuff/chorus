import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Pause, X, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
  maxDuration?: number; // Maximum recording duration in seconds
}

export function AudioRecorder({ onRecordingComplete, onCancel, maxDuration = 300 }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [audioUrl]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            stopRecording();
            toast.info(`Maximum recording duration of ${maxDuration} seconds reached`);
          }
          return newTime;
        });
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Failed to access microphone. Please check your permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      // Resume timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            stopRecording();
            toast.info(`Maximum recording duration of ${maxDuration} seconds reached`);
          }
          return newTime;
        });
      }, 1000);
    }
  };

  const playPauseAudio = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleConfirm = async () => {
    if (!audioUrl) return;

    try {
      const response = await fetch(audioUrl);
      const audioBlob = await response.blob();
      
      // Convert to a more compatible format if needed
      const audioFile = new File([audioBlob], `voice-memo-${Date.now()}.webm`, {
        type: 'audio/webm'
      });
      
      onRecordingComplete(audioFile, recordingTime);
    } catch (error) {
      console.error("Error processing audio:", error);
      toast.error("Failed to process audio recording");
    }
  };

  const handleCancel = () => {
    if (isRecording) {
      stopRecording();
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    onCancel();
  };

  return (
    <div className="bg-background border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Voice Memo</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCancel}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col items-center space-y-4">
        {/* Recording/Playback Status */}
        <div className="text-center">
          <div className="text-2xl font-mono">{formatTime(recordingTime)}</div>
          <div className="text-xs text-muted-foreground">
            {isRecording ? (isPaused ? "Paused" : "Recording...") : "Ready to record"}
          </div>
        </div>

        {/* Recording Controls */}
        {!audioUrl ? (
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                size="lg"
                className="rounded-full"
              >
                <Mic className="h-5 w-5 mr-2" />
                Start Recording
              </Button>
            ) : (
              <>
                {!isPaused ? (
                  <Button
                    onClick={pauseRecording}
                    variant="secondary"
                    size="icon"
                    className="rounded-full h-12 w-12"
                  >
                    <Pause className="h-5 w-5" />
                  </Button>
                ) : (
                  <Button
                    onClick={resumeRecording}
                    variant="secondary"
                    size="icon"
                    className="rounded-full h-12 w-12"
                  >
                    <Play className="h-5 w-5" />
                  </Button>
                )}
                <Button
                  onClick={stopRecording}
                  variant="destructive"
                  size="icon"
                  className="rounded-full h-12 w-12"
                >
                  <Square className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <Button
                onClick={playPauseAudio}
                variant="secondary"
                size="icon"
                className="rounded-full h-12 w-12"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
            </div>

            {/* Hidden audio element */}
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
            />

            {/* Action Buttons */}
            <div className="flex items-center gap-2 w-full">
              <Button
                onClick={() => {
                  setAudioUrl(null);
                  setRecordingTime(0);
                  audioChunksRef.current = [];
                }}
                variant="outline"
                className="flex-1"
              >
                Re-record
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Recording hint */}
      {!isRecording && !audioUrl && (
        <p className="text-xs text-center text-muted-foreground">
          Click "Start Recording" to record a voice memo (max {maxDuration}s)
        </p>
      )}
    </div>
  );
}