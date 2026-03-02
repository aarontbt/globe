import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const filename = req.query.filename as string;
    const url = `https://celestrak.org/pub/TLE/${filename}`;
    const upstream = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!upstream.ok) {
      res.status(upstream.status).end();
      return;
    }

    const body = await upstream.text();
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.status(200).end(body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: "Upstream fetch failed", detail: message });
  }
}
