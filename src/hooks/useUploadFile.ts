import { useMutation } from "@tanstack/react-query";
import { BlossomUploader } from '@jsr/nostrify__nostrify/uploaders';

import { useCurrentUser } from "./useCurrentUser";

export function useUploadFile() {
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) {
        throw new Error('Must be logged in to upload files');
      }

      const uploader = new BlossomUploader({
        servers: [
          'https://blossom.primal.net/',
        ],
        signer: user.signer,
      });

      const tags = await uploader.upload(file);
      
      // Check if this is an audio file
      const isAudioFile = file.type.startsWith('audio/');
      
      // Override mime-type for audio files if Blossom returns video/webm
      if (isAudioFile) {
        // Tags are in format: [["url", "https://..."], ["m", "video/webm"], ...]
        // Find and update the mime-type tag
        const updatedTags = tags.map(tag => {
          if (tag[0] === 'm' && tag[1] === 'video/webm') {
            // Override video/webm with audio/webm for audio files
            return ['m', 'audio/webm'];
          }
          return tag;
        });
        return updatedTags;
      }
      
      return tags;
    },
  });
}