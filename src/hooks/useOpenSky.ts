import { useState, useEffect, useCallback } from "react";
import type { Aircraft } from "../types";
import { fetchAircraft, FALLBACK } from "../services/openskyService";

const POLL_MS = 60_000; // 60s — conservative to avoid OpenSky rate limits

export function useOpenSky(enabled: boolean) {
  const [aircraft, setAircraft] = useState<Aircraft[]>(FALLBACK);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await fetchAircraft();
      setAircraft(data);
    } catch {
      // keep previous data on error
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  return { aircraft, loading };
}
