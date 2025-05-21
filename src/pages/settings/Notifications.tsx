import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/ui/Header";
import { Bell } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { useNotifications, useMarkNotificationAsRead } from "@/hooks/useNotifications";
import type { Notification } from "@/hooks/useNotifications";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthor } from "@/hooks/useAuthor";
import { formatDistanceToNow } from "date-fns";
import { GroupReference } from "@/components/groups/GroupReference";

export default function Notifications() {
  const { user } = useCurrentUser();
  const { data: notifications = [], isLoading, refetch } = useNotifications();
  const markAsRead = useMarkNotificationAsRead();

  // Mark all notifications as read when the page is viewed
  useEffect(() => {
    for (const notification of notifications) {
      if (!notification.read) {
        markAsRead(notification.id);
      }
    }

    // Refetch after marking as read to update the UI
    const timer = setTimeout(() => {
      refetch();
    }, 500);

    return () => clearTimeout(timer);
  }, [markAsRead, notifications, refetch]);

  const NotificationItem = ({ notification }: { notification: Notification }) => {
    const { data: authorData } = useAuthor(notification.pubkey || "");
    const authorName = authorData?.metadata?.name || notification.pubkey?.slice(0, 8) || "Unknown";
    const authorPicture = authorData?.metadata?.picture;

    let linkTo = "";

    switch (notification.type) {
      case "group_update":
      case "post_approved":
      case "post_removed":
        if (notification.groupId) {
          linkTo = `/group/${notification.groupId}`;
        }
        break;
      case "tag_post":
      case "tag_reply":
      case "reaction":
        if (notification.eventId) {
          // In a real app, this would link to the specific post
          linkTo = `/group/${notification.groupId || ""}`;
        }
        break;
      case "join_request":
        if (notification.groupId) {
          linkTo = `/group/${notification.groupId}/settings`;
        }
        break;
    }

    // Redirect to home if user is not logged in
    if (!user) {
      return <Navigate to="/" />;
    }

    return (
      <Card className={`mb-4 ${notification.read ? 'opacity-70' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {notification.pubkey && (
              <Avatar className="w-10 h-10">
                <AvatarImage src={authorPicture} />
                <AvatarFallback>{authorName[0]}</AvatarFallback>
              </Avatar>
            )}
            {!notification.pubkey && (
              <div className="w-10 h-10 flex items-center justify-center bg-primary/10 rounded-full">
                <Bell className="w-5 h-5 text-primary" />
              </div>
            )}
            <div className="flex-1">
              <div className="font-medium">
                {notification.pubkey && (notification.type === 'reaction' || notification.type === 'tag_post' || notification.type === 'tag_reply' || notification.type === 'post_approved' || notification.type === 'post_removed') ? `${authorName} ` : ''}
                {notification.message}
                {notification.pubkey && (notification.type !== 'reaction' && notification.type !== 'tag_post' && notification.type !== 'tag_reply' && notification.type !== 'post_approved' && notification.type !== 'post_removed') && ` from ${authorName}`}
                {notification.groupId && <GroupReference groupId={notification.groupId} />}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDistanceToNow(notification.createdAt * 1000, { addSuffix: true })}
              </div>
              {linkTo && notification.groupId && (
                <Button variant="link" className="p-0 h-auto mt-1" asChild>
                  <Link to={linkTo}>View details</Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto py-4 px-6">
      <Header />
      <div className="space-y-6 my-6">
        <Card>
          <CardHeader>
            <CardTitle>Your Notifications</CardTitle>
            <CardDescription>
              Stay updated on activity related to your account and groups
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                You don't have any notifications yet
              </div>
            ) : (
              <div>
                {notifications.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
