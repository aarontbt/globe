import type { VercelRequest, VercelResponse } from "@vercel/node";

const FEED_URLS: Record<string, string> = {
  cna: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml",
  bbc: "https://feeds.bbci.co.uk/news/world/rss.xml",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const feed = req.query.feed as string;
  const upstreamUrl = FEED_URLS[feed];

  if (!upstreamUrl) {
    res.status(404).json({ error: `Unknown feed: ${feed}` });
    return;
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.end(body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: "Upstream fetch failed", detail: message });
  }
}
