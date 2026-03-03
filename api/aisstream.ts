import type { VercelRequest, VercelResponse } from "@vercel/node";
import WebSocket from "ws";

interface AISShipRaw {
  mmsi: string;
  name: string;
  coordinates: [number, number];
  heading: number;
  speed: number;
  shipType: number;
  updatedAt: number;
}

const COLLECT_MS = 25_000;
const API_KEY = process.env.AISSTREAM_API_KEY;

export const config = { maxDuration: 30 };

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (!API_KEY) {
    res.status(500).json({ error: "AISSTREAM_API_KEY not configured" });
    return;
  }

  try {
    const ships = await collectShips();
    res.setHeader("Cache-Control", "s-maxage=55, stale-while-revalidate=30");
    res.status(200).json(ships);
  } catch (e) {
    res.status(502).json({ error: "Failed to collect AIS data", detail: String(e) });
  }
}

function collectShips(): Promise<AISShipRaw[]> {
  return new Promise((resolve, reject) => {
    const collected = new Map<string, AISShipRaw>();

    const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

    const timeout = setTimeout(() => {
      try { ws.close(); } catch {}
      resolve([...collected.values()]);
    }, COLLECT_MS);

    ws.on("open", () => {
      ws.send(JSON.stringify({
        APIkey: API_KEY,
        BoundingBoxes: [[[21, 55], [27, 60]]],
        FilterMessageTypes: ["PositionReport"],
      }));
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(String(data));
        const meta = msg.MetaData;
        const pos = msg.Message?.PositionReport;
        if (!meta || !pos) return;
        const mmsi = String(meta.MMSI ?? "");
        if (!mmsi) return;
        collected.set(mmsi, {
          mmsi,
          name: String(meta.ShipName ?? "").trim() || mmsi,
          coordinates: [pos.Longitude ?? 0, pos.Latitude ?? 0],
          heading: pos.TrueHeading ?? pos.Cog ?? 0,
          speed: pos.Sog ?? 0,
          shipType: pos.Type ?? 0,
          updatedAt: Date.now(),
        });
      } catch {}
    });

    ws.on("error", (e) => {
      clearTimeout(timeout);
      if (collected.size > 0) resolve([...collected.values()]);
      else reject(e);
    });

    ws.on("close", () => {
      clearTimeout(timeout);
      resolve([...collected.values()]);
    });
  });
}
