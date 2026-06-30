import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
export const STATE_PATH = path.join(ROOT, "src/data/daily-state.json");

export const PATHS = {
  state: STATE_PATH,
  publicData: path.join(ROOT, "public/data"),
  crossAsset: path.join(ROOT, "src/data/banker-cross-asset.json"),
  conflict: path.join(ROOT, "src/data/banker-conflict.json"),
  charts: path.join(ROOT, "src/data/charts-volatility.json"),
  commodities: path.join(ROOT, "src/data/commodities-impact.json"),
  useMarkets: path.join(ROOT, "src/hooks/useMarkets.ts"),
  marketsWidget: path.join(ROOT, "src/components/MarketsWidget.tsx"),
  runbook: path.join(ROOT, "docs/daily-update-runbook.md"),
  prompt: path.join(ROOT, "docs/daily-agent-prompt.md"),
  timeline: path.join(ROOT, "docs/crisis-timeline-archive.md"),
};

export const CROSS_ASSET_IDS = [
  "brent",
  "ttf",
  "lng-ja",
  "id10y",
  "ph10y",
  "th10y",
  "asean-ig",
  "asean-hy",
  "sgd",
  "idr",
  "myr",
  "thb",
  "php",
  "energy-eq",
  "shipping-eq",
  "banks-eq",
];

export const COMMODITY_IDS = [
  "wheat",
  "corn",
  "soybeans",
  "palm-oil",
  "rice",
  "naphtha",
  "ethylene",
  "methanol",
  "urea",
  "dap",
  "potash",
  "bdi",
  "vlcc",
  "scfi",
];

export function readText(file) {
  return fs.readFileSync(file, "utf8");
}

export function writeText(file, text, dryRun = false) {
  if (!dryRun) fs.writeFileSync(file, text);
}

export function readJson(file) {
  return JSON.parse(readText(file));
}

export function writeJson(file, value, dryRun = false) {
  writeText(file, `${JSON.stringify(value, null, 2)}\n`, dryRun);
}

export function loadState() {
  return readJson(STATE_PATH);
}

export function formatJsonInline(value) {
  return JSON.stringify(value);
}

export function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

export function formatDateOnly(iso) {
  return String(iso).slice(0, 10);
}

export function signalForZscore(zscore) {
  const abs = Math.abs(Number(zscore));
  if (abs > 2) return "red";
  if (abs >= 1) return "amber";
  return "green";
}

