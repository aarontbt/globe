import {
  CROSS_ASSET_IDS,
  COMMODITY_IDS,
  PATHS,
  loadState,
  readJson,
  readText,
  validateStateShape,
} from "./daily-common.mjs";
import path from "node:path";

const errors = [];
const state = loadState();
errors.push(...validateStateShape(state));

function fail(message) {
  errors.push(message);
}

function sameNumber(a, b) {
  return Number(a) === Number(b);
}

for (const file of [PATHS.crossAsset, PATHS.conflict, PATHS.charts, PATHS.commodities]) {
  try {
    readJson(file);
  } catch (err) {
    fail(`${file} is not valid JSON: ${err.message}`);
  }

  const publicFile = path.join(PATHS.publicData, path.basename(file));
  try {
    if (readText(file) !== readText(publicFile)) fail(`${publicFile} is out of sync with ${file}`);
  } catch (err) {
    fail(`${publicFile} cannot be read: ${err.message}`);
  }
}

const crossAsset = readJson(PATHS.crossAsset);
if (crossAsset.asOf !== state.asOf) fail("banker-cross-asset.asOf does not match daily-state.asOf");
for (const category of crossAsset.categories) {
  for (const asset of category.assets) {
    if (!CROSS_ASSET_IDS.includes(asset.id)) continue;
    const expected = state.crossAsset[asset.id];
    if (!expected) continue;
    if (!sameNumber(asset.current, expected.current)) fail(`crossAsset.${asset.id}.current is out of sync`);
    if (asset.change1d !== expected.change1d) fail(`crossAsset.${asset.id}.change1d is out of sync`);
    if (!sameNumber(asset.zscore, expected.zscore)) fail(`crossAsset.${asset.id}.zscore is out of sync`);
    if (asset.signal !== expected.signal) fail(`crossAsset.${asset.id}.signal is out of sync`);
  }
}

const conflict = readJson(PATHS.conflict);
const scenarioValues = state.scenarios.map((s) => s.probability);
if (conflict.escalationLevel !== state.crisis.level) fail("banker-conflict.escalationLevel is out of sync");
if (conflict.escalationLabel !== state.crisis.label) fail("banker-conflict.escalationLabel is out of sync");
if (conflict.deltaVsYesterday !== state.deltaVsYesterday) fail("banker-conflict.deltaVsYesterday is out of sync");
if (conflict.scenarios.map((s) => s.probability).join(",") !== scenarioValues.join(",")) {
  fail("banker-conflict.scenarios are out of sync");
}

const charts = readJson(PATHS.charts);
const latest = charts.days.at(-1);
if (!latest) fail("charts-volatility.days is empty");
else {
  if (latest.day !== state.day) fail(`latest chart day ${latest.day} does not match ${state.day}`);
  if ((latest.scenarios ?? []).join(",") !== scenarioValues.join(",")) fail("latest chart scenarios do not match daily-state scenarios");
}

const commodities = readJson(PATHS.commodities);
if (commodities.asOf !== state.asOf) fail("commodities-impact.asOf does not match daily-state.asOf");
if (commodities.marketContext !== state.marketContext) fail("commodities-impact.marketContext is out of sync");
for (const category of commodities.categories) {
  for (const asset of category.assets) {
    if (!COMMODITY_IDS.includes(asset.id)) continue;
    const expected = state.commodities[asset.id];
    if (!expected) continue;
    if (!sameNumber(asset.current, expected.current)) fail(`commodities.${asset.id}.current is out of sync`);
    if (asset.change1d !== expected.change1d) fail(`commodities.${asset.id}.change1d is out of sync`);
    if (!sameNumber(asset.zscore, expected.zscore)) fail(`commodities.${asset.id}.zscore is out of sync`);
    if (asset.signal !== expected.signal) fail(`commodities.${asset.id}.signal is out of sync`);
  }
}

const useMarkets = readText(PATHS.useMarkets);
for (const quote of state.fallbackQuotes) {
  if (!useMarkets.includes(`symbol: "${quote.symbol}"`) || !useMarkets.includes(`price: ${quote.price}`)) {
    fail(`useMarkets FALLBACK_QUOTES missing ${quote.symbol} ${quote.price}`);
  }
}

const widget = readText(PATHS.marketsWidget);
for (const [name, value] of [
  ["NEAR_TERM_RANGE", state.nearTermRange],
  ["SUSTAINED_PRICE", state.sustainedPrice],
  ["TOP_ALERT", state.topAlert],
]) {
  if (!widget.includes(`const ${name} = ${JSON.stringify(value)};`)) fail(`MarketsWidget ${name} is out of sync`);
}

const prompt = readText(PATHS.prompt);
if (/\| \*\*asOf\*\* \|/.test(prompt) || /\| \*\*Day\*\* \|/.test(prompt)) {
  fail("daily-agent-prompt still contains a duplicated state block");
}

const runbook = readText(PATHS.runbook);
if (runbook.includes("### Crisis Timeline")) {
  fail("daily-update-runbook still contains embedded Crisis Timeline section");
}

const timeline = readText(PATHS.timeline);
const timelineMatches = timeline.split("\n").filter((line) => line.startsWith(`- **${state.day}**:`));
if (timelineMatches.length !== 1) fail(`crisis timeline must contain exactly one entry for ${state.day}`);

if (errors.length) {
  console.error(`daily:check failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("daily:check passed");
