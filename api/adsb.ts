import type { VercelRequest, VercelResponse } from "@vercel/node";

// 16 regions covering major global flight corridors.
// adsb.lol public API: max 250 NM radius, no auth required.
const REGIONS = [
  // Europe
  { lat: 51,  lon:   2, dist: 250 }, // Western Europe (UK/France/Benelux)
  { lat: 50,  lon:  23, dist: 250 }, // Central/Eastern Europe
  // North Atlantic corridor
  { lat: 52,  lon: -30, dist: 250 }, // Mid-Atlantic
  // North America
  { lat: 40,  lon: -74, dist: 250 }, // US Northeast (NYC)
  { lat: 30,  lon: -90, dist: 250 }, // US Southeast / Gulf
  { lat: 35,  lon:-118, dist: 250 }, // US West Coast (LA)
  { lat: 48,  lon:-122, dist: 250 }, // US/Canada Pacific Northwest
  // Pacific
  { lat: 50,  lon: 175, dist: 250 }, // North Pacific trans-oceanic corridor
  // Northeast Asia
  { lat: 35,  lon: 127, dist: 250 }, // Japan / Korea / Yellow Sea
  { lat: 30,  lon: 120, dist: 250 }, // East China coast / Shanghai
  // Southeast Asia
  { lat: 10,  lon: 108, dist: 250 }, // ASEAN + South China Sea
  // South Asia / Middle East
  { lat: 20,  lon:  75, dist: 250 }, // India subcontinent
  { lat: 25,  lon:  50, dist: 250 }, // Gulf / Arabian Peninsula
  // Africa / Mediterranean
  { lat:  5,  lon:  20, dist: 250 }, // Central Africa / equatorial routes
  // Southern Hemisphere
  { lat:-28,  lon: 135, dist: 250 }, // Australia
  { lat:-10,  lon: -52, dist: 250 }, // South America (Brazil)
];

interface RawAc {
  hex?: string;
  [key: string]: unknown;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const results = await Promise.allSettled(
      REGIONS.map(({ lat, lon, dist }) =>
        fetch(`https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${dist}`, {
          headers: { "User-Agent": "gfw-sample/1.0" },
          signal: AbortSignal.timeout(10_000),
        }).then(r => (r.ok ? r.json() : { ac: [] }))
      )
    );

    // Merge and deduplicate by hex across regions
    const seen = new Set<string>();
    const ac: RawAc[] = [];
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const item of result.value?.ac ?? []) {
        const hex = item.hex as string | undefined;
        if (hex && seen.has(hex)) continue;
        if (hex) seen.add(hex);
        ac.push(item as RawAc);
      }
    }

    res.status(200).json({ ac });
  } catch {
    res.status(200).json({ ac: [] });
  }
}
