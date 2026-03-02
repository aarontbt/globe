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
    });

    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    res.end(body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: "Upstream fetch failed", detail: message });
  }
}
