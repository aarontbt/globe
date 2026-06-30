import {
  PATHS,
  loadState,
  parseArgs,
  readJson,
  signalForZscore,
  writeJson,
} from "./daily-common.mjs";

const { dryRun } = parseArgs();
const state = loadState();

const LIQUID_QUOTES = [
  { symbol: "BZ=F", stooq: "bz.f", crossAssetId: "brent", name: "Brent Crude", unit: "/barrel" },
  { symbol: "CL=F", stooq: "cl.f", name: "WTI Crude", unit: "/barrel" },
  { symbol: "GC=F", stooq: "gc.f", name: "Gold", unit: "/oz" },
];

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function signedPct(value) {
  const rounded = round(value, 1);
  if (Object.is(rounded, -0) || rounded === 0) return "0.0%";
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%`;
}

async function fetchYahoo(symbol) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
      Referer: "https://finance.yahoo.com/",
    },
  });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta) throw new Error(`Yahoo ${symbol}: missing meta`);
  const price = Number(meta.regularMarketPrice);
  const prevClose = Number(meta.chartPreviousClose ?? meta.previousClose);
  if (!Number.isFinite(price) || price <= 0) throw new Error(`Yahoo ${symbol}: invalid price`);
  const change = Number.isFinite(Number(meta.regularMarketChange))
    ? Number(meta.regularMarketChange)
    : price - prevClose;
  const changePct = Number.isFinite(Number(meta.regularMarketChangePercent))
    ? Number(meta.regularMarketChangePercent)
    : ((price - prevClose) / prevClose) * 100;
  return {
    price,
    change,
    changePct,
    source: "Yahoo Finance",
    sourceDate: new Date().toISOString().slice(0, 10),
  };
}

async function fetchStooq(stooqSymbol) {
  const url = `https://stooq.com/q/l/?s=${stooqSymbol}&f=sd2t2ohlcv&e=csv`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Stooq ${stooqSymbol}: ${res.status}`);
  const rows = (await res.text()).trim().split("\n");
  if (rows.length < 2) throw new Error(`Stooq ${stooqSymbol}: no rows`);
  const values = rows[1].split(",");
  const date = values[1];
  const open = Number(values[3]);
  const close = Number(values[6]);
  if (!Number.isFinite(close) || close <= 0) throw new Error(`Stooq ${stooqSymbol}: invalid close`);
  const change = close - open;
  const changePct = open > 0 ? (change / open) * 100 : 0;
  return { price: close, change, changePct, source: "Stooq", sourceDate: date };
}

async function fetchQuote(config) {
  try {
    return await fetchYahoo(config.symbol);
  } catch (yahooError) {
    try {
      return await fetchStooq(config.stooq);
    } catch (stooqError) {
      return {
        error: `${yahooError.message}; ${stooqError.message}`,
      };
    }
  }
}

function updateCrossAssetFromQuote(nextState, config, quote) {
  if (!config.crossAssetId || !nextState.crossAsset[config.crossAssetId]) return;
  const currentCrossAsset = readJson(PATHS.crossAsset);
  const asset = currentCrossAsset.categories.flatMap((c) => c.assets).find((a) => a.id === config.crossAssetId);
  const previous = nextState.crossAsset[config.crossAssetId];
  const previousStdDev =
    previous.zscore === 0 ? null : Math.abs((previous.current - asset.baseline90d) / previous.zscore);
  const zscore = previousStdDev ? round((quote.price - asset.baseline90d) / previousStdDev, 2) : previous.zscore;
  nextState.crossAsset[config.crossAssetId] = {
    ...previous,
    current: round(quote.price, 2),
    change1d: signedPct(quote.changePct),
    zscore,
    signal: signalForZscore(zscore),
    source: quote.source,
    sourceDate: quote.sourceDate,
    status: "confirmed",
  };
}

const nextState = structuredClone(state);
const report = [];

for (const config of LIQUID_QUOTES) {
  const quote = await fetchQuote(config);
  const existing = nextState.fallbackQuotes.find((item) => item.symbol === config.symbol);
  if (!existing) {
    report.push(`${config.symbol}: skipped - no existing fallback quote`);
    continue;
  }

  if (quote.error) {
    existing.status = "carried";
    report.push(`${config.symbol}: carried previous value (${quote.error})`);
    continue;
  }

  existing.price = round(quote.price, config.symbol === "GC=F" ? 2 : 2);
  existing.change = round(quote.change, 2);
  existing.changePct = round(quote.changePct, 2);
  existing.lastUpdated = nextState.asOf;
  existing.source = quote.source;
  existing.sourceDate = quote.sourceDate;
  existing.status = "confirmed";
  updateCrossAssetFromQuote(nextState, config, quote);
  report.push(`${config.symbol}: ${existing.price} (${existing.changePct > 0 ? "+" : ""}${existing.changePct}%, ${quote.source} ${quote.sourceDate})`);
}

nextState.fallbackCommentLines = [
  `Static fallback - generated from src/data/daily-state.json (${nextState.asOf.slice(0, 10)}; ${nextState.day})`,
  nextState.fallbackQuotes
    .map((q) => `${q.name} ${q.price} (${q.source} ${q.sourceDate}, ${q.status})`)
    .join("; "),
];

if (!dryRun) writeJson(PATHS.state, nextState);

console.log(`daily:fetch ${dryRun ? "dry-run " : ""}result:`);
for (const line of report) console.log(`- ${line}`);
