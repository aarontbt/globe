import { useState, useEffect } from "react";
import type { FlightTrack } from "../types";
import { fetchFlightTrack } from "../services/openskyService";

export function useFlightTrack(icao24: string | null): { track: FlightTrack | null; loading: boolean } {
  const [track, setTrack] = useState<FlightTrack | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!icao24) {
      setTrack(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setTrack(null);

    fetchFlightTrack(icao24)
      .then(result => {
        if (!cancelled) {
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
