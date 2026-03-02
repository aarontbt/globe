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
  // LEO — International Space Station & crewed
  { name: "ISS (ZARYA)",      lat:  15,  lon:  110, altitudeKm:  420, periodMin:  92.6 },
  { name: "CSS (TIANHE)",     lat: -10,  lon:   85, altitudeKm:  390, periodMin:  92.3 },
  // LEO — Earth observation
  { name: "TERRA",            lat:  -5,  lon:  105, altitudeKm:  705, periodMin:  98.9 },
  { name: "AQUA",             lat:  20,  lon:  120, altitudeKm:  705, periodMin:  98.9 },
  { name: "SENTINEL-2A",      lat:  10,  lon:   98, altitudeKm:  786, periodMin: 100.6 },
  { name: "SENTINEL-2B",      lat: -20,  lon:  145, altitudeKm:  786, periodMin: 100.6 },
  { name: "SENTINEL-1A",      lat:  35,  lon:   60, altitudeKm:  693, periodMin:  98.6 },
  { name: "LANDSAT-9",        lat: -35,  lon:  170, altitudeKm:  705, periodMin:  98.9 },
  { name: "NOAA 19",          lat: -10,  lon:  130, altitudeKm:  870, periodMin: 102.1 },
  { name: "NOAA 20",          lat:  55,  lon:  -30, altitudeKm:  824, periodMin: 101.4 },
  { name: "SUOMI NPP",        lat:  40,  lon:  -80, altitudeKm:  824, periodMin: 101.4 },
  { name: "METOP-B",          lat: -50,  lon:   20, altitudeKm:  817, periodMin: 101.3 },
  { name: "METOP-C",          lat:  25,  lon:  -60, altitudeKm:  817, periodMin: 101.3 },
  { name: "SPOT-7",           lat:   5,  lon:   35, altitudeKm:  694, periodMin:  98.7 },
  { name: "WORLDVIEW-3",      lat:  30,  lon:  -45, altitudeKm:  617, periodMin:  97.0 },
  // LEO — Starlink / commercial
  { name: "STARLINK-1",       lat:  48,  lon:   15, altitudeKm:  550, periodMin:  95.6 },
  { name: "STARLINK-2",       lat:  48,  lon:   60, altitudeKm:  550, periodMin:  95.6 },
  { name: "STARLINK-3",       lat:  48,  lon:  105, altitudeKm:  550, periodMin:  95.6 },
  { name: "STARLINK-4",       lat:  48,  lon:  150, altitudeKm:  550, periodMin:  95.6 },
  { name: "STARLINK-5",       lat:  48,  lon: -165, altitudeKm:  550, periodMin:  95.6 },
  { name: "STARLINK-6",       lat:  48,  lon: -120, altitudeKm:  550, periodMin:  95.6 },
  { name: "STARLINK-7",       lat:  48,  lon:  -75, altitudeKm:  550, periodMin:  95.6 },
  { name: "ONEWEB-1",         lat: -53,  lon:   30, altitudeKm: 1200, periodMin: 109.4 },
  { name: "ONEWEB-2",         lat: -53,  lon:  120, altitudeKm: 1200, periodMin: 109.4 },
  // MEO — Navigation
  { name: "GPS BIIA-14",      lat:  55,  lon:   45, altitudeKm: 20200, periodMin: 717.9 },
  { name: "GPS BIIA-21",      lat: -55,  lon:  135, altitudeKm: 20200, periodMin: 717.9 },
  { name: "GALILEO-12",       lat:  56,  lon:  -30, altitudeKm: 23222, periodMin: 844.9 },
  { name: "GALILEO-13",       lat: -56,  lon:   90, altitudeKm: 23222, periodMin: 844.9 },
  { name: "GLONASS-M 747",    lat:  64,  lon:   10, altitudeKm: 19100, periodMin: 675.8 },
  { name: "BEIDOU-3 M1",      lat: -45,  lon:  -60, altitudeKm: 21528, periodMin: 760.0 },
  // GEO — Communications & weather (fixed over equator ~35 786 km)
  { name: "INTELSAT 901",     lat:   0,  lon:   18, altitudeKm: 35786, periodMin: 1436.1 },
  { name: "INTELSAT 907",     lat:   0,  lon:  332, altitudeKm: 35786, periodMin: 1436.1 },
  { name: "GOES-16",          lat:   0,  lon:  -75, altitudeKm: 35786, periodMin: 1436.1 },
  { name: "GOES-18",          lat:   0,  lon: -137, altitudeKm: 35786, periodMin: 1436.1 },
  { name: "METEOSAT-10",      lat:   0,  lon:    0, altitudeKm: 35786, periodMin: 1436.1 },
  { name: "HIMAWARI-9",       lat:   0,  lon:  141, altitudeKm: 35786, periodMin: 1436.1 },
  { name: "COMSATx-2",        lat:   0,  lon:  113, altitudeKm: 35786, periodMin: 1436.1 },
  // Scientific / other
  { name: "HUBBLE",           lat:  28,  lon: -100, altitudeKm:  540, periodMin:  95.4 },
  { name: "SWOT",             lat: -38,  lon:   70, altitudeKm:  891, periodMin: 103.9 },
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
