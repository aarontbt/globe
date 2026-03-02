import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Convert tle.ivanstanojevic.me JSON response to standard 3-line TLE text. */
async function fetchFromTleApi(): Promise<string> {
  // Fetch two pages to get ~200 satellites across diverse orbits
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
  for (const res of pages) {
    if (!res.ok) continue;
    const json = await res.json();
    for (const sat of json.member ?? []) {
      if (sat.name && sat.line1 && sat.line2) {
        lines.push(sat.name, sat.line1, sat.line2);
      }
    }
  }
  if (lines.length === 0) throw new Error("No TLE data from fallback API");
  return lines.join("\n");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Try Celestrak first
  try {
    const filename = req.query.filename as string;
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
  } catch {
    // fall through to backup
  }

  // Fallback: tle.ivanstanojevic.me (cloud-friendly, no IP restrictions)
  try {
    const body = await fetchFromTleApi();
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.status(200).end(body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: "TLE fetch failed", detail: message });
  }
}
