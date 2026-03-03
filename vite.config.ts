import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { IncomingMessage, ServerResponse } from "http";

/**
 * Dev-only middleware: connects to aisstream.io server-side (browser WS blocked by CORS),
 * collects AIS position reports for COLLECT_MS, returns JSON.
 */
function aisStreamDevPlugin(): Plugin {
  const COLLECT_MS = 25_000;

  function collectShips(apiKey: string): Promise<unknown[]> {
    return new Promise((resolve) => {
      const collected = new Map<string, unknown>();
      let ws: WebSocket;

      const timeout = setTimeout(() => {
        try { ws.close(); } catch {}
        resolve([...collected.values()]);
      }, COLLECT_MS);

      try {
        ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
      } catch {
        clearTimeout(timeout);
        resolve([]);
        return;
      }

      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({
          APIkey: apiKey,
          BoundingBoxes: [[[21, 55], [27, 60]]],
          FilterMessageTypes: ["PositionReport"],
        }));
      });

      ws.addEventListener("message", (evt: MessageEvent) => {
        try {
          const msg = JSON.parse(String(evt.data));
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

      ws.addEventListener("error", () => { clearTimeout(timeout); resolve([...collected.values()]); });
      ws.addEventListener("close", () => { clearTimeout(timeout); resolve([...collected.values()]); });
    });
  }

  return {
    name: "ais-stream-dev",
    configureServer(server) {
      server.middlewares.use("/api/aisstream", async (_req: IncomingMessage, res: ServerResponse) => {
        const apiKey = process.env.VITE_AISSTREAM_API_KEY;
        if (!apiKey) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "VITE_AISSTREAM_API_KEY not set" }));
          return;
        }
        try {
          const ships = await collectShips(apiKey);
          res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
          res.end(JSON.stringify(ships));
        } catch (e) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), aisStreamDevPlugin()],
  server: {
    proxy: {
      "/api/polymarket": {
        target: "https://gamma-api.polymarket.com",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/polymarket/, ""),
      },
      "/api/yahoo": {
        target: "https://query2.finance.yahoo.com",
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/api\/yahoo/, ""),
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Referer": "https://finance.yahoo.com/",
        },
      },
      "/api/rss/cna": {
        target: "https://www.channelnewsasia.com",
        changeOrigin: true,
        rewrite: () => "/rss/8395986",
      },
      "/api/rss/bbc": {
        target: "https://feeds.bbci.co.uk",
        changeOrigin: true,
        rewrite: () => "/news/business/rss.xml",
      },
      "/api/adsb": {
        target: "https://api.adsb.lol",
        changeOrigin: true,
        // Local dev: single ASEAN region query (Vercel fn does multi-region in prod)
        rewrite: () => "/v2/lat/10/lon/112/dist/250",
      },
      "/api/celestrak": {
        target: "https://celestrak.org",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/celestrak/, ""),
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
          "Accept": "text/plain",
        },
      },
      "/api/stooq": {
        target: "https://stooq.com",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/stooq/, ""),
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
      },
      // Social signal proxies
      "/api/gdelt": {
        target: "https://api.gdeltproject.org",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/gdelt/, "/api/v2/doc/doc"),
      },
      "/api/reddit": {
        target: "https://www.reddit.com",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/reddit/, ""),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ASEANIntelDashboard/1.0)",
        },
      },
    },
  },
});
