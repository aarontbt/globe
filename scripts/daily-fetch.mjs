import {
  PATHS,
  loadState,
  parseArgs,
  readJson,
  signalForZscore,
  writeJson,
} from "./daily-common.mjs";
import { pathToFileURL } from "node:url";

const { dryRun } = parseArgs();
const state = loadState();

export const LIQUID_QUOTES = [
  { symbol: "BZ=F", stooq: "bz.f", crossAssetId: "brent", commercialInputId: "oil-brent", evidenceId: "e-brent", name: "Brent Crude", unit: "/barrel" },
  { symbol: "CL=F", stooq: "cl.f", commercialInputId: "oil-wti", evidenceId: "e-wti", name: "WTI Crude", unit: "/barrel" },
  { symbol: "TTF=F", stooq: null, crossAssetId: "ttf", traceInputId: "ttf", commercialInputId: "lng-ttf", evidenceId: "e-ttf", name: "Dutch TTF", unit: "EUR/MWh" },
  { symbol: "EURUSD=X", stooq: "eurusd", commercialInputId: "fx-eurusd", evidenceId: "e-eurusd", name: "EUR/USD", unit: "USD/EUR" },
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

export async function fetchYahoo(symbol) {
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
    source: `Yahoo Finance ${symbol}`,
    observedAt: Number.isFinite(Number(meta.regularMarketTime))
      ? new Date(Number(meta.regularMarketTime) * 1000).toISOString()
      : new Date().toISOString(),
    sourceDate: Number.isFinite(Number(meta.regularMarketTime))
      ? new Date(Number(meta.regularMarketTime) * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  };
}

export async function fetchStooq(stooqSymbol) {
  if (!stooqSymbol) throw new Error("Stooq fallback not configured");
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
  return { price: close, change, changePct, source: `Stooq ${stooqSymbol}`, sourceDate: date, observedAt: `${date}T00:00:00Z` };
}

export async function fetchQuote(config) {
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

function updateTraceInputFromQuote(nextState, config, quote) {
  if (!config.traceInputId) return;
  const metric = nextState.traceInputs?.metrics?.[config.traceInputId];
  if (!metric) return;
  metric.value = round(quote.price, 2);
  delete metric.low;
  delete metric.high;
  metric.status = "confirmed";
  metric.source = quote.source;
  metric.sourceDate = quote.sourceDate;
  metric.observedAt = quote.observedAt;
  delete metric.carryReason;

  const evidence = nextState.traceInputs?.evidenceUpdates?.[config.evidenceId ?? `e-${config.traceInputId}`];
  if (evidence) {
    evidence.lastChecked = String(nextState.asOf).slice(0, 10);
    evidence.status = "confirmed";
    evidence.note = `Machine-refreshed from ${quote.source}.`;
  }
}

function updateCommercialInputFromQuote(nextState, config, quote) {
  if (!config.commercialInputId) return;
  const input = nextState.commercialInputs?.[config.commercialInputId];
  if (!input) return;
  input.value = round(quote.price, config.symbol === "EURUSD=X" ? 4 : 2);
  delete input.low;
  delete input.high;
  input.status = "confirmed";
  input.source = quote.source;
  input.sourceDate = quote.sourceDate;
  input.observedAt = quote.observedAt;
  delete input.carryReason;
  delete input.missingReason;

  const evidence = nextState.traceInputs?.evidenceUpdates?.[config.evidenceId];
  if (evidence) {
    evidence.lastChecked = String(nextState.asOf).slice(0, 10);
    evidence.status = "confirmed";
    evidence.note = `Machine-refreshed from ${quote.source}.`;
  }
}

function updateRunbookQuote(nextState, config, quote) {
  if (!nextState.runbookState) return;
  const price = round(quote.price, 2).toFixed(2);
  const changePct = round(quote.changePct, 2);
  const signedChange = `${changePct > 0 ? "+" : ""}${changePct}%`;
  if (config.symbol === "BZ=F") {
    nextState.runbookState.brent = `$${price} (${quote.sourceDate}, ${quote.source}; ${signedChange})`;
  }
  if (config.symbol === "TTF=F") {
    nextState.runbookState.ttf = `${price} EUR/MWh (${quote.sourceDate}, ${quote.source}; ${signedChange})`;
  }
}

export async function fetchSofr() {
  const url = "https://markets.newyorkfed.org/api/rates/secured/sofr/last/1.json";
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`New York Fed SOFR: ${res.status}`);
  const row = (await res.json())?.refRates?.[0];
  const value = Number(row?.percentRate);
  if (!Number.isFinite(value)) throw new Error("New York Fed SOFR: invalid percentRate");
  return {
    price: value,
    change: 0,
    changePct: 0,
    source: "Federal Reserve Bank of New York",
    sourceDate: row.effectiveDate,
    observedAt: `${row.effectiveDate}T00:00:00Z`,
  };
}

export async function runDailyFetch() {
  const nextState = structuredClone(state);
  const report = [];

  for (const config of LIQUID_QUOTES) {
    const quote = await fetchQuote(config);
    const existing = nextState.fallbackQuotes.find((item) => item.symbol === config.symbol);

    if (quote.error) {
      if (existing) existing.status = "carried";
      const metric = config.traceInputId
        ? nextState.traceInputs?.metrics?.[config.traceInputId]
        : null;
      if (metric) {
        metric.status = "carried";
        metric.carryReason = `Machine refresh failed: ${quote.error}`;
      }
      const commercialInput = config.commercialInputId
        ? nextState.commercialInputs?.[config.commercialInputId]
        : null;
      if (commercialInput && commercialInput.status !== "unavailable") {
        commercialInput.status = "carried";
        commercialInput.carryReason = `Machine refresh failed: ${quote.error}`;
      }
      report.push(`${config.symbol}: carried previous value (${quote.error})`);
      continue;
    }

    if (existing) {
      existing.price = round(quote.price, 2);
      existing.change = round(quote.change, 2);
      existing.changePct = round(quote.changePct, 2);
      existing.lastUpdated = quote.observedAt;
      existing.source = quote.source;
      existing.sourceDate = quote.sourceDate;
      existing.status = "confirmed";
    }
    updateCrossAssetFromQuote(nextState, config, quote);
    updateTraceInputFromQuote(nextState, config, quote);
    updateCommercialInputFromQuote(nextState, config, quote);
    updateRunbookQuote(nextState, config, quote);
    const price = round(quote.price, 2);
    const changePct = round(quote.changePct, 2);
    report.push(`${config.symbol}: ${price} (${changePct > 0 ? "+" : ""}${changePct}%, ${quote.source} ${quote.sourceDate})`);
  }

  try {
    const sofr = await fetchSofr();
    updateCommercialInputFromQuote(
      nextState,
      { commercialInputId: "usd-sofr", evidenceId: "e-sofr", symbol: "SOFR" },
      sofr,
    );
    report.push(`SOFR: ${sofr.price}% (${sofr.source} ${sofr.sourceDate})`);
  } catch (error) {
    const input = nextState.commercialInputs?.["usd-sofr"];
    if (input && input.status !== "unavailable") {
      input.status = "carried";
      input.carryReason = `Machine refresh failed: ${error.message}`;
    }
    report.push(`SOFR: carried previous value (${error.message})`);
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
  return { nextState, report, dryRun };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runDailyFetch();
}
