import type { FlightTrack } from "../types";

export async function fetchFlightTrack(icao24: string): Promise<FlightTrack | null> {
  try {
    const res = await fetch(`/api/opensky/track?icao24=${encodeURIComponent(icao24)}`);
    if (!res.ok) return null;
    const data: FlightTrack = await res.json();
    if (!data.path || data.path.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}
