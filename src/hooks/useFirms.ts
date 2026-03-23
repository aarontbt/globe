import { useState, useEffect, useCallback } from "react";
import type { FireHotspot } from "../types";
import { fetchFireHotspots, FALLBACK_FIRE_HOTSPOTS } from "../services/firmsService";

const FIRMS_REFRESH_MS = 30 * 60_000; // 30 minutes

export function useFirms(enabled: boolean) {
  const [hotspots, setHotspots] = useState<FireHotspot[]>(FALLBACK_FIRE_HOTSPOTS);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await fetchFireHotspots();
      setHotspots(data);
    } catch {
      // retain previous data (already initialised with fallback)
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const id = setInterval(refresh, FIRMS_REFRESH_MS);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  return { hotspots, loading };
}
