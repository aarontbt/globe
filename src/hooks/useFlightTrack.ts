import { useState, useEffect, useRef } from "react";
import type { FlightTrack } from "../types";
import { fetchFlightTrack } from "../services/openskyService";

export function useFlightTrack(icao24: string | null): { track: FlightTrack | null; loading: boolean } {
  const [track, setTrack] = useState<FlightTrack | null>(null);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Map<string, FlightTrack>>(new Map());

  useEffect(() => {
    if (!icao24) {
      setTrack(null);
      setLoading(false);
      return;
    }

    const cached = cacheRef.current.get(icao24);
    if (cached) {
      setTrack(cached);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setTrack(null);

    fetchFlightTrack(icao24)
      .then(result => {
        if (!cancelled) {
          if (result) cacheRef.current.set(icao24, result);
          setTrack(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [icao24]);

  return { track, loading };
}
