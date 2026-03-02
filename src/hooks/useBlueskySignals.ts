import { useState, useEffect, useRef } from "react";
import type { GlobeEvent } from "../types";
import { BSKY_JETSTREAM_URL, parseJetstreamMessage, resetRateLimit } from "../services/bskyService";

const MAX_STORED   = 20;   // keep latest N bluesky events in state
const RECONNECT_MS = 5000; // 5 s backoff on disconnect

interface Result {
  events: GlobeEvent[];
  loading: boolean;
  error: string | null;
}

export function useBlueskySignals(): Result {
  const [events, setEvents] = useState<GlobeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    resetRateLimit();

    function connect() {
      if (cancelledRef.current) return;

      try {
        const ws = new WebSocket(BSKY_JETSTREAM_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelledRef.current) { ws.close(); return; }
          setLoading(false);
          setError(null);
        };

        ws.onmessage = (ev: MessageEvent<string>) => {
          if (cancelledRef.current) return;
          const evt = parseJetstreamMessage(ev.data);
          if (!evt) return;
          setEvents(prev => {
            // Deduplicate by id, prepend new event, cap at MAX_STORED
            if (prev.some(e => e.id === evt.id)) return prev;
            return [evt, ...prev].slice(0, MAX_STORED);
          });
        };

        ws.onerror = () => {
          // onerror is always followed by onclose; handle there
        };

        ws.onclose = () => {
          if (cancelledRef.current) return;
          setError("Bluesky stream disconnected — reconnecting…");
          reconnectTimer.current = setTimeout(connect, RECONNECT_MS);
        };
      } catch (err: unknown) {
        if (!cancelledRef.current) {
          setError(err instanceof Error ? err.message : "WebSocket unavailable");
          setLoading(false);
        }
      }
    }

    connect();

    return () => {
      cancelledRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  return { events, loading, error };
}
