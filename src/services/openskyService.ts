import type { Aircraft } from "../types";

const CACHE_KEY = "gfw:opensky:cache";
const CACHE_TTL_MS = 55_000; // treat as fresh for 55s (just under the 60s poll interval)

interface CacheEntry {
  ts: number;
  data: Aircraft[];
}

function readCache(): Aircraft[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
  } catch {}
  return null;
}

function writeCache(data: Aircraft[]) {
  try {
    const entry: CacheEntry = { ts: Date.now(), data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {}
}

export const FALLBACK: Aircraft[] = [
  { icao24: "700261", callsign: "SIA321", country: "Singapore", lon: 103.8, lat: 1.35, altitudeM: 10668, velocityMs: 245, heading: 45 },
  { icao24: "3c6444", callsign: "DLH400", country: "Germany",   lon: 13.4,  lat: 52.5,  altitudeM: 11277, velocityMs: 252, heading: 270 },
  { icao24: "a0f073", callsign: "AAL100", country: "United States", lon: -74.0, lat: 40.7, altitudeM: 10972, velocityMs: 240, heading: 90 },
  { icao24: "76acd2", callsign: "MAS370", country: "Malaysia",  lon: 101.7, lat: 3.1,   altitudeM: 11000, velocityMs: 238, heading: 270 },
  { icao24: "8960e3", callsign: "GIA402", country: "Indonesia", lon: 107.6, lat: -6.9,  altitudeM: 9144,  velocityMs: 220, heading: 90 },
];

export async function fetchAircraft(): Promise<Aircraft[]> {
  const cached = readCache();
  if (cached) return cached;

  // Global fetch — no bounding box
  const resp = await fetch("/api/opensky/api/states/all");
  if (!resp.ok) throw new Error(`OpenSky ${resp.status}`);
  const json = await resp.json();
  if (!json.states || !Array.isArray(json.states)) return FALLBACK;

  const result: Aircraft[] = [];
  for (const s of json.states) {
    const lon = s[5];
    const lat = s[6];
    if (typeof lon !== "number" || typeof lat !== "number") continue;
    if (s[8] === true) continue; // on_ground
    result.push({
      icao24: s[0] ?? "",
      callsign: (s[1] ?? "").trim(),
      country: s[2] ?? "",
      lon,
      lat,
      altitudeM: s[13] ?? s[7] ?? 0,
      velocityMs: s[9] ?? 0,
      heading: s[10] ?? 0,
    });
  }

  const data = result.length >= 10 ? result : FALLBACK;
  writeCache(data);
  return data;
}
