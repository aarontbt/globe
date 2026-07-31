import {
  CROSS_ASSET_IDS,
  COMMODITY_IDS,
  PATHS,
  TRACE_RELATIONSHIPS,
  TRACE_STAGES,
  computeCommercialEvaluation,
  loadState,
  readJson,
  readText,
  validateEvidenceAudit,
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

for (const file of [
  PATHS.state,
  PATHS.crossAsset,
  PATHS.conflict,
  PATHS.charts,
  PATHS.commodities,
  PATHS.exposure,
  PATHS.intelEvents,
]) {
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
if (commodities.day !== state.day) fail("commodities-impact.day does not match daily-state.day");
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

const exposure = readJson(PATHS.exposure);
let evidenceAudit;
try {
  evidenceAudit = readJson(PATHS.evidenceAudit);
} catch (err) {
  fail(`${PATHS.evidenceAudit} is not valid JSON: ${err.message}`);
  evidenceAudit = { entries: [] };
}
for (const error of validateEvidenceAudit(state, exposure, evidenceAudit)) fail(error);
if (exposure.asOf !== state.asOf) fail("exposure-traces.asOf does not match daily-state.asOf");
if (exposure.day !== state.day) fail("exposure-traces.day does not match daily-state.day");
if (exposure.headline !== state.traceInputs.headline) fail("exposure-traces.headline is out of sync");
if (exposure.schemaVersion !== 2) fail("exposure-traces schemaVersion must be 2");
if (exposure.traces?.length !== 3) fail("exposure-traces must contain exactly 3 traces");
if ("scenarios" in exposure) fail("exposure-traces must not contain scenario probabilities");
if ("assumptions" in exposure) fail("exposure-traces must not contain assumptions");

const entityIds = new Set((exposure.entities ?? []).map((item) => item.id));
const evidenceIds = new Set((exposure.evidence ?? []).map((item) => item.id));
const commercialInputIds = new Set((exposure.commercialInputs ?? []).map((item) => item.inputId));

function requireReferences(ids, knownIds, context) {
  for (const id of ids ?? []) {
    if (!knownIds.has(id)) fail(`${context} references unknown id ${id}`);
  }
}

function compareTraceMetric(metric, context) {
  const expected = state.traceInputs.metrics[metric.inputId];
  if (!expected) {
    fail(`${context} has unresolved trace input ${metric.inputId}`);
    return;
  }
  for (const key of [
    "value",
    "low",
    "high",
    "unit",
    "status",
    "source",
    "sourceDate",
    "observedAt",
    "maxAgeDays",
    "carryReason",
    "missingReason",
  ]) {
    if ((metric[key] ?? null) !== (expected[key] ?? null)) {
      fail(`${context}.${key} is out of sync with traceInputs.metrics.${metric.inputId}`);
    }
  }
  if ("assumptionIds" in metric) fail(`${context} must not contain assumptionIds`);
  if (metric.status === "confirmed" && (!metric.source || !metric.sourceDate)) {
    fail(`${context} confirmed metric requires source and sourceDate`);
  }
  if (metric.status === "unavailable" && (metric.value !== undefined || metric.low !== undefined || metric.high !== undefined)) {
    fail(`${context} unavailable metric must not contain a value or range`);
  }
}

for (const evidence of exposure.evidence ?? []) {
  const update = state.traceInputs.evidenceUpdates[evidence.id];
  if (update) {
    if (evidence.lastChecked !== update.lastChecked || evidence.status !== update.status) {
      fail(`evidence ${evidence.id} is out of sync with daily state`);
    }
    if (update.note !== undefined && evidence.note !== update.note) {
      fail(`evidence ${evidence.id}.note is out of sync with daily state`);
    }
  }
}
for (const evidenceId of Object.keys(state.traceInputs.evidenceUpdates)) {
  if (!evidenceIds.has(evidenceId)) fail(`traceInputs.evidenceUpdates has unresolved evidence id ${evidenceId}`);
}

for (const trace of exposure.traces ?? []) {
  if ((trace.hops ?? []).length !== TRACE_STAGES.length) {
    fail(`trace ${trace.id} must contain exactly ${TRACE_STAGES.length} hops`);
  }
  const stages = (trace.hops ?? []).map((hop) => hop.stage);
  if (stages.join(",") !== TRACE_STAGES.join(",")) {
    fail(`trace ${trace.id} stages must be ${TRACE_STAGES.join(" -> ")}`);
  }
  requireReferences(trace.routeEntityIds, entityIds, `trace ${trace.id}.routeEntityIds`);

  for (const hop of trace.hops ?? []) {
    requireReferences(hop.entityIds, entityIds, `trace ${trace.id} hop ${hop.id}.entityIds`);
    requireReferences(hop.evidenceIds, evidenceIds, `trace ${trace.id} hop ${hop.id}.evidenceIds`);
    if ("assumptionIds" in hop) fail(`trace ${trace.id} hop ${hop.id} must not contain assumptionIds`);
    for (const metric of hop.metrics ?? []) {
      compareTraceMetric(metric, `trace ${trace.id} hop ${hop.id} metric ${metric.inputId}`);
    }
  }
  for (const counterparty of trace.counterparties ?? []) {
    if (!TRACE_RELATIONSHIPS.includes(counterparty.relationship)) {
      fail(`trace ${trace.id} counterparty ${counterparty.entityId} has invalid relationship`);
    }
    requireReferences([counterparty.entityId], entityIds, `trace ${trace.id} counterparty`);
    requireReferences(counterparty.evidenceIds, evidenceIds, `trace ${trace.id} counterparty ${counterparty.entityId}.evidenceIds`);
  }

  const evaluation = trace.commercialEvaluation;
  for (const inputId of evaluation?.observedInputIds ?? []) {
    if (!commercialInputIds.has(inputId)) fail(`trace ${trace.id} references unknown commercial input ${inputId}`);
  }
  const expectedEvaluation = computeCommercialEvaluation(evaluation, state.commercialInputs, state.asOf);
  if (JSON.stringify(evaluation) !== JSON.stringify(expectedEvaluation)) {
    fail(`trace ${trace.id} commercial evaluation is not reproducible from daily state`);
  }
  if (evaluation.residualStatus !== "insufficient-verified-data") {
    const required = evaluation.requiredInputIds.map((id) => state.commercialInputs[id]);
    if (required.some((input) => input?.status !== "confirmed")) {
      fail(`trace ${trace.id} calculates a residual from non-current inputs`);
    }
  }
}

for (const input of exposure.commercialInputs ?? []) {
  const expected = state.commercialInputs[input.inputId];
  if (!expected) {
    fail(`exposure commercial input ${input.inputId} has no matching daily-state input`);
    continue;
  }
  if (JSON.stringify(input) !== JSON.stringify({ inputId: input.inputId, ...expected })) {
    fail(`commercial input ${input.inputId} is out of sync with daily state`);
  }
  if ("assumptionIds" in input) fail(`commercial input ${input.inputId} must not contain assumptionIds`);
}
for (const inputId of Object.keys(state.commercialInputs ?? {})) {
  if (!commercialInputIds.has(inputId)) fail(`daily-state commercialInputs.${inputId} is unresolved`);
}

const useMarkets = readText(PATHS.useMarkets);
for (const quote of state.fallbackQuotes) {
  if (!useMarkets.includes(`symbol: "${quote.symbol}"`) || !useMarkets.includes(`price: ${quote.price}`)) {
    fail(`useMarkets FALLBACK_QUOTES missing ${quote.symbol} ${quote.price}`);
  }
}

const widget = readText(PATHS.marketsWidget);
if (!widget.includes(`const TOP_ALERT = ${JSON.stringify(state.topAlert)};`)) {
  fail("MarketsWidget TOP_ALERT is out of sync");
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
