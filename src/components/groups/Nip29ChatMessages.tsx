import { useState } from "react";
import { useNip29ChatMessages, Nip29ChatMessage } from "@/hooks/useNip29ChatMessages";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useEnhancedNostr } from "@/components/EnhancedNostrProvider";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { MessageCircle, Send } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { NoteContent } from "../NoteContent";
import { Link } from "react-router-dom";
import { KINDS } from "@/lib/nostr-kinds";

interface Nip29ChatMessagesProps {
  groupId: string;
  relayUrl: string;
}

export function Nip29ChatMessages({ groupId, relayUrl }: Nip29ChatMessagesProps) {
  const { user } = useCurrentUser();
  const { nostr } = useEnhancedNostr();
  const queryClient = useQueryClient();
  const [messageContent, setMessageContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: messages = [],
    isLoading,
    error,
    refetch
  } = useNip29ChatMessages({
    groupId,
    relayUrl,
    enabled: !!groupId && !!relayUrl
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("You must be logged in to send messages");
      return;
    }

    if (!messageContent.trim()) {
      toast.error("Message cannot be empty");
      return;
    }

    setIsSubmitting(true);

    try {
      if (!nostr) {
        throw new Error("Nostr client not available");
      }

      const event = await user.signer.signEvent({
        kind: KINDS.NIP29_CHAT_MESSAGE, // Kind 9 for NIP-29 chat messages
        content: messageContent.trim(),
        tags: [
          ["h", groupId] // NIP-29 group tag
        ],
        created_at: Math.floor(Date.now() / 1000)
      });

      // Publish to the specific NIP-29 relay
      await nostr.event(event, { relays: [relayUrl] });

      setMessageContent("");
      toast.success("Message sent!");
      
      // Invalidate and refetch messages immediately
      queryClient.invalidateQueries({ queryKey: ['nip29-chat-messages', groupId, relayUrl] });
      refetch();
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Group Chat</h2>
        </div>
        
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Group Chat</h2>
        </div>
        
        <Card>
          <CardContent className="p-8 text-center">
            <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-muted-foreground">Failed to load chat messages</p>
            <Button variant="outline" onClick={() => refetch()} className="mt-2">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Group Chat</h2>
        <span className="text-sm text-muted-foreground">
          ({messages.length} message{messages.length !== 1 ? 's' : ''})
        </span>
      </div>

      {/* Chat Messages */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-96">
            {messages.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-muted-foreground">No messages yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Be the first to start the conversation!
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Message Composer */}
      {user ? (
        <Card>
          <form onSubmit={handleSendMessage}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <Textarea
                  placeholder="Type your message..."
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  rows={3}
                  className="resize-none"
                  disabled={isSubmitting}
                />
              </div>
            </CardContent>
            <CardFooter className="p-4 pt-0">
              <Button 
                type="submit" 
                disabled={isSubmitting || !messageContent.trim()}
                className="ml-auto"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? "Sending..." : "Send"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-muted-foreground">
              You must be logged in to send messages
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ChatMessageProps {
  message: Nip29ChatMessage;
}

function ChatMessage({ message }: ChatMessageProps) {
  const author = useAuthor(message.pubkey);
  const { user } = useCurrentUser();
  const metadata = author.data?.metadata;

  const displayName = metadata?.display_name || metadata?.name || message.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;
  const isOwnMessage = user?.pubkey === message.pubkey;
  
  return (
    <div className={`p-3 hover:bg-muted/50 transition-colors border-b border-border/50 ${
      isOwnMessage ? 'bg-primary/5' : ''
    }`}>
      <div className="flex gap-3">
        <Link to={`/profile/${message.pubkey}`}>
          <Avatar className="h-8 w-8 rounded-md">
            <AvatarImage src={profileImage} />
            <AvatarFallback className="text-xs">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link 
              to={`/profile/${message.pubkey}`}
              className="font-medium text-sm hover:underline"
            >
              {displayName}
            </Link>
            {isOwnMessage && (
              <span className="text-xs text-muted-foreground">you</span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(message.created_at)}
            </span>
          </div>
          
          <div className="text-sm">
            <NoteContent event={message} />
          </div>
        </div>
      </div>
    </div>
  );
}