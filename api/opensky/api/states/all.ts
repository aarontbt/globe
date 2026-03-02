import type { VercelRequest, VercelResponse } from "@vercel/node";

const EMPTY = { time: Math.floor(Date.now() / 1000), states: null };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  try {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (Array.isArray(v)) v.forEach(val => params.append(k, val));
      else if (v != null) params.append(k, v);
    }

    const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0" };

    const id     = process.env.openskyId;
    const secret = process.env.openskySecret;
    if (id && secret) {
      const token = Buffer.from(`${id}:${secret}`).toString("base64");
      headers["Authorization"] = `Basic ${token}`;
    }

    const url = `https://opensky-network.org/api/states/all?${params}`;
    const upstream = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) {
      res.status(200).json(EMPTY);
      return;
    }

    const body = await upstream.text();
    res.status(200).end(body);
  } catch {
    res.status(200).json(EMPTY);
  }
}
