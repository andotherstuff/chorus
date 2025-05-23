import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useNostr } from "@/hooks/useNostr";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, Edit } from "lucide-react";
import { parseNostrAddress } from "@/lib/nostr-utils";
import Header from "@/components/ui/Header";
import { KINDS } from "@/lib/nostr-kinds";

export default function GroupGuidelines() {
  const { groupId } = useParams<{ groupId: string }>();
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const [parsedId, setParsedId] = useState<{ kind: number; pubkey: string; identifier: string } | null>(null);

  useEffect(() => {
    if (groupId) {
      const parsed = parseNostrAddress(decodeURIComponent(groupId));
      if (parsed) {
        setParsedId(parsed);
      }
    }
  }, [groupId]);

  const { data: community, isLoading: isLoadingCommunity } = useQuery({
    queryKey: ["community", parsedId?.pubkey, parsedId?.identifier],
    queryFn: async (c) => {
      if (!parsedId) throw new Error("Invalid community ID");

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{
        kinds: [KINDS.GROUP],
        authors: [parsedId.pubkey],
        "#d": [parsedId.identifier]
      }], { signal });

      if (events.length === 0) throw new Error("Community not found");
      return events[0];
    },
    enabled: !!nostr && !!parsedId,
  });

  const nameTag = community?.tags.find(tag => tag[0] === "name");
  const descriptionTag = community?.tags.find(tag => tag[0] === "description");
  const imageTag = community?.tags.find(tag => tag[0] === "image");
  const guidelinesTag = community?.tags.find(tag => tag[0] === "guidelines");

  const name = nameTag ? nameTag[1] : (parsedId?.identifier || "Unnamed Group");
  const description = descriptionTag ? descriptionTag[1] : "No description available";
  const image = imageTag ? imageTag[1] : undefined;
  const guidelines = guidelinesTag ? guidelinesTag[1] : "";

  const isOwner = user && community && user.pubkey === community.pubkey;

  useEffect(() => {
    if (name && name !== "Unnamed Group") {
      document.title = `+chorus - ${name} - Guidelines`;
    } else {
      document.title = "+chorus - Guidelines";
    }
    return () => {
      document.title = "+chorus";
    };
  }, [name]);

  if (isLoadingCommunity || !parsedId) {
    return (
      <div className="container mx-auto py-1 px-3 sm:px-4">
        <Header />
        <h1 className="text-2xl font-bold mb-4">Loading guidelines...</h1>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="container mx-auto py-1 px-3 sm:px-4">
        <Header />
        <h1 className="text-2xl font-bold mb-4">Group not found</h1>
        <p>The group you're looking for doesn't exist or has been deleted.</p>
        <Button asChild className="mt-2">
          <Link to="/groups">Back to Groups</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-1 px-3 sm:px-4">
      <Header />

      <div className="flex mb-6">
        <Button variant="ghost" asChild className="p-0 text-2xl">
          <Link to={`/group/${encodeURIComponent(groupId || "")}`} className="flex flex-row items-center text-2xl font-bold">
            <ArrowLeft size={40} className="mr-3 w-10 h-10 shrink-0" />
            Back to Group
          </Link>
        </Button>
      </div>

      <div className="relative mb-6 mt-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="h-36 rounded-lg overflow-hidden mb-2 relative">
              {image ? (
                <img
                  src={image}
                  alt={name}
                  className="w-full h-full object-cover object-center"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
              ) : null}
              <div 
                className={`w-full h-full bg-primary/10 text-primary font-bold text-4xl flex items-center justify-center ${image ? 'hidden' : 'flex'}`}
              >
                {name.charAt(0).toUpperCase()}
              </div>
            </div>

            <div className="flex flex-row items-start justify-between gap-4 mb-2">
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold">{name}</h1>
              </div>
            </div>
          </div>
        </div>
        
        {/* Group description */}
        <div className="w-full mt-2">
          <p className="text-base text-muted-foreground">{description}</p>
        </div>
      </div>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-4 w-4" />
              Community Guidelines
            </CardTitle>
            {isOwner && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/group/${encodeURIComponent(groupId || '')}/settings`} className="flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  Edit
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {guidelines ? (
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {guidelines}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-lg font-medium mb-2">No guidelines available</p>
              <p className="text-sm mb-4">This group hasn't set up community guidelines yet.</p>
              {isOwner && (
                <Button asChild variant="outline">
                  <Link to={`/group/${encodeURIComponent(groupId || '')}/settings`} className="flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    Edit
                  </Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}