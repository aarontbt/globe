import type { VercelRequest, VercelResponse } from "@vercel/node";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = Array.isArray(req.query.path)
    ? req.query.path.join("/")
    : (req.query.path ?? "");

  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k === "path") continue;
    if (Array.isArray(v)) v.forEach(val => search.append(k, val));
    else if (v) search.append(k, v);
  }

  const upstream = `${GAMMA_BASE}/${path}${search.toString() ? `?${search}` : ""}`;

  const upstreamRes = await fetch(upstream, {
    headers: { Accept: "application/json" },
  });

  const data = await upstreamRes.text();

  res.status(upstreamRes.status);
  res.setHeader("Content-Type", upstreamRes.headers.get("content-type") ?? "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(data);
}