export function validateStateShape(state) {
  const errors = [];
  const changePattern = /^([+-]\d+(\.\d+)?%|[+-]\d+(\.\d+)?bp|0\.0%)$/;
  const statuses = new Set(["confirmed", "estimated", "carried", "inferred"]);

  assert(state.schemaVersion === 1, "schemaVersion must be 1", errors);
  assert(Boolean(state.asOf), "asOf is required", errors);
  assert(Boolean(state.day), "day is required", errors);
  assert(Boolean(state.crisis?.label), "crisis.label is required", errors);
  assert(Number.isInteger(state.crisis?.level), "crisis.level must be an integer", errors);
  assert(Number.isInteger(state.deltaVsYesterday), "deltaVsYesterday must be an integer", errors);
  assert(Boolean(state.marketContext), "marketContext is required", errors);
  assert(Boolean(state.topAlert), "topAlert is required", errors);
  assert(Boolean(state.nearTermRange), "nearTermRange is required", errors);
  assert(Boolean(state.sustainedPrice), "sustainedPrice is required", errors);
  assert(Boolean(state.timelineEntry), "timelineEntry is required", errors);

  const scenarios = state.scenarios ?? [];
  assert(scenarios.length === 3, "scenarios must contain exactly 3 entries", errors);
  const scenarioSum = scenarios.reduce((sum, s) => sum + Number(s.probability ?? 0), 0);
  assert(scenarioSum === 100, `scenario probabilities must sum to 100, got ${scenarioSum}`, errors);
  for (const id of ["base", "stress", "tail"]) {
    assert(scenarios.some((s) => s.id === id), `scenario ${id} is required`, errors);
  }

  const events = state.todaysEvents ?? [];
  assert(events.length === 3, "todaysEvents must contain exactly 3 entries", errors);
  for (const event of events) {
    assert(Boolean(event.id), "todaysEvents entries require id", errors);
    assert(Boolean(event.summary), `todaysEvents.${event.id ?? "?"}.summary is required`, errors);
    assert(["up", "down", "neutral"].includes(event.direction), `todaysEvents.${event.id ?? "?"}.direction is invalid`, errors);
  }

  for (const id of CROSS_ASSET_IDS) {
    const item = state.crossAsset?.[id];
    assert(Boolean(item), `crossAsset.${id} is required`, errors);
    if (!item) continue;
    assert(typeof item.current === "number", `crossAsset.${id}.current must be a number`, errors);
    assert(changePattern.test(item.change1d), `crossAsset.${id}.change1d must be signed or 0.0%`, errors);
    assert(typeof item.zscore === "number", `crossAsset.${id}.zscore must be a number`, errors);
    assert(["green", "amber", "red"].includes(item.signal), `crossAsset.${id}.signal is invalid`, errors);
    assert(Boolean(item.source), `crossAsset.${id}.source is required`, errors);
    assert(Boolean(item.sourceDate), `crossAsset.${id}.sourceDate is required`, errors);
    assert(statuses.has(item.status), `crossAsset.${id}.status is invalid`, errors);
  }

  for (const id of COMMODITY_IDS) {
    const item = state.commodities?.[id];
    assert(Boolean(item), `commodities.${id} is required`, errors);
    if (!item) continue;
    assert(typeof item.current === "number", `commodities.${id}.current must be a number`, errors);
    assert(changePattern.test(item.change1d), `commodities.${id}.change1d must be signed or 0.0%`, errors);
    assert(typeof item.zscore === "number", `commodities.${id}.zscore must be a number`, errors);
    assert(["green", "amber", "red"].includes(item.signal), `commodities.${id}.signal is invalid`, errors);
    assert(Boolean(item.source), `commodities.${id}.source is required`, errors);
    assert(Boolean(item.sourceDate), `commodities.${id}.sourceDate is required`, errors);
    assert(statuses.has(item.status), `commodities.${id}.status is invalid`, errors);
  }

  for (const quote of state.fallbackQuotes ?? []) {
    assert(Boolean(quote.symbol), "fallbackQuotes entries require symbol", errors);
    assert(typeof quote.price === "number", `fallbackQuotes.${quote.symbol}.price must be a number`, errors);
    assert(typeof quote.change === "number", `fallbackQuotes.${quote.symbol}.change must be a number`, errors);
    assert(typeof quote.changePct === "number", `fallbackQuotes.${quote.symbol}.changePct must be a number`, errors);
    assert(Boolean(quote.source), `fallbackQuotes.${quote.symbol}.source is required`, errors);
    assert(Boolean(quote.sourceDate), `fallbackQuotes.${quote.symbol}.sourceDate is required`, errors);
    assert(statuses.has(quote.status), `fallbackQuotes.${quote.symbol}.status is invalid`, errors);
  }
  assert((state.fallbackQuotes ?? []).length === 3, "fallbackQuotes must contain Brent, WTI, and Gold", errors);

  const vol = state.volatilityDay;
  assert(Boolean(vol), "volatilityDay is required", errors);
  if (vol) {
    assert(vol.day === state.day, "volatilityDay.day must match day", errors);
    assert(Array.isArray(vol.scenarios), "volatilityDay.scenarios must be an array", errors);
    assert((vol.scenarios ?? []).join(",") === scenarios.map((s) => s.probability).join(","), "volatilityDay.scenarios must match scenarios", errors);
  }

  return errors;
}

export function requireValidState(state) {
  const errors = validateStateShape(state);
  if (errors.length) {
    throw new Error(`daily-state validation failed:\n- ${errors.join("\n- ")}`);
  }
}

export function parseArgs(argv = process.argv.slice(2)) {
  return {
    dryRun: argv.includes("--dry-run"),
    checkOnly: argv.includes("--check"),
  };
}
