import type { VercelRequest, VercelResponse } from "@vercel/node";

// OpenSky Network — single global states/all call for true worldwide coverage.
const AUTH_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const STATES_URL = "https://opensky-network.org/api/states/all";

// Fallback: ADSB.lol regional queries used when OpenSky credentials are absent or fail.
// 12 key regions covering the busiest corridors globally.
const ADSB_LOL_REGIONS = [
  { lat: 51,  lon:   5, dist: 250 }, // Europe
  { lat: 40,  lon: -80, dist: 250 }, // US East
  { lat: 37,  lon:-120, dist: 250 }, // US West
  { lat: 25,  lon:  50, dist: 250 }, // Gulf / Middle East
  { lat: 55,  lon:  37, dist: 250 }, // Russia / Moscow
  { lat: 55,  lon:  90, dist: 250 }, // Siberia
  { lat: 30,  lon: 120, dist: 250 }, // China / E Asia
  { lat: 35,  lon: 127, dist: 250 }, // Japan / Korea
  { lat:  2,  lon: 103, dist: 250 }, // Singapore / SE Asia
  { lat: 20,  lon:  77, dist: 250 }, // India
  { lat: -28, lon: 135, dist: 250 }, // Australia
  { lat: -10, lon: -52, dist: 250 }, // South America
];

// Module-level token cache — reused across warm Vercel invocations
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getOpenSkyToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("missing_credentials");

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) throw new Error(`auth_failed:${res.status}`);
  const data = await res.json();
  cachedToken = data.access_token as string;
  tokenExpiresAt = Date.now() + (data.expires_in as number) * 1000 - 30_000;
  return cachedToken;
}

async function fetchGlobalViaOpenSky() {
  const token = await getOpenSkyToken();
  const res = await fetch(STATES_URL, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`states_failed:${res.status}`);
  const data = await res.json();

  // State vector: [icao24, callsign, country, time_pos, last_contact,
  //   lon, lat, baro_alt_m, on_ground, velocity_ms, true_track, ...]
  // adsbService.normalizeAc expects alt_baro in ft and gs in knots.
  return (data.states as unknown[] ?? [])
    .filter((s: unknown) => {
      const v = s as unknown[];
      return !v[8] && v[5] != null && v[6] != null && v[7] != null;
    })
    .map((s: unknown) => {
      const v = s as unknown[];
      return {
        hex:      v[0] as string,
        flight:   ((v[1] as string | null) ?? "").trim(),
        r:        v[2] as string,
        lon:      v[5] as number,
        lat:      v[6] as number,
        alt_baro: (v[7] as number) / 0.3048,
        gs:       ((v[9] as number | null) ?? 0) / 0.5144,
        track:    (v[10] as number | null) ?? 0,
      };
    });
}

async function fetchRegionalViaAdsbLol() {
  const results = await Promise.allSettled(
    ADSB_LOL_REGIONS.map(({ lat, lon, dist }) =>
      fetch(`https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${dist}`, {
        headers: { "User-Agent": "gfw-sample/1.0" },
        signal: AbortSignal.timeout(10_000),
      }).then(r => (r.ok ? r.json() : { ac: [] }))
    )
  );

  const seen = new Set<string>();
  const ac: unknown[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value?.ac ?? []) {
      const hex = (item as { hex?: string }).hex;
      if (hex && seen.has(hex)) continue;
      if (hex) seen.add(hex);
      ac.push(item);
    }
  }
  return ac;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Try OpenSky first (global), fall back to ADSB.lol regional on any failure
  try {
    const ac = await fetchGlobalViaOpenSky();
    return res.status(200).json({ ac, source: "opensky" });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    try {
      const ac = await fetchRegionalViaAdsbLol();
      return res.status(200).json({ ac, source: "adsb.lol", fallback_reason: reason });
    } catch {
      return res.status(200).json({ ac: [], source: "none", fallback_reason: reason });
    }
  }
}
