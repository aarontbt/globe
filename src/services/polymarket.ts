import type { GlobeEvent, EventCategory, PolymarketData } from "../types";

// Requests are proxied through Vite dev server (/api/polymarket → gamma-api.polymarket.com)
// to avoid CORS restrictions in the browser.
const GAMMA_BASE = "/api/polymarket";

// ── keyword → [coords, country, region] ──────────────────────────────────────
// Longer/more-specific phrases must come before shorter substrings
const COORD_MAP: Array<[string, [number, number], string, string]> = [
  // Southeast Asia
  ["south china sea", [114.0, 13.0], "Philippines", "South China Sea"],
  ["philippines",     [121.0, 14.6], "Philippines", "Southeast Asia"],
  ["vietnam",         [106.0, 16.0], "Vietnam",     "Southeast Asia"],
  ["thailand",        [100.5, 13.8], "Thailand",    "Southeast Asia"],
  ["indonesia",       [106.8, -6.2], "Indonesia",   "Southeast Asia"],
  ["myanmar",         [ 96.1, 19.7], "Myanmar",     "Southeast Asia"],
  ["malaysia",        [101.7,  3.1], "Malaysia",    "Southeast Asia"],
  ["cambodia",        [104.9, 11.6], "Cambodia",    "Southeast Asia"],
  ["laos",            [102.6, 18.0], "Laos",        "Southeast Asia"],
  ["singapore",       [103.8,  1.4], "Singapore",   "Southeast Asia"],
  ["asean",           [108.0, 10.0], "ASEAN",       "Southeast Asia"],
  // East Asia
  ["taiwan",          [121.0, 23.5], "Taiwan",      "East Asia"],
  ["china",           [116.4, 39.9], "China",       "East Asia"],
  ["japan",           [138.0, 36.0], "Japan",       "East Asia"],
  ["korea",           [127.0, 37.5], "South Korea", "East Asia"],
  ["hong kong",       [114.2, 22.3], "Hong Kong",   "East Asia"],
  // South Asia
  ["india",           [ 79.5, 20.0], "India",       "South Asia"],
  ["pakistan",        [ 69.3, 30.4], "Pakistan",    "South Asia"],
  ["bangladesh",      [ 90.4, 23.7], "Bangladesh",  "South Asia"],
  ["afghanistan",     [ 69.2, 34.5], "Afghanistan", "South Asia"],
  // Middle East
  ["gaza",            [ 34.5, 31.5], "Gaza",        "Middle East"],
  ["israel",          [ 35.2, 31.8], "Israel",      "Middle East"],
  ["iran",            [ 51.4, 35.7], "Iran",        "Middle East"],
  ["iraq",            [ 44.4, 33.3], "Iraq",        "Middle East"],
  ["saudi",           [ 45.1, 24.7], "Saudi Arabia","Middle East"],
  ["syria",           [ 38.3, 34.8], "Syria",       "Middle East"],
  ["lebanon",         [ 35.5, 33.9], "Lebanon",     "Middle East"],
  ["turkey",          [ 35.2, 39.9], "Turkey",      "Middle East"],
  ["yemen",           [ 48.5, 15.6], "Yemen",       "Middle East"],
  // Europe
  ["ukraine",         [ 31.2, 49.0], "Ukraine",     "Europe"],
  ["russia",          [ 37.6, 55.8], "Russia",      "Europe"],
  ["germany",         [ 13.4, 52.5], "Germany",     "Europe"],
  ["france",          [  2.3, 48.9], "France",      "Europe"],
  ["uk",              [ -0.1, 51.5], "UK",          "Europe"],
  ["britain",         [ -0.1, 51.5], "UK",          "Europe"],
  ["poland",          [ 21.0, 52.2], "Poland",      "Europe"],
  ["spain",           [ -3.7, 40.4], "Spain",       "Europe"],
  ["italy",           [ 12.5, 41.9], "Italy",       "Europe"],
  ["nato",            [ 13.4, 52.5], "Europe",      "Europe"],
  ["europe",          [ 10.0, 51.0], "Europe",      "Europe"],
  // Americas
  ["united states",   [-77.0, 38.9], "United States","North America"],
  ["democrat",        [-77.0, 38.9], "United States","North America"],
  ["republican",      [-77.0, 38.9], "United States","North America"],
  ["trump",           [-77.0, 38.9], "United States","North America"],
  ["fed ",            [-77.0, 38.9], "United States","North America"],
  ["federal reserve", [-77.0, 38.9], "United States","North America"],
  ["mexico",          [-99.1, 19.4], "Mexico",      "North America"],
  ["canada",          [-75.7, 45.4], "Canada",      "North America"],
  ["venezuela",       [-66.9, 10.5], "Venezuela",   "South America"],
  ["brazil",          [-47.9, -15.8],"Brazil",      "South America"],
  ["argentina",       [-58.4, -34.6],"Argentina",   "South America"],
  ["colombia",        [-74.1,  4.7], "Colombia",    "South America"],
  // Africa
  ["nigeria",         [  7.5,  9.1], "Nigeria",     "Africa"],
  ["ethiopia",        [ 38.7,  9.0], "Ethiopia",    "Africa"],
  ["kenya",           [ 36.8, -1.3], "Kenya",       "Africa"],
  ["egypt",           [ 31.2, 30.1], "Egypt",       "Africa"],
  ["south africa",    [ 28.0,-26.2], "South Africa","Africa"],
  // Catch-all
  ["crypto",          [-77.0, 38.9], "United States","Global"],
  ["bitcoin",         [-77.0, 38.9], "United States","Global"],
  ["usd",             [-77.0, 38.9], "United States","Global"],
];

