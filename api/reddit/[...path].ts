import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const pathParts = req.query.path;
    const pathStr = Array.isArray(pathParts) ? pathParts.join("/") : String(pathParts ?? "");

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (k === "path") continue;
      if (Array.isArray(v)) v.forEach(val => params.append(k, val));
      else if (v != null) params.append(k, v);
    }

    const qs = params.toString();
    const url = `https://www.reddit.com/${pathStr}${qs ? `?${qs}` : ""}`;

    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ASEANIntelDashboard/1.0)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
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
