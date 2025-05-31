import { NostrEvent, NPool, NRelay1 } from "@nostrify/nostrify";
import { NostrContext } from "@nostrify/react";
import React, { useRef } from "react";
import { storeEventTimestamp } from "@/lib/nostrTimestamps";

interface NostrProviderProps {
  children: React.ReactNode;
  relays: string[];
}

/**
 * Custom NPool implementation that tracks timestamps for published events
 */
class TimestampTrackingNPool extends NPool {
  async event(
    event: NostrEvent,
    opts?: { signal?: AbortSignal; relays?: string[] }
  ): Promise<void> {
    // Call the original event method
    await super.event(event, opts);

    // Store the timestamp after successful publishing
    storeEventTimestamp(event.pubkey, event.kind);
  }
}

const NostrProvider: React.FC<NostrProviderProps> = (props) => {
  const { children, relays } = props;

  // Create NPool instance only once
  const pool = useRef<NPool | undefined>(undefined);

  if (!pool.current) {
    pool.current = new TimestampTrackingNPool({
      open(url: string) {
        console.log(`[NostrProvider] Opening connection to ${url}`);
        return new NRelay1(url);
      },
      reqRouter(filters) {
        console.log(`[NostrProvider] Routing query to relays:`, relays);
        console.log(`[NostrProvider] Query filters:`, JSON.stringify(filters, null, 2));
        return new Map(relays.map((url) => [url, filters]));
      },
      eventRouter(_event: NostrEvent) {
        return relays;
      },
    });
  }

  return (
    <NostrContext.Provider value={{ nostr: pool.current }}>
      {children}
    </NostrContext.Provider>
  );
};

export default NostrProvider;
