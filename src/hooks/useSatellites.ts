import { useState, useEffect, useRef, useCallback } from "react";
import type { Satellite } from "../types";
import { fetchTLEs, propagateAll, FALLBACK_SATELLITES, type TLEEntry } from "../services/celestrakService";

const TLE_REFRESH_MS  = 10 * 60_000; // re-fetch TLEs every 10 min (localStorage absorbs most hits)
const POSITION_UPDATE_MS = 20_000;   // re-propagate positions every 20s

export function useSatellites(enabled: boolean) {
  const [satellites, setSatellites] = useState<Satellite[]>(FALLBACK_SATELLITES);
  const tlesRef = useRef<TLEEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Load TLEs (from cache or network) and immediately propagate to current positions
  const refreshTLEs = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const tles = await fetchTLEs();
      if (tles.length > 0) {
        tlesRef.current = tles;
        setSatellites(propagateAll(tles));
      }
    } catch {
      // keep previous data; if tlesRef is populated, re-propagate in place
      if (tlesRef.current.length > 0) {
        setSatellites(propagateAll(tlesRef.current));
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Initial load + periodic TLE refresh
  useEffect(() => {
    if (!enabled) return;
    refreshTLEs();
    const id = setInterval(refreshTLEs, TLE_REFRESH_MS);
    return () => clearInterval(id);
  }, [enabled, refreshTLEs]);

  // Re-propagate positions on a faster cadence without any network hit
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (tlesRef.current.length > 0) {
        setSatellites(propagateAll(tlesRef.current));
      }
    }, POSITION_UPDATE_MS);
    return () => clearInterval(id);
  }, [enabled]);

  return { satellites, loading };
}
