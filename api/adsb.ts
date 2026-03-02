import type { VercelRequest, VercelResponse } from "@vercel/node";

// 32 overlapping regions for dense global coverage of major flight corridors.
// adsb.lol public API: max 250 NM radius, no auth required.
// Centers spaced ~400 NM apart so adjacent circles overlap by ~100 NM.
const REGIONS = [
  // Europe — 5 overlapping circles
  { lat: 51,  lon:  -2, dist: 250 }, // UK / Ireland / N France
  { lat: 48,  lon:  10, dist: 250 }, // Germany / Austria / N Italy
  { lat: 55,  lon:  23, dist: 250 }, // Baltic / Poland / Scandinavia
  { lat: 41,  lon:  24, dist: 250 }, // Balkans / Turkey / Aegean
  { lat: 37,  lon:   2, dist: 250 }, // Iberia / W Mediterranean
  // North Atlantic great-circle corridor
  { lat: 55,  lon: -20, dist: 250 }, // Ireland / Iceland approach
  { lat: 53,  lon: -40, dist: 250 }, // Mid-Atlantic
  // North America — 5 circles
  { lat: 44,  lon: -74, dist: 250 }, // US Northeast / Canada SE
  { lat: 33,  lon: -84, dist: 250 }, // US Southeast
  { lat: 40,  lon: -95, dist: 250 }, // US Midwest
  { lat: 35,  lon:-118, dist: 250 }, // US West Coast
  { lat: 48,  lon:-118, dist: 250 }, // Pacific Northwest / Canada
  // Central America / Caribbean
  { lat: 19,  lon: -99, dist: 250 }, // Mexico City corridor
  // South America
  { lat: -10, lon: -52, dist: 250 }, // Brazil / Amazon basin
  { lat: -34, lon: -60, dist: 250 }, // Buenos Aires / S. America South
  // Africa / Mediterranean
  { lat: 33,  lon:  13, dist: 250 }, // N Africa / Libya / Tunisia
  { lat:  5,  lon:  22, dist: 250 }, // Central Africa / equatorial
  { lat: -26, lon:  28, dist: 250 }, // South Africa / Johannesburg
  // Middle East
  { lat: 31,  lon:  34, dist: 250 }, // Levant / Egypt / Red Sea
  { lat: 25,  lon:  50, dist: 250 }, // Gulf / UAE / Qatar / Saudi
  { lat: 35,  lon:  60, dist: 250 }, // Iran / E. Afghanistan
  // Russia / Siberian corridors (heavily used Europe–Asia routes)
  { lat: 55,  lon:  55, dist: 250 }, // Russia / Urals
  { lat: 55,  lon:  90, dist: 250 }, // W Siberia / Novosibirsk
  { lat: 55,  lon: 125, dist: 250 }, // E Siberia / Yakutsk corridor
  // Central & South Asia
  { lat: 43,  lon:  72, dist: 250 }, // Kazakhstan / Kyrgyzstan
  { lat: 28,  lon:  77, dist: 250 }, // India North / Delhi
  { lat: 19,  lon:  73, dist: 250 }, // India West / Mumbai
  // East / Southeast Asia
  { lat: 20,  lon:  96, dist: 250 }, // Myanmar / N Thailand / Yunnan
  { lat: 13,  lon: 101, dist: 250 }, // Thailand / Indochina
  { lat:  2,  lon: 103, dist: 250 }, // Singapore / Malacca Strait / Peninsula Malaysia
  { lat: 10,  lon: 108, dist: 250 }, // Vietnam / South China Sea
  { lat: 12,  lon: 122, dist: 250 }, // Philippines / N Borneo
  { lat: -7,  lon: 111, dist: 250 }, // Java / Bali / Java Sea
  { lat: -3,  lon: 130, dist: 250 }, // Sulawesi / Maluku / W Papua
  { lat: 32,  lon: 119, dist: 250 }, // Shanghai / E China
  { lat: 36,  lon: 128, dist: 250 }, // Korea / Japan Sea
  // Pacific
  { lat: 50,  lon: 170, dist: 250 }, // North Pacific trans-oceanic
  // Australia
  { lat: -28, lon: 135, dist: 250 }, // Australia
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
