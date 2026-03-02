import type { MarketQuote } from "../types";

const MARKET_CACHE_KEY = "gfw:markets:cache";
const MARKET_CACHE_TTL_MS = 5 * 60_000; // 5 minutes

interface MarketCacheEntry {
  ts: number;
  data: MarketQuote[];
}

function readMarketCache(): MarketQuote[] | null {
  try {
    const raw = localStorage.getItem(MARKET_CACHE_KEY);
    if (!raw) return null;
    const entry: MarketCacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts < MARKET_CACHE_TTL_MS) return entry.data;
  } catch {}
  return null;
}

function writeMarketCache(data: MarketQuote[]) {
  try {
    localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

const SYMBOLS: Array<Pick<MarketQuote, "symbol" | "name" | "unit">> = [
  { symbol: "BZ=F", name: "Brent Crude", unit: "/barrel" },
  { symbol: "CL=F", name: "WTI Crude",   unit: "/barrel" },
  { symbol: "GC=F", name: "Gold",         unit: "/oz" },
];

// Stooq symbol mapping (free, no API key, CSV endpoint)
const STOOQ_SYMBOLS: Record<string, string> = {
  "BZ=F": "bz.f",
  "CL=F": "cl.f",
  "GC=F": "gc.f",
};

async function fetchQuoteStooq(
  symbol: string,
  name: string,
  unit: string
): Promise<MarketQuote> {
  const stooqSym = STOOQ_SYMBOLS[symbol];
  if (!stooqSym) throw new Error(`No Stooq mapping for ${symbol}`);

  // Returns CSV: Symbol,Date,Time,Open,High,Low,Close,Volume
  const res = await fetch(`/api/stooq/q/l/?s=${stooqSym}&f=sd2t2ohlcv&e=csv`);
  if (!res.ok) throw new Error(`Stooq ${symbol}: ${res.status}`);

  const text = await res.text();
  const lines = text.trim().split("\n");
  if (lines.length < 2) throw new Error(`Stooq: no data for ${symbol}`);

  const values = lines[1].split(",");
  const open  = parseFloat(values[3]);
  const close = parseFloat(values[6]);
  if (isNaN(close) || close <= 0) throw new Error(`Stooq: invalid price for ${symbol}`);

  const change    = close - open;
  const changePct = open > 0 ? (change / open) * 100 : 0;

  return {
    symbol,
    name,
    price: close,
    change,
    changePct,
    currency: "USD",
    unit,
    lastUpdated: new Date().toISOString(),
  };
}

async function fetchQuoteYahoo(
  symbol: string,
  name: string,
  unit: string
): Promise<MarketQuote> {
  const res = await fetch(
    `/api/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d`
  );
  if (!res.ok) throw new Error(`Yahoo Finance ${symbol}: ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta) throw new Error(`No meta for ${symbol}`);

  const price: number = meta.regularMarketPrice ?? 0;
  const change: number = meta.regularMarketChange ?? 0;
  const changePct: number = meta.regularMarketChangePercent ?? 0;

  const rawClose: (number | null)[] =
    result?.indicators?.quote?.[0]?.close ?? [];
  const history = rawClose.filter((v): v is number => v !== null && v > 0);

  return {
    symbol,
    name,
    price,
    change,
    changePct,
    currency: meta.currency ?? "USD",
    unit,
    lastUpdated: new Date().toISOString(),
    history: history.length >= 2 ? history : undefined,
  };
}

export async function fetchQuote(
  symbol: string,
  name: string,
  unit: string
): Promise<MarketQuote> {
  try {
    return await fetchQuoteYahoo(symbol, name, unit);
  } catch {
    // Yahoo Finance unavailable — fall back to Stooq (free, no-auth CSV feed)
    return fetchQuoteStooq(symbol, name, unit);
  }
}

// Sequential with a gap between requests to avoid burst rate-limiting
export async function fetchAllQuotes(): Promise<MarketQuote[]> {
  const cached = readMarketCache();
  if (cached) return cached;

  const results: MarketQuote[] = [];
  for (const s of SYMBOLS) {
    if (results.length > 0) await new Promise(r => setTimeout(r, 500));
    results.push(await fetchQuote(s.symbol, s.name, s.unit));
  }
  writeMarketCache(results);
  return results;
}
