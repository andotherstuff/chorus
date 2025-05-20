import { useNostr } from "@/hooks/useNostr";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Heart, Share2 } from "lucide-react";
import { NostrEvent } from "@nostrify/nostrify";
import { NoteContent } from "../NoteContent";
import { Link } from "react-router-dom";

interface ReplyListProps {
  postId: string;
  communityId: string;
}

export function ReplyList({ postId, communityId }: ReplyListProps) {
  const { nostr } = useNostr();
  
  // Query for replies to this post
  const { data: replies, isLoading } = useQuery({
    queryKey: ["post-replies", postId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Get replies (kind 1111) that reference this post
      const replyEvents = await nostr.query([{ 
        kinds: [1111],
        "#e": [postId],
        "#a": [communityId],
        limit: 100,
      }], { signal });
      
      return replyEvents.sort((a, b) => a.created_at - b.created_at);
    },
    enabled: !!nostr && !!postId,
  });
  
  if (isLoading) {
    return (
      <div className="space-y-3 pl-6 border-l-2 border-muted mt-2">
        {[1, 2].map((i) => (
          <Card key={i} className="bg-muted/30">
            <CardHeader className="flex flex-row items-center gap-4 pb-2 pt-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-16" />
              </div>
            </CardHeader>
            <CardContent className="pb-2 pt-0">
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  if (!replies || replies.length === 0) {
    return null;
  }
  
  return (
    <div className="space-y-3 pl-6 border-l-2 border-muted mt-2">
      {replies.map((reply) => (
        <ReplyItem 
          key={reply.id} 
          reply={reply}
        />
      ))}
    </div>
  );
}

interface ReplyItemProps {
  reply: NostrEvent;
}

function ReplyItem({ reply }: ReplyItemProps) {
  const author = useAuthor(reply.pubkey);
  
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || reply.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  
  return (
    <Card className="bg-muted/30">
      <CardHeader className="flex flex-row items-start gap-3 pb-2 pt-3">
        <Link to={`/profile/${reply.pubkey}`}>
          <Avatar className="cursor-pointer hover:opacity-80 transition-opacity h-8 w-8">
            <AvatarImage src={profileImage} />
            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <Link to={`/profile/${reply.pubkey}`} className="hover:underline">
                <p className="font-semibold text-sm">{displayName}</p>
              </Link>
              <div className="text-xs text-muted-foreground">
                {new Date(reply.created_at * 1000).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-2 pt-0">
        <div className="whitespace-pre-wrap break-words">
          <NoteContent event={reply} className="text-sm" />
        </div>
      </CardContent>
      
      <CardFooter className="py-1">
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" className="text-muted-foreground h-7">
            <Heart className="h-3 w-3 mr-1" />
            <span className="text-xs">Like</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground h-7">
            <Share2 className="h-3 w-3 mr-1" />
            <span className="text-xs">Share</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}