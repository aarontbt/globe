import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (Array.isArray(v)) v.forEach(val => params.append(k, val));
      else if (v != null) params.append(k, v);
    }

    const url = `https://opensky-network.org/api/states/all?${params}`;
    const upstream = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      // OpenSky rate-limits unauthenticated requests; return empty states so
      // the client-side fallback takes over instead of surfacing a 502.
      res.setHeader("Content-Type", "application/json");
      res.status(200).json({ time: Math.floor(Date.now() / 1000), states: null });
      return;
    }

    const body = await upstream.text();
    res.setHeader("Content-Type", "application/json");
    res.status(200).end(body);
  } catch {
    // Timeout or network error — return empty states
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ time: Math.floor(Date.now() / 1000), states: null });
  }
}
