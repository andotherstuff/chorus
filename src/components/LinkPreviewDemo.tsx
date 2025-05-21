import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LinkPreview } from './LinkPreview';

export function LinkPreviewDemo() {
  const [url, setUrl] = useState('https://github.com/nostr-protocol/nips');
  const [previewUrl, setPreviewUrl] = useState('https://github.com/nostr-protocol/nips');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPreviewUrl(url);
  };

  return (
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
            <h3 className="text-sm font-medium mb-2">Preview:</h3>
            <LinkPreview url={previewUrl} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}