// ── title keywords → category ─────────────────────────────────────────────────
const CATEGORY_MAP: Array<[EventCategory, string[]]> = [
  ["security",   ["invade", "invasion", "military", "clash", "strike", "blockade", "war", "attack", "conflict", "nuclear"]],
  ["election",   ["election", "seats", "vote", "legislative", "referendum", "ballot", "nominee"]],
  ["economic",   ["trade", "gdp", "tariff", "export", "bitcoin", "economic", "brics", "bank", "currency", "sanctions"]],
  ["climate",    ["typhoon", "flood", "drought", "climate", "mekong", "earthquake", "storm", "cyclone"]],
  ["diplomatic", ["visit", "relations", "normalize", "meet", "summit", "agreement", "treaty", "diplomat", "recognize"]],
  ["political",  ["president", "prime minister", "pm ", "coup", "ousted", "leader", "government", "minister", "resign"]],
];


function inferCategory(text: string): EventCategory {
  const t = text.toLowerCase();
  for (const [cat, kws] of CATEGORY_MAP) {
    if (kws.some(k => t.includes(k))) return cat;
  }
  return "political";
}

function inferGeo(text: string): { coordinates: [number, number]; country: string; region: string } | null {
  const t = text.toLowerCase();
  for (const [kw, coords, country, region] of COORD_MAP) {
    if (t.includes(kw)) return { coordinates: coords, country, region };
  }
  return null;
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function inferImpact(volume: number): "high" | "medium" | "low" {
  if (volume >= 3_000_000) return "high";
  if (volume >= 400_000)   return "medium";
  return "low";
}

// Deterministic angular jitter so overlapping events don't stack exactly
function jitter(coords: [number, number], idx: number): [number, number] {
  const angle = (idx * 137.508) * (Math.PI / 180); // golden angle
  const r = 0.5;
  return [coords[0] + Math.cos(angle) * r, coords[1] + Math.sin(angle) * r];
}

// ── raw shape from Gamma API ──────────────────────────────────────────────────
interface RawMarket {
  question: string;
  outcomePrices: string;
  outcomes: string;
  groupItemTitle?: string;
}

interface RawEvent {
  id: string;
  title: string;
  slug: string;
  description: string;
  endDate: string;
  volume: number;
  liquidity: number;
  commentCount: number;
  markets: RawMarket[];
}

// ── single export function ─────────────────────────────────────────────────────
export async function fetchAseanEvents(): Promise<GlobeEvent[]> {
  const url =
    `${GAMMA_BASE}/events?active=true&closed=false` +
    `&limit=100&order=volume&ascending=false&tag_slug=world`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Polymarket API ${resp.status}`);

  const raw: RawEvent[] = await resp.json();
  const now = Date.now();

  let idx = 0;
  const results: GlobeEvent[] = [];

  for (const e of raw) {
    // skip expired
    if (e.endDate && new Date(e.endDate).getTime() < now) continue;

    const market = e.markets?.[0];
    let probability = 50;
    if (market?.outcomePrices) {
      try {
        const prices = JSON.parse(market.outcomePrices) as string[];
        const outcomes = JSON.parse(market.outcomes ?? "[]") as string[];
        if (outcomes[0]?.toLowerCase() === "yes" && prices[0]) {
          probability = Math.round(parseFloat(prices[0]) * 100);
        } else {
          // multi-outcome: highest single probability
          const max = Math.max(...prices.map(p => parseFloat(p) || 0));
          probability = Math.round(max * 100);
        }
      } catch { /* keep default */ }
    }

    const geo = inferGeo(e.title);
    if (!geo) continue; // no keyword match — hide from globe

    const category = inferCategory(e.title + " " + (market?.question ?? ""));

    const polymarket: PolymarketData = {
      volume:    formatUsd(e.volume   ?? 0),
      liquidity: formatUsd(e.liquidity ?? 0),
      comments:  e.commentCount ?? 0,
      slug:      e.slug,
    };

    results.push({
      id:          `pm-${e.id}`,
      title:       e.title,
      description: market?.question ?? e.description ?? e.title,
      category,
      country:     geo.country,
      region:      geo.region,
      coordinates: jitter(geo.coordinates, idx),
      probability,
      impact:      inferImpact(e.volume ?? 0),
      date:        e.endDate?.slice(0, 10) ?? "",
      tags:        [category, geo.country.toLowerCase(), "polymarket"],
      polymarket,
    });

    idx++;
  }

  return results;
}
