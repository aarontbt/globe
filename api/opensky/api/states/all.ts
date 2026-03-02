import type { VercelRequest, VercelResponse } from "@vercel/node";

const EMPTY = { time: Math.floor(Date.now() / 1000), states: null };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  const id     = process.env.openskyId;
  const secret = process.env.openskySecret;
  const hasAuth = !!(id && secret);
  res.setHeader("X-OpenSky-Auth", hasAuth ? "yes" : "no");

  try {
    const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0" };
    if (hasAuth) {
      // btoa is available in Node 18+ (Vercel default runtime)
      headers["Authorization"] = `Basic ${btoa(`${id}:${secret}`)}`;
    }

    const url = "https://opensky-network.org/api/states/all";
    const upstream = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(12000),
    });

    res.setHeader("X-OpenSky-Status", String(upstream.status));

    if (!upstream.ok) {
      res.status(200).json(EMPTY);
      return;
    }

    const body = await upstream.text();
    res.status(200).end(body);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.setHeader("X-OpenSky-Error", msg.slice(0, 100));
    res.status(200).json(EMPTY);
  }
}
