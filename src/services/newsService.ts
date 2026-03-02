import type { NewsArticle } from "../types";

const NEWS_CACHE_KEY = "gfw:news:cache";
const NEWS_CACHE_TTL_MS = 10 * 60_000; // 10 minutes

interface NewsCacheEntry {
  ts: number;
  data: NewsArticle[];
}

function readNewsCache(): NewsArticle[] | null {
  try {
    const raw = localStorage.getItem(NEWS_CACHE_KEY);
    if (!raw) return null;
    const entry: NewsCacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts < NEWS_CACHE_TTL_MS) return entry.data;
  } catch {}
  return null;
}

function writeNewsCache(data: NewsArticle[]) {
  try {
    localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

const FEEDS: Array<{ proxyPath: string; source: NewsArticle["source"] }> = [
  { proxyPath: "/api/rss/cna", source: "CNA" },
  { proxyPath: "/api/rss/bbc", source: "BBC" },
];

const KEYWORDS = [
  "iran", "oil", "asean", "hormuz", "trade", "shipping",
  "energy", "sanctions", "crude", "tanker", "strait",
];

function matchesKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return KEYWORDS.some(k => lower.includes(k));
}

function text(el: Element, tag: string): string {
  return el.querySelector(tag)?.textContent?.trim() ?? "";
}

function parseRSS(xml: string, source: NewsArticle["source"]): NewsArticle[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const items = Array.from(doc.querySelectorAll("item"));
  return items
    .filter(item => {
      const title = text(item, "title");
      const desc  = text(item, "description");
      return matchesKeyword(title) || matchesKeyword(desc);
    })
    .map(item => ({
      title:       text(item, "title"),
      description: text(item, "description").replace(/<[^>]+>/g, "").slice(0, 120),
      link:        text(item, "link") || "#",
      pubDate:     text(item, "pubDate") || new Date().toISOString(),
      source,
      category:    text(item, "category") || undefined,
    }));
}

async function fetchFeed(
  proxyPath: string,
  source: NewsArticle["source"],
): Promise<NewsArticle[]> {
  const res = await fetch(proxyPath);
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();
  return parseRSS(xml, source);
}

export async function fetchAllFeeds(): Promise<NewsArticle[]> {
  const cached = readNewsCache();
  if (cached) return cached;

  const results = await Promise.allSettled(
    FEEDS.map(f => fetchFeed(f.proxyPath, f.source))
  );
  const articles: NewsArticle[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") articles.push(...r.value);
  }
  const sorted = articles.sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );
  if (sorted.length > 0) writeNewsCache(sorted);
  return sorted;
}

export const STATIC_FALLBACK_ARTICLES: NewsArticle[] = [
  {
    title: "OPEC+ agrees modest oil output boost even as US war on Iran disrupts shipments",
    description: "OPEC+ approved a 206,000 bpd output increase for April 2026 as U.S.-Israeli strikes on Iran halted tanker traffic through the Strait of Hormuz, which handles over 20% of global oil transit.",
    link: "https://wtaq.com/2026/03/01/opec-debates-oil-output-boost-as-us-war-on-iran-disrupts-shipments/",
    pubDate: "2026-03-01T09:12:00Z",
    source: "Reuters",
    category: "Energy",
  },
  {
    title: "Asia airline stocks drop while energy shares rise as Iran conflict escalates",
    description: "Asian airline stocks including Singapore Airlines fell sharply while regional energy shares surged as escalating U.S.-Israel-Iran conflict drove oil futures up over 8%, disrupting Middle Eastern airspace.",
    link: "https://www.cnbc.com/amp/2026/03/02/asia-markets-live-trump-iran-oil-prices-nikkei-hang-seng-us-israel-strikes-oil.html",
    pubDate: "2026-03-02T03:00:00Z",
    source: "CNBC",
    category: "Markets",
  },
  {
    title: "How US-Israel attacks on Iran threaten the Strait of Hormuz, oil markets",
    description: "Roughly 20–30% of global oil and gas supplies transit the Strait of Hormuz; U.S.-Israeli strikes on Iran put those flows at direct risk of disruption.",
    link: "https://www.aljazeera.com/news/2026/3/1/how-us-israel-attacks-on-iran-threaten-the-strait-of-hormuz-oil-markets",
    pubDate: "2026-03-01T14:00:00Z",
    source: "Al Jazeera",
    category: "Energy",
  },
  {
    title: "Oil prices rise more than 2% as US and Iran extend talks into next week",
    description: "Oil climbed over 2% as traders priced in supply disruption risk from stalled U.S.-Iran nuclear negotiations, with Brent at $72.48/barrel amid an $8–10 geopolitical risk premium.",
    link: "https://www.cnbc.com/amp/2026/02/27/oil-prices-rise-as-us-and-iran-extend-talks-into-next-week.html",
    pubDate: "2026-02-27T18:00:00Z",
    source: "CNBC",
    category: "Markets",
  },
  {
    title: "Oil set for biggest annual drop since 2020",
    description: "Brent crude fell nearly 18% in 2025, its steepest annual decline since 2020, driven by OPEC+ output increases, U.S. shale hedging, and subdued global demand.",
    link: "https://www.ksl.com/article/51425246/oil-set-for-biggest-annual-drop-since-2020",
    pubDate: "2025-12-31T12:00:00Z",
    source: "Reuters",
    category: "Energy",
  },
];
