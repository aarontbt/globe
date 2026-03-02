import * as satellite from "satellite.js";
import type { Satellite } from "../types";

const TLE_CACHE_KEY = "gfw:celestrak:tles";
const TLE_CACHE_TTL_MS = 2 * 60 * 60_000; // TLEs valid for hours; 2h avoids hammering Celestrak

export type TLEEntry = { name: string; line1: string; line2: string };

interface TLECacheEntry {
  ts: number;
  tles: TLEEntry[];
}

export const FALLBACK_SATELLITES: Satellite[] = [
  { name: "ISS (ZARYA)",  lat: 15,  lon: 110, altitudeKm: 420,  periodMin: 92.6  },
  { name: "TERRA",        lat: -5,  lon: 105, altitudeKm: 705,  periodMin: 98.9  },
  { name: "AQUA",         lat: 20,  lon: 120, altitudeKm: 705,  periodMin: 98.9  },
  { name: "SENTINEL-2A",  lat: 10,  lon: 98,  altitudeKm: 786,  periodMin: 100.6 },
  { name: "NOAA 19",      lat: -10, lon: 130, altitudeKm: 870,  periodMin: 102.1 },
];

function readTLECache(): TLEEntry[] | null {
  try {
    const raw = localStorage.getItem(TLE_CACHE_KEY);
    if (!raw) return null;
    const entry: TLECacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts < TLE_CACHE_TTL_MS) return entry.tles;
  } catch {}
  return null;
}

function writeTLECache(tles: TLEEntry[]) {
  try {
    const entry: TLECacheEntry = { ts: Date.now(), tles };
    localStorage.setItem(TLE_CACHE_KEY, JSON.stringify(entry));
  } catch {}
}

function parseTLE(raw: string): TLEEntry[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const result: TLEEntry[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i].replace(/^0 /, "");
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];
    if (line1.startsWith("1 ") && line2.startsWith("2 ")) {
      result.push({ name, line1, line2 });
    }
  }
  return result;
}

/** Fetch and parse TLEs — returns from localStorage if still fresh, otherwise hits CelesTrak. */
export async function fetchTLEs(): Promise<TLEEntry[]> {
  const cached = readTLECache();
  if (cached && cached.length > 0) return cached;

  const resp = await fetch("/api/celestrak/pub/TLE/active.txt");
  if (!resp.ok) throw new Error(`CelesTrak ${resp.status}`);
  const text = await resp.text();
  const all = parseTLE(text);
  // 500 covers all well-known LEO/MEO/GEO satellites while keeping propagation under ~50ms
  const tles = all.slice(0, 500);
  if (tles.length === 0) return [];
  writeTLECache(tles);
  return tles;
}

function propagateOne(entry: TLEEntry, now: Date): Satellite | null {
  try {
    const satrec = satellite.twoline2satrec(entry.line1, entry.line2);
    if (satrec.error !== 0) return null;
    const pv = satellite.propagate(satrec, now);
    if (!pv.position || typeof pv.position === "boolean") return null;
    const gmst = satellite.gstime(now);
    const geo = satellite.eciToGeodetic(pv.position as satellite.EciVec3<number>, gmst);
    const meanMotion = parseFloat(entry.line2.substring(52, 63));
    const periodMin = isFinite(meanMotion) && meanMotion > 0 ? 1440 / meanMotion : 0;
    return {
      name: entry.name,
      lat: satellite.degreesLat(geo.latitude),
      lon: satellite.degreesLong(geo.longitude),
      altitudeKm: geo.height,
      periodMin,
    };
  } catch {
    return null;
  }
}

/** Propagate a list of TLE entries to their current positions. */
export function propagateAll(tles: TLEEntry[]): Satellite[] {
  const now = new Date();
  const result: Satellite[] = [];
  for (const entry of tles) {
    const s = propagateOne(entry, now);
    if (s) result.push(s);
  }
  return result.length > 0 ? result : FALLBACK_SATELLITES;
}
