import type { FireHotspot } from "../types";
import fallbackData from "../data/fire-hotspots.json";

export const FALLBACK_FIRE_HOTSPOTS: FireHotspot[] = fallbackData as FireHotspot[];

const FIRMS_CACHE_KEY = "gb:firms:hotspots";
const FIRMS_CACHE_TTL_MS = 30 * 60_000; // 30 minutes

// Bounding boxes to filter: Middle East + SE Asia
const BBOXES = [
  { minLat: 12, maxLat: 42, minLon: 25, maxLon: 65 },  // Middle East / Gulf
  { minLat: -12, maxLat: 28, minLon: 90, maxLon: 145 }, // SE Asia
];

interface HotspotCacheEntry {
  ts: number;
  hotspots: FireHotspot[];
}

function readCache(): FireHotspot[] | null {
  try {
    const raw = localStorage.getItem(FIRMS_CACHE_KEY);
    if (!raw) return null;
    const entry: HotspotCacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts < FIRMS_CACHE_TTL_MS) return entry.hotspots;
  } catch {}
  return null;
}

function writeCache(hotspots: FireHotspot[]) {
  try {
    const entry: HotspotCacheEntry = { ts: Date.now(), hotspots };
    localStorage.setItem(FIRMS_CACHE_KEY, JSON.stringify(entry));
  } catch {}
}

function inBounds(lat: number, lon: number): boolean {
  return BBOXES.some(
    (b) => lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon
  );
}

function parseCSV(text: string): FireHotspot[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = {
    lat:        header.indexOf("latitude"),
    lon:        header.indexOf("longitude"),
    brightness: header.indexOf("brightness"),
    frp:        header.indexOf("frp"),
    confidence: header.indexOf("confidence"),
    satellite:  header.indexOf("satellite"),
    acqDate:    header.indexOf("acq_date"),
    acqTime:    header.indexOf("acq_time"),
    daynight:   header.indexOf("daynight"),
  };

  const result: FireHotspot[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 8) continue;

    const lat = parseFloat(cols[idx.lat] ?? "");
    const lon = parseFloat(cols[idx.lon] ?? "");
    if (!isFinite(lat) || !isFinite(lon)) continue;
    if (!inBounds(lat, lon)) continue;

    const conf = parseFloat(cols[idx.confidence] ?? "0");
    if (conf < 50) continue;

    result.push({
      latitude:   lat,
      longitude:  lon,
      brightness: parseFloat(cols[idx.brightness] ?? "0") || 0,
      frp:        parseFloat(cols[idx.frp] ?? "0") || 0,
      confidence: conf,
      satellite:  (cols[idx.satellite] ?? "").trim(),
      acqDate:    (cols[idx.acqDate] ?? "").trim(),
      acqTime:    (cols[idx.acqTime] ?? "").trim(),
      daynight:   ((cols[idx.daynight] ?? "D").trim() as "D" | "N"),
    });
  }
  return result;
}

export async function fetchFireHotspots(): Promise<FireHotspot[]> {
  const cached = readCache();
  if (cached && cached.length > 0) return cached;

  const resp = await fetch(
    "/api/firms/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv"
  );
  if (!resp.ok) throw new Error(`FIRMS ${resp.status}`);

  const text = await resp.text();
  const hotspots = parseCSV(text);
  if (hotspots.length === 0) return FALLBACK_FIRE_HOTSPOTS;

  writeCache(hotspots);
  return hotspots;
}
