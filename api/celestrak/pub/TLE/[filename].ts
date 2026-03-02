import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const filename = req.query.filename as string;

  // Source 1: Celestrak
  try {
    const upstream = await fetch(`https://celestrak.org/pub/TLE/${filename}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
        Accept: "text/plain,*/*",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (upstream.ok) {
      const body = await upstream.text();
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.status(200).end(body);
      return;
    }
  } catch { /* fall through */ }

  // Source 2: tle.ivanstanojevic.me JSON API → convert to TLE text
  try {
    const pages = await Promise.all([
      fetch("https://tle.ivanstanojevic.me/api/tle/?page=1&page_size=100", {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      }),
      fetch("https://tle.ivanstanojevic.me/api/tle/?page=2&page_size=100", {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      }),
    ]);
    const lines: string[] = [];
    for (const r of pages) {
      if (!r.ok) continue;
      const json = await r.json();
      for (const sat of json.member ?? []) {
        if (sat.name && sat.line1 && sat.line2) lines.push(sat.name, sat.line1, sat.line2);
      }
    }
    if (lines.length > 0) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.status(200).end(lines.join("\n"));
      return;
    }
  } catch { /* fall through */ }

  // All sources failed — return empty 200 so the client uses its built-in fallback
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.status(200).end("");
}
