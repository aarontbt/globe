import type { VercelRequest, VercelResponse } from "@vercel/node";

// Six regions covering the major global flight corridors shown in the app.
// adsb.lol public API: max 250 NM radius, no auth required.
const REGIONS = [
  { lat: 10,  lon: 112, dist: 250 }, // ASEAN + South China Sea
  { lat: -2,  lon: 107, dist: 250 }, // Indonesia + Malacca Strait
  { lat: 35,  lon: 127, dist: 250 }, // Northeast Asia (Japan, Korea, E. China)
  { lat: 22,  lon:  60, dist: 250 }, // Indian Ocean / Gulf corridor
  { lat: 51,  lon:  10, dist: 250 }, // Europe
  { lat: 40,  lon: -95, dist: 250 }, // North America
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
