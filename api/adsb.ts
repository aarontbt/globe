import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Aircraft } from "../src/types";

interface AdsbAc {
  hex?: string;
  flight?: string;
  r?: string;
  lon?: number;
  lat?: number;
  alt_baro?: number | "ground";
  gs?: number;
  track?: number;
}

interface AdsbResponse {
  ac: AdsbAc[];
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const upstream = await fetch("https://opendata.adsb.fi/api/v2/all", {
      headers: { "User-Agent": "gfw-sample/1.0" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      res.status(200).json([]);
      return;
    }

    const json: AdsbResponse = await upstream.json();
    const aircraft: Aircraft[] = [];

    for (const ac of json.ac ?? []) {
      if (ac.alt_baro === "ground" || ac.alt_baro === undefined) continue;
      if (ac.lat == null || ac.lon == null) continue;

      aircraft.push({
        icao24: ac.hex ?? "",
        callsign: (ac.flight ?? "").trim(),
        country: ac.r ?? "",
        lon: ac.lon,
        lat: ac.lat,
        altitudeM: ac.alt_baro * 0.3048,
        velocityMs: (ac.gs ?? 0) * 0.5144,
        heading: ac.track ?? 0,
      });
    }

    res.status(200).json(aircraft);
  } catch {
    res.status(200).json([]);
  }
}
