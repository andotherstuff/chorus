import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LinkPreview } from './LinkPreview';
import { NoteContent } from './NoteContent';
import type { NostrEvent } from '@jsr/nostrify__nostrify';

export function LinkPreviewDemo() {
  const [url, setUrl] = useState('https://github.com/nostr-protocol/nips');
  const [previewUrl, setPreviewUrl] = useState('https://github.com/nostr-protocol/nips');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPreviewUrl(url);
  };

  // Mock Nostr event to test URL hiding functionality
  const mockEvent: NostrEvent = {
    id: 'test-event-id',
    pubkey: 'test-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags: [],
    content: `Check out this awesome project! ${previewUrl} It's really cool and worth exploring.`,
    sig: 'test-signature'
  };

  return (
    <div className="space-y-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Link Preview Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter a URL"
              className="flex-1"
            />
            <Button type="submit">Preview</Button>
          </form>
          
          {previewUrl && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Standalone Preview:</h3>
              <LinkPreview url={previewUrl} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>URL Hiding Test</CardTitle>
          <p className="text-sm text-muted-foreground">
            This demonstrates how URLs are hidden from post content when a link preview is rendered.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Original Content:</h4>
              <div className="p-3 bg-muted rounded text-sm font-mono">
                {mockEvent.content}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Rendered Post (URL should be hidden):</h4>
              <div className="p-3 border rounded">
                <NoteContent event={mockEvent} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}