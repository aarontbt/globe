import type { Aircraft } from "../types";

// ADSB.fi (ADS-B Exchange) — free, no key required.
export const FALLBACK: Aircraft[] = [
  // ASEAN — intra-regional
  { icao24: "700261", callsign: "SIA321",  country: "Singapore",   lon: 103.8,  lat:   1.4,  altitudeM: 10668, velocityMs: 245, heading:  45 },
  { icao24: "76acd2", callsign: "MAS370",  country: "Malaysia",    lon: 101.7,  lat:   3.1,  altitudeM: 11000, velocityMs: 238, heading: 270 },
  { icao24: "8960e3", callsign: "GIA402",  country: "Indonesia",   lon: 107.6,  lat:  -6.9,  altitudeM:  9144, velocityMs: 220, heading:  90 },
  { icao24: "8964b2", callsign: "GIA881",  country: "Indonesia",   lon: 112.7,  lat:  -7.2,  altitudeM: 10972, velocityMs: 235, heading:  75 },
  { icao24: "7c5213", callsign: "THA661",  country: "Thailand",    lon: 100.5,  lat:  13.8,  altitudeM: 10060, velocityMs: 230, heading: 130 },
  { icao24: "749a21", callsign: "PAL118",  country: "Philippines", lon: 121.0,  lat:  14.5,  altitudeM: 11277, velocityMs: 242, heading: 215 },
  { icao24: "7c4b21", callsign: "VJC820",  country: "Vietnam",     lon: 106.7,  lat:  10.8,  altitudeM:  9754, velocityMs: 228, heading:   5 },
  { icao24: "7c9f33", callsign: "AXM732",  country: "Malaysia",    lon:  98.3,  lat:   5.4,  altitudeM: 10363, velocityMs: 233, heading: 310 },
  { icao24: "8965c4", callsign: "LNI901",  country: "Indonesia",   lon: 115.2,  lat:  -8.7,  altitudeM:  8534, velocityMs: 215, heading: 260 },
  { icao24: "76b441", callsign: "MXD611",  country: "Myanmar",     lon:  96.2,  lat:  16.9,  altitudeM:  9449, velocityMs: 225, heading: 180 },
  // Northeast Asia
  { icao24: "780a42", callsign: "CES204",  country: "China",       lon: 121.5,  lat:  31.2,  altitudeM: 10972, velocityMs: 248, heading: 110 },
  { icao24: "781b33", callsign: "CCA101",  country: "China",       lon: 116.4,  lat:  39.9,  altitudeM: 11277, velocityMs: 251, heading: 225 },
  { icao24: "8446c1", callsign: "KAL901",  country: "South Korea", lon: 126.9,  lat:  37.6,  altitudeM: 10668, velocityMs: 244, heading:  60 },
  { icao24: "868aa1", callsign: "JAL007",  country: "Japan",       lon: 139.8,  lat:  35.7,  altitudeM: 11582, velocityMs: 255, heading: 330 },
  { icao24: "896b12", callsign: "EVA015",  country: "Taiwan",      lon: 121.2,  lat:  25.1,  altitudeM: 10972, velocityMs: 246, heading: 285 },
  // South Asia / Middle East corridor
  { icao24: "896211", callsign: "SIA026",  country: "Singapore",   lon:  88.3,  lat:  22.5,  altitudeM: 11277, velocityMs: 249, heading: 295 },
  { icao24: "896c44", callsign: "UAE412",  country: "UAE",         lon:  55.4,  lat:  25.3,  altitudeM: 12192, velocityMs: 258, heading: 100 },
  { icao24: "896d55", callsign: "QTR542",  country: "Qatar",       lon:  51.6,  lat:  25.3,  altitudeM: 11887, velocityMs: 253, heading:  80 },
  { icao24: "400921", callsign: "BAW009",  country: "UK",          lon:  68.4,  lat:  24.9,  altitudeM: 11582, velocityMs: 252, heading: 115 },
  // Trans-Pacific
  { icao24: "a05b31", callsign: "UAL837",  country: "United States", lon: 165.0, lat:  38.5, altitudeM: 11887, velocityMs: 256, heading:  60 },
  { icao24: "a1c422", callsign: "DAL281",  country: "United States", lon:-155.0, lat:  45.2, altitudeM: 11582, velocityMs: 254, heading: 240 },
  { icao24: "7808b2", callsign: "CPA104",  country: "Hong Kong",   lon: 145.0,  lat:  28.0,  altitudeM: 11277, velocityMs: 250, heading:  55 },
  // Indian Ocean / Straits corridor
  { icao24: "7c6812", callsign: "SIA471",  country: "Singapore",   lon:  80.2,  lat:   7.9,  altitudeM: 10972, velocityMs: 245, heading: 255 },
  { icao24: "896e77", callsign: "GIA088",  country: "Indonesia",   lon:  95.3,  lat:   5.5,  altitudeM:  9754, velocityMs: 228, heading: 270 },
  // Europe
  { icao24: "3c6444", callsign: "DLH400",  country: "Germany",     lon:  13.4,  lat:  52.5,  altitudeM: 11277, velocityMs: 252, heading: 270 },
  { icao24: "4ca2c1", callsign: "RYR4421", country: "Ireland",     lon:  -6.3,  lat:  53.3,  altitudeM:  9754, velocityMs: 230, heading: 190 },
  // Americas
  { icao24: "a0f073", callsign: "AAL100",  country: "United States", lon: -74.0, lat:  40.7, altitudeM: 10972, velocityMs: 240, heading:  90 },
  { icao24: "a8f311", callsign: "SWA1234", country: "United States", lon:-118.2, lat:  34.1, altitudeM:  9449, velocityMs: 224, heading: 270 },
  // Australia / Pacific
  { icao24: "7c6a1c", callsign: "QFA01",   country: "Australia",   lon: 151.2,  lat: -33.9,  altitudeM: 10668, velocityMs: 241, heading: 320 },
  { icao24: "7c7bde", callsign: "ANZ180",  country: "New Zealand", lon: 174.8,  lat: -36.9,  altitudeM: 11277, velocityMs: 247, heading:  10 },
];

const CACHE_KEY = "gfw:aircraft";
const CACHE_TTL_MS = 9.5 * 60 * 1000; // 9.5 minutes

interface AircraftCache {
  ts: number;
  data: Aircraft[];
}

// Raw field shape returned by adsb.lol / adsb.fi geographic endpoints
interface RawAc {
  hex?: string;
  flight?: string;
  r?: string;
  lon?: number;
  lat?: number;
  alt_baro?: number | "ground";
  gs?: number;
  track?: number;
}

function normalizeAc(acs: RawAc[]): Aircraft[] {
  const result: Aircraft[] = [];
  for (const ac of acs) {
    if (ac.alt_baro === "ground" || ac.alt_baro == null) continue;
    if (ac.lat == null || ac.lon == null) continue;
    result.push({
      icao24: ac.hex ?? "",
      callsign: (ac.flight ?? "").trim(),
      country: ac.r ?? "",
      lon: ac.lon,
      lat: ac.lat,
      altitudeM: ac.alt_baro * 0.3048,   // ft → m
      velocityMs: (ac.gs ?? 0) * 0.5144, // knots → m/s
      heading: ac.track ?? 0,
    });
  }
  return result;
}

function readAircraftCache(): Aircraft[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: AircraftCache = JSON.parse(raw);
    if (Date.now() - cached.ts > CACHE_TTL_MS) return null;
    return cached.data;
  } catch {
    return null;
  }
}

function writeAircraftCache(data: Aircraft[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* quota exceeded — skip caching */ }
}

export async function fetchAircraft(): Promise<Aircraft[]> {
  const cached = readAircraftCache();
  if (cached) return cached;

  try {
    const res = await fetch("/api/adsb");
    if (!res.ok) return FALLBACK;
    const raw: { ac?: RawAc[] } | RawAc[] = await res.json();
    // Accept both raw {ac:[...]} (Vite proxy / Vercel fn) and pre-normalized Aircraft[]
    const acs: RawAc[] = Array.isArray(raw) ? raw : (raw.ac ?? []);
    const data = normalizeAc(acs);
    if (data.length === 0) return FALLBACK;
    writeAircraftCache(data);
    return data;
  } catch {
    return FALLBACK;
  }
}
