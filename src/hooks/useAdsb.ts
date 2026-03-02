import { useState, useEffect, useRef, useCallback } from "react";
import type { Aircraft } from "../types";
import { fetchAircraft, FALLBACK } from "../services/adsbService";

const POLL_MS = 600_000; // 10 minutes — ADSB.fi is cached 9.5 min server-side

function deadReckon(base: Aircraft[], elapsedMs: number): Aircraft[] {
  if (elapsedMs <= 0) return base;
  const dtS = elapsedMs / 1000;
  return base.map((ac) => {
    if (ac.velocityMs <= 0) return ac;
    const headingRad = (ac.heading * Math.PI) / 180;
    const dLat = (ac.velocityMs * dtS * Math.cos(headingRad)) / 111_320;
    const dLon =
      (ac.velocityMs * dtS * Math.sin(headingRad)) /
      (111_320 * Math.cos((ac.lat * Math.PI) / 180));
    return { ...ac, lat: ac.lat + dLat, lon: ac.lon + dLon };
  });
}

export function useAdsb(enabled: boolean) {
  const baseAircraftRef = useRef<Aircraft[]>(FALLBACK);
  const [aircraft, setAircraft] = useState<Aircraft[]>(FALLBACK);
  const fetchedAtRef = useRef<number>(Date.now());

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await fetchAircraft();
      baseAircraftRef.current = data;
      fetchedAtRef.current = Date.now();
    } catch {
      // keep previous data on error
    }
  }, [enabled]);

  // Poll every 10 minutes
  useEffect(() => {
    if (!enabled) return;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  // Dead-reckoning animation every second — reads ref so interval never restarts on fetch
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      const elapsed = Date.now() - fetchedAtRef.current;
      setAircraft(deadReckon(baseAircraftRef.current, elapsed));
    }, 1000);
    return () => clearInterval(id);
  }, [enabled]);

  return { aircraft };
}
