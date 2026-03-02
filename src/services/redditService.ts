import type { GlobeEvent } from "../types";
import { inferGeo, jitterCoords } from "../utils/geoInfer";

const REDDIT_BASE = "/api/reddit";

const SUBREDDITS = ["worldnews", "geopolitics", "wallstreetbets", "investing", "stocks"];

const SIGNAL_KEYWORDS = [
  "iran", "hormuz", "oil", "asean", "war", "sanctions", "crude",
  "south china sea", "middle east", "tanker", "shipping", "military",
  "conflict", "attack", "ukraine", "russia", "israel", "taiwan",
  "philippines", "vietnam", "indonesia", "malaysia", "myanmar",
];

interface RedditPost {
  title: string;
  ups: number;
  upvote_ratio: number;
  num_comments: number;
  permalink: string;
  score: number;
}

interface RedditChild {
  kind: string;
  data: RedditPost;
}

interface RedditResponse {
  data?: {
    children?: RedditChild[];
  };
}

function hasSignalKeyword(text: string): boolean {
  const t = text.toLowerCase();
  return SIGNAL_KEYWORDS.some(kw => t.includes(kw));
}

function impactFromUps(ups: number): "high" | "medium" | "low" {
  if (ups >= 10_000) return "high";
  if (ups >= 1_000)  return "medium";
  return "low";
}

export async function fetchRedditSignals(): Promise<GlobeEvent[]> {
  const results: GlobeEvent[] = [];
  let idx = 0;

  const fetches = SUBREDDITS.map(async sub => {
    try {
      const resp = await fetch(`${REDDIT_BASE}/r/${sub}/hot.json?limit=25&raw_json=1`);

      if (!resp.ok) {
        console.warn(`[reddit] r/${sub} → HTTP ${resp.status}`);
        return;
      }

      // Guard against HTML redirects (e.g. Reddit login/captcha pages)
      const ct = resp.headers.get("content-type") ?? "";
      if (!ct.includes("json")) {
        console.warn(`[reddit] r/${sub} → unexpected content-type: ${ct}`);
        return;
      }

      const json: RedditResponse = await resp.json();
      const children = json.data?.children ?? [];
      console.info(`[reddit] r/${sub} → ${children.length} posts`);

      for (const child of children) {
        if (child.kind !== "t3") continue;
        const post = child.data;
        if (!hasSignalKeyword(post.title)) continue;

        const geo = inferGeo(post.title);
        if (!geo) continue;

        results.push({
          id: `reddit-${sub}-${encodeURIComponent(post.permalink).slice(-16)}-${idx}`,
          title: `r/${sub}: ${post.title}`,
          description: `Reddit discussion in r/${sub} with ${post.ups.toLocaleString()} upvotes and ${post.num_comments.toLocaleString()} comments.`,
          category: "social",
          country: geo.country,
          region: geo.region,
          coordinates: jitterCoords(geo.coordinates, idx++),
          impact: impactFromUps(post.ups),
          date: new Date().toISOString().slice(0, 10),
          tags: ["reddit", sub, geo.country.toLowerCase().replace(/\s+/g, "")],
          social: {
            platform: "reddit",
            url: `https://www.reddit.com${post.permalink}`,
            engagement: post.ups,
            engagementLabel: "upvotes",
          },
        });
      }
    } catch (err) {
      console.warn(`[reddit] r/${sub} → fetch error:`, err);
    }
  });

  await Promise.all(fetches);

  if (results.length === 0) {
    console.warn("[reddit] no posts matched geo keywords — returning empty (no fallback)");
  } else {
    console.info(`[reddit] ${results.length} live signal(s) collected`);
  }

  // Return empty when nothing matched — no fake static fallback
  return results;
}
