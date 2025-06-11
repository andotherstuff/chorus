// ABOUTME: This component safely renders avatars without showing broken image icons
// ABOUTME: It wraps the Avatar component with conditional rendering of AvatarImage

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface SafeAvatarProps {
  src?: string | null;
  alt?: string;
  fallback: string;
  className?: string;
  fallbackClassName?: string;
}

export function SafeAvatar({ 
  src, 
  alt, 
  fallback, 
  className,
  fallbackClassName 
}: SafeAvatarProps) {
  return (
    <Avatar className={className}>
      {src && <AvatarImage src={src} alt={alt} />}
      <AvatarFallback className={fallbackClassName}>
        {fallback}
      </AvatarFallback>
    </Avatar>
  );
}