import { useNip29Groups } from "@/hooks/useNip29GroupsWithCache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DEFAULT_NIP29_RELAYS } from "@/hooks/useNip29GroupsWithCache";

export function Nip29GroupsDebug() {
  const { data: groups, isLoading, error, isFetching } = useNip29Groups();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          NIP-29 Groups Debug
          <div className="flex gap-2">
            {isLoading && <Badge variant="secondary">Loading...</Badge>}
            {isFetching && !isLoading && <Badge variant="secondary">Refreshing...</Badge>}
            {groups && <Badge variant="default">{groups.length} groups</Badge>}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2">Configured Relays:</h3>
          <ul className="list-disc list-inside text-sm text-muted-foreground">
            {DEFAULT_NIP29_RELAYS.map(relay => (
              <li key={relay}>{relay}</li>
            ))}
          </ul>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              Error loading groups: {error instanceof Error ? error.message : 'Unknown error'}
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : groups && groups.length > 0 ? (
          <div className="space-y-2">
            <h3 className="font-semibold">Groups Found:</h3>
            {groups.map(group => (
              <div key={group.id} className="border rounded p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{group.name}</h4>
                  <Badge variant="outline">{group.type}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">ID: {group.groupId}</p>
                <p className="text-sm text-muted-foreground">Relay: {group.relay}</p>
                {group.description && (
                  <p className="text-sm">{group.description}</p>
                )}
                <div className="flex gap-2 text-xs">
                  <span>Members: {group.members?.length || 0}</span>
                  <span>Admins: {group.admins?.length || 0}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No NIP-29 groups found</p>
        )}
      </CardContent>
    </Card>
  );
}