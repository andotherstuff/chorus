// ABOUTME: This component provides a consistent way to display group avatars with proper error handling
// ABOUTME: It includes fallback behavior for failed image loads and different displays for NIP-29 vs NIP-72 groups

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Group } from "@/types/groups";

interface GroupAvatarProps {
  group: Group;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showTypeIcon?: boolean;
}

export function GroupAvatar({ 
  group, 
  size = "md", 
  className,
  showTypeIcon = true 
}: GroupAvatarProps) {
  const [imageState, setImageState] = useState<"loading" | "success" | "error">("loading");
  
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
    xl: "h-24 w-24",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-5 w-5",
    lg: "h-7 w-7",
    xl: "h-10 w-10",
  };

  const getInitials = () => {
    if (!group.name) return "G";
    return group.name
      .split(" ")
      .map(word => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  useEffect(() => {
    if (!group.image) {
      setImageState("error");
      return;
    }

    // Pre-load the image to check if it loads successfully
    const img = new Image();
    
    img.onload = () => {
      setImageState("success");
    };

    img.onerror = () => {
      setImageState("error");
    };

    img.src = group.image;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [group.image]);

  const showFallback = imageState !== "success";

  return (
    <Avatar className={cn(sizeClasses[size], "rounded-md", className)}>
      {!showFallback && (
        <AvatarImage 
          src={group.image} 
          alt={group.name || "Group"} 
        />
      )}
      <AvatarFallback className="bg-primary/10 text-primary font-medium rounded-md">
        {showTypeIcon && group.type === "nip29" ? (
          <Lock className={iconSizes[size]} />
        ) : group.type === "nip72" ? (
          <Users className={iconSizes[size]} />
        ) : (
          getInitials()
        )}
      </AvatarFallback>
    </Avatar>
  );
}