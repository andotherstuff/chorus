import React, { useEffect, useState } from 'react';
import { useEnhancedNostr } from '../EnhancedNostrProvider';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NostrEvent } from '@nostrify/nostrify';

export function Nip29Debug() {
  const { nostr } = useEnhancedNostr();
  const { user } = useCurrentUser();
  const [logs, setLogs] = useState<string[]>([]);
  const [groups, setGroups] = useState<Array<{
    id?: string;
    name?: string;
    about?: string;
    picture?: string;
    isPublic: boolean;
    isOpen: boolean;
    relay: string;
    event: NostrEvent;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[NIP-29 Debug] ${message}`);
  };

  const testRelay = async (relayUrl: string) => {
    addLog(`Testing connection to ${relayUrl}...`);
    setIsLoading(true);
    
    try {
      if (!nostr) {
        throw new Error("Enhanced Nostr provider not available");
      }

      // Wait a bit for auth if user is logged in
      if (user) {
        addLog(`User logged in as ${user.pubkey.slice(0, 8)}..., waiting for auth...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const signal = AbortSignal.timeout(15000); // 15 second timeout
      
      addLog(`Querying for NIP-29 groups (kind 39000)...`);
      const events = await nostr.query([{
        kinds: [39000],
        limit: 20
      }], { 
        signal,
        relays: [relayUrl]
      });

      addLog(`Received ${events.length} group events`);
      
      const parsedGroups = events.map(event => {
        const dTag = event.tags.find(t => t[0] === 'd')?.[1];
        const name = event.tags.find(t => t[0] === 'name')?.[1];
        const about = event.tags.find(t => t[0] === 'about')?.[1];
        const picture = event.tags.find(t => t[0] === 'picture')?.[1];
        const isPublic = event.tags.some(t => t[0] === 'public');
        const isOpen = event.tags.some(t => t[0] === 'open');
        
        return {
          id: dTag,
          name,
          about,
          picture,
          isPublic,
          isOpen,
          relay: relayUrl,
          event
        };
      });

      setGroups(parsedGroups);
      addLog(`Parsed ${parsedGroups.length} groups successfully`);

      // Test querying members for the first group
      if (parsedGroups.length > 0 && nostr) {
        const firstGroup = parsedGroups[0];
        addLog(`Testing member query for group "${firstGroup.name}" (${firstGroup.id})...`);
        
        const memberEvents = await nostr.query([{
          kinds: [39002],
          "#d": [firstGroup.id || ""],
          limit: 1
        }], {
          signal: AbortSignal.timeout(5000),
          relays: [relayUrl]
        });

        if (memberEvents.length > 0) {
          const memberCount = memberEvents[0].tags.filter(t => t[0] === 'p').length;
          addLog(`Found member list with ${memberCount} members`);
        } else {
          addLog(`No member list found for group ${firstGroup.id}`);
        }
      }

    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error('[NIP-29 Debug] Full error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setGroups([]);
  };

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>NIP-29 Debug Panel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">User Status:</span>
            <Badge variant={user ? "default" : "secondary"}>
              {user ? `Logged in as ${user.pubkey.slice(0, 8)}...` : 'Not logged in'}
            </Badge>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={() => testRelay('wss://communities.nos.social/')}
              disabled={isLoading}
            >
              Test communities.nos.social
            </Button>
            <Button 
              onClick={() => testRelay('wss://groups.fiatjaf.com')}
              disabled={isLoading}
            >
              Test groups.fiatjaf.com
            </Button>
            <Button 
              onClick={clearLogs}
              variant="outline"
              disabled={isLoading}
            >
              Clear Logs
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Logs:</h3>
            <div className="bg-muted p-3 rounded-md max-h-60 overflow-y-auto font-mono text-xs">
              {logs.length === 0 ? (
                <div className="text-muted-foreground">No logs yet. Click a test button to start.</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="whitespace-pre-wrap">{log}</div>
                ))
              )}
            </div>
          </div>

          {groups.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Found Groups:</h3>
              <div className="grid gap-2">
                {groups.map((group, i) => (
                  <Card key={i} className="p-3">
                    <div className="flex items-start gap-3">
                      {group.picture && (
                        <img src={group.picture} alt={group.name} className="w-12 h-12 rounded-md object-cover" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{group.name || 'Unnamed Group'}</div>
                        <div className="text-sm text-muted-foreground">{group.about || 'No description'}</div>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">ID: {group.id}</Badge>
                          {group.isPublic && <Badge variant="secondary" className="text-xs">Public</Badge>}
                          {group.isOpen && <Badge variant="secondary" className="text-xs">Open</Badge>}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}