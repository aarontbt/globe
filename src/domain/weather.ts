import type { PolarWeatherManifest, WeatherManifest } from "../types/weather";

function validBounds(value: unknown): value is [number, number, number, number] {
  return Array.isArray(value) && value.length === 4 && value.every(Number.isFinite)
    && value[0] >= -180 && value[2] <= 180 && value[1] >= -90 && value[3] <= 90
    && value[0] < value[2] && value[1] < value[3];
}

function assetUrl(value: string, base: string): string {
  const url = new URL(value, base);
  const origin = new URL(base);
  if (url.origin !== origin.origin || url.username || url.password
    || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
    throw new Error("Weather assets must use the manifest origin over HTTPS");
  }
  return url.href;
}

export function validateWeatherManifest(value: unknown, base: string, now = Date.now()): WeatherManifest {
  const m = value as WeatherManifest;
  const timestamp = (v: unknown) => typeof v === "string" && /(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));
  const sha = (v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
  if (!m || m.schemaVersion !== "weather-imagery-v1" || m.sourceId !== "noaa-gmgsi-lw"
    || m.channel !== "longwave-infrared" || m.projection !== "EPSG:4326"
    || typeof m.frameId !== "string" || !/^[a-zA-Z0-9-]{1,160}$/.test(m.frameId)
    || !timestamp(m.observedAt) || !timestamp(m.observationEnd) || !timestamp(m.generatedAt)
    || Date.parse(m.observedAt) > Date.parse(m.observationEnd) || Date.parse(m.observationEnd) > now + 300_000
    || Date.parse(m.generatedAt) < Date.parse(m.observationEnd)
    || Date.parse(m.generatedAt) > now + 300_000 || !validBounds(m.bounds)
    || !sha(m.sourceSha256) || !m.sourceUrl?.startsWith("https://noaa-gmgsi-pds.s3.amazonaws.com/GMGSI_LW/")
    || !Number.isFinite(m.resolutionKm) || m.resolutionKm <= 0
    || ![120, ...(m.deliveryMode === "daily" ? [1560] : [])].includes(m.staleAfterMinutes)
    || (m.deliveryMode !== undefined && m.deliveryMode !== "daily")
    || typeof m.attribution !== "string" || !m.attribution
    || typeof m.valueDescription !== "string" || !Array.isArray(m.patches) || m.patches.length !== 8) {
    throw new Error("Invalid weather imagery manifest");
  }
  if (m.polarUrl !== undefined && (typeof m.polarUrl !== "string" || !m.polarUrl)) throw new Error("Invalid polar manifest URL");
  const ids = new Set<string>();
  let bytes = 0;
  for (const p of m.patches) {
    if (!p || typeof p.id !== "string" || ids.has(p.id) || !validBounds(p.bounds)
      || !Number.isInteger(p.width) || !Number.isInteger(p.height) || p.width < 1 || p.height < 1
      || p.width > 1024 || p.height > 1024 || !Number.isInteger(p.bytes) || p.bytes < 1 || !sha(p.sha256)
      || typeof p.url !== "string" || !p.url || p.bounds[0] < m.bounds[0] || p.bounds[1] < m.bounds[1]
      || p.bounds[2] > m.bounds[2] || p.bounds[3] > m.bounds[3]) {
      throw new Error("Invalid weather image patch");
    }
    ids.add(p.id);
    bytes += p.bytes;
  }
  // Require the full declared 4x2 partition, preventing silently missing or
  // overlapping sectors even if the remaining assets are individually valid.
  for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) {
    const p = m.patches.find(p => p.id === `${row}-${col}`);
    const [w, s, e, n] = m.bounds;
    const expected = [w + col * (e - w) / 4, n - (row + 1) * (n - s) / 2,
      w + (col + 1) * (e - w) / 4, n - row * (n - s) / 2];
    if (!p || !p.bounds.every((v, i) => Math.abs(v - expected[i]) < 1e-6)) throw new Error("Incomplete weather coverage");
  }
  if (bytes > 10 * 1024 * 1024) throw new Error("Weather frame exceeds transfer budget");
  const history = m.history ?? [];
  if (!Array.isArray(history) || history.length > 73) throw new Error("Invalid weather history");
  const frameIds = new Set<string>();
  let previousTime = -Infinity;
  for (const f of history) {
    if (!f || typeof f.frameId !== "string" || !/^[a-zA-Z0-9-]{1,160}$/.test(f.frameId)
      || frameIds.has(f.frameId) || !timestamp(f.observedAt) || Date.parse(f.observedAt) <= previousTime
      || Date.parse(f.observedAt) > Date.parse(m.observedAt)
      || Date.parse(f.observedAt) < Date.parse(m.observedAt) - 72 * 3600_000
      || typeof f.url !== "string" || !f.url) throw new Error("Invalid weather history frame");
    frameIds.add(f.frameId);
    previousTime = Date.parse(f.observedAt);
  }
  if (history.length && (history[history.length - 1].frameId !== m.frameId || history[history.length - 1].observedAt !== m.observedAt)) {
    throw new Error("Weather history does not include the latest frame");
  }
  return { ...m, patches: m.patches.map(p => ({ ...p, url: assetUrl(p.url, base) })),
    history: history.map(f => ({ ...f, url: assetUrl(f.url, base) })),
    polarUrl: m.polarUrl === undefined ? undefined : assetUrl(m.polarUrl, base) };
}

export function validatePolarManifest(value: unknown, base: string, observedAt: string): PolarWeatherManifest {
  const m = value as PolarWeatherManifest;
  const sha = (v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
  if (!m || m.schemaVersion !== "polar-clouds-v1" || !["nasa-modis-cloud-fraction", "nasa-modis-infrared"].includes(m.sourceId)
    || typeof m.observedDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(m.observedDate)
    || !Number.isFinite(Date.parse(m.observedDate))
    || Date.parse(m.observedDate) + 86400_000 > Date.parse(observedAt)
    || Date.parse(observedAt) - Date.parse(m.observedDate) > 3 * 86400_000
    || !Number.isFinite(Date.parse(m.generatedAt)) || Date.parse(m.generatedAt) > Date.now() + 300_000
    || typeof m.attribution !== "string" || !m.attribution
    || !Array.isArray(m.patches) || m.patches.length !== 8
    || !Array.isArray(m.sourceUrls) || m.sourceUrls.length !== 2
    || !m.sourceUrls.every(url => typeof url === "string" && url.startsWith("https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?"))
    || !Array.isArray(m.sourceHashes) || m.sourceHashes.length !== 2 || !m.sourceHashes.every(sha)
    || m.colormapUrl !== `https://gibs.earthdata.nasa.gov/colormaps/v1.3/${m.sourceId === "nasa-modis-infrared" ? "MODIS_Brightness_Temp_Band31" : "MODIS_Cloud_Fraction"}.xml`
    || !sha(m.colormapSha256)) throw new Error("Invalid polar weather manifest");
  const ids = new Set<string>();
  let bytes = 0;
  for (const p of m.patches) {
    const match = typeof p?.id === "string" && /^(north|south)-([0-3])$/.exec(p.id);
    if (!match || ids.has(p.id) || !validBounds(p.bounds) || p.width !== 256 || p.height !== 128
      || !Number.isInteger(p.bytes) || p.bytes < 1 || !sha(p.sha256) || typeof p.url !== "string" || !p.url) {
      throw new Error("Invalid polar image patch");
    }
    const col = Number(match[2]), north = match[1] === "north";
    const expected = [-180 + col * 90, north ? 68 : -90, -90 + col * 90, north ? 90 : -68];
    if (!p.bounds.every((v, i) => v === expected[i])) throw new Error("Incorrect polar coverage");
    ids.add(p.id); bytes += p.bytes;
  }
  if (bytes > 2 * 1024 * 1024) throw new Error("Polar imagery exceeds transfer budget");
  return { ...m, patches: m.patches.map(p => ({ ...p, url: assetUrl(p.url, base) })) };
}

export function weatherFreshness(manifest: WeatherManifest, now = Date.now()): "fresh" | "stale" {
  return now - Date.parse(manifest.observedAt) > manifest.staleAfterMinutes * 60_000 ? "stale" : "fresh";
}
