import { NostrEvent, NPool, NRelay1 } from "@jsr/nostrify__nostrify";
import { NostrContext } from "@jsr/nostrify__react";
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
        return new NRelay1(url);
      },
      reqRouter(filters) {
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
