import fs from "node:fs";
import path from "node:path";
import {
  computeCommercialEvaluation,
  PATHS,
  formatDateOnly,
  loadState,
  parseArgs,
  readJson,
  readText,
  requireValidState,
  summarizeEvidenceAudit,
  validateEvidenceAudit,
  validateStateShape,
} from "./daily-common.mjs";
import { prepareEnergyPromotion } from "./energy-lng-promote.mjs";
import { prepareClimatePromotion } from "./climate-promote.mjs";
import { readClimateTargetData, validateClimateReadModel } from "./climate-refresh.mjs";

const { dryRun } = parseArgs();
const baseState = loadState();
const baseExposure = readJson(PATHS.exposure);
const energyPromotion = prepareEnergyPromotion({ state: baseState, exposure: baseExposure });
if (energyPromotion.errors.length) {
  throw new Error(`Energy/LNG promotion gate failed; promoted runtime was left unchanged:\n- ${energyPromotion.errors.join("\n- ")}`);
}
const climatePromotion = prepareClimatePromotion();
if (climatePromotion.errors.length) {
  throw new Error(`Climate promotion gate failed; promoted read model was left unchanged:\n- ${climatePromotion.errors.join("\n- ")}`);
}
const state = energyPromotion.state;
const authoredExposure = energyPromotion.exposure;
requireValidState(state);
const evidenceAudit = readJson(PATHS.evidenceAudit);
const evidenceErrors = validateEvidenceAudit(state, authoredExposure, evidenceAudit);
if (evidenceErrors.length) {
  throw new Error(`evidence audit validation failed:\n- ${evidenceErrors.join("\n- ")}`);
}
const evidenceSummary = summarizeEvidenceAudit(authoredExposure, evidenceAudit);

const changed = new Set();
const pendingWrites = new Map();

function writeText(file, text) {
  pendingWrites.set(file, text);
}

function stagedText(file) {
  if (pendingWrites.has(file)) return pendingWrites.get(file);
  return readText(file);
}

function mark(file, before, after) {
  if (before !== after) changed.add(file);
}

function publicDataPath(sourceFile) {
  return path.join(PATHS.publicData, path.basename(sourceFile));
}

function mirrorPublicJson(sourceFile) {
  const publicFile = publicDataPath(sourceFile);
  const before = fs.existsSync(publicFile) ? readText(publicFile) : "";
  const after = pendingWrites.has(sourceFile) || fs.existsSync(sourceFile)
    ? stagedText(sourceFile)
    : sourceFile === PATHS.energyRuntime && energyPromotion.runtime
      ? `${JSON.stringify(energyPromotion.runtime, null, 2)}\n`
      : sourceFile === PATHS.energyReadModel && energyPromotion.readModel
        ? `${JSON.stringify(energyPromotion.readModel, null, 2)}\n`
        : "";
  if (!after) throw new Error(`Cannot mirror missing source file ${sourceFile}`);
  mark(publicFile, before, after);
  writeText(publicFile, after);
}

function patchAssetCollections(collections, values) {
  for (const category of collections) {
    for (const asset of category.assets) {
      const update = values[asset.id];
      if (!update) continue;
      asset.current = update.current;
      asset.change1d = update.change1d;
      asset.zscore = update.zscore;
      asset.signal = update.signal;
    }
  }
}

function applyCrossAsset() {
  const before = readText(PATHS.crossAsset);
  const data = JSON.parse(before);
  data.asOf = state.asOf;
  patchAssetCollections(data.categories, state.crossAsset);
  const after = `${JSON.stringify(data, null, 2)}\n`;
  mark(PATHS.crossAsset, before, after);
  writeText(PATHS.crossAsset, after, dryRun);
}

function applyPromotedEnergyState() {
  if (!energyPromotion.promoted) return;
  const before = readText(PATHS.state);
  const after = `${JSON.stringify(state, null, 2)}\n`;
  mark(PATHS.state, before, after);
  writeText(PATHS.state, after, dryRun);
}

function applyConflict() {
  const before = readText(PATHS.conflict);
  const data = JSON.parse(before);
  data.escalationLevel = state.crisis.level;
  data.escalationLabel = state.crisis.label;
  data.deltaVsYesterday = state.deltaVsYesterday;
  data.todaysEvents = state.todaysEvents;
  data.scenarios = state.scenarios;
  const after = `${JSON.stringify(data, null, 2)}\n`;
  mark(PATHS.conflict, before, after);
  writeText(PATHS.conflict, after, dryRun);
}

function applyCharts() {
  const before = readText(PATHS.charts);
  const data = JSON.parse(before);
  const existingIndex = data.days.findIndex((entry) => entry.day === state.volatilityDay.day);
  if (existingIndex >= 0) {
    data.days[existingIndex] = state.volatilityDay;
  } else {
    data.days.push(state.volatilityDay);
  }
  const after = `${JSON.stringify(data, null, 2)}\n`;
  mark(PATHS.charts, before, after);
  writeText(PATHS.charts, after, dryRun);
}

function applyCommodities() {
  const before = readText(PATHS.commodities);
  const data = JSON.parse(before);
  data.asOf = state.asOf;
  data.day = state.day;
  data.scenario = state.commodityScenario;
  data.marketContext = state.marketContext;
  patchAssetCollections(data.categories, state.commodities);
  const after = `${JSON.stringify(data, null, 2)}\n`;
  mark(PATHS.commodities, before, after);
  writeText(PATHS.commodities, after, dryRun);
}

function applyExposureTraces() {
  const before = readText(PATHS.exposure);
  const data = structuredClone(authoredExposure);
  if (energyPromotion.promoted) {
    const after = `${JSON.stringify(data, null, 2)}\n`;
    mark(PATHS.exposure, before, after);
    writeText(PATHS.exposure, after, dryRun);
    return;
  }
  data.asOf = state.asOf;
  data.day = state.day;
  data.headline = state.traceInputs.headline;

  const patchMetric = (metric) => {
    const update = state.traceInputs.metrics[metric.inputId];
    if (!update) {
      throw new Error(`Exposure metric ${metric.inputId} has no matching daily-state trace input`);
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
      "cadence",
      "observationKind",
      "periodStart",
      "periodEnd",
      "coverageStatus",
      "coverageNote",
      "sourceAgeDays",
      "machineEvidenceIds",
      "carryReason",
      "missingReason",
    ]) {
      if (update[key] === undefined) delete metric[key];
      else metric[key] = update[key];
    }
  };

  for (const trace of data.traces) {
    for (const hop of trace.hops) {
      for (const metric of hop.metrics) patchMetric(metric);
    }
    trace.commercialEvaluation = computeCommercialEvaluation(
      trace.commercialEvaluation,
      state.commercialInputs,
      state.asOf,
    );
  }

  data.commercialInputs = data.commercialInputs.map((input) => {
    const update = state.commercialInputs[input.inputId];
    if (!update) throw new Error(`Commercial input ${input.inputId} has no matching daily-state input`);
    return { inputId: input.inputId, ...update };
  });

  for (const evidence of data.evidence) {
    const update = state.traceInputs.evidenceUpdates[evidence.id];
    if (!update) continue;
    Object.assign(evidence, update);
  }

  const after = `${JSON.stringify(data, null, 2)}\n`;
  mark(PATHS.exposure, before, after);
  writeText(PATHS.exposure, after, dryRun);
}

function applyEnergyRuntime() {
  if (!energyPromotion.runtime) return;
  const runtimeBefore = fs.existsSync(PATHS.energyRuntime) ? readText(PATHS.energyRuntime) : "";
  const runtimeAfter = `${JSON.stringify(energyPromotion.runtime, null, 2)}\n`;
  mark(PATHS.energyRuntime, runtimeBefore, runtimeAfter);
  writeText(PATHS.energyRuntime, runtimeAfter, dryRun);

  const readModelBefore = fs.existsSync(PATHS.energyReadModel) ? readText(PATHS.energyReadModel) : "";
  const readModelAfter = `${JSON.stringify(energyPromotion.readModel, null, 2)}\n`;
  mark(PATHS.energyReadModel, readModelBefore, readModelAfter);
  writeText(PATHS.energyReadModel, readModelAfter, dryRun);
}

function applyClimateReadModel() {
  if (!climatePromotion.promoted) return;
  const before = readText(PATHS.climateReadModel);
  const after = `${JSON.stringify(climatePromotion.readModel, null, 2)}\n`;
  mark(PATHS.climateReadModel, before, after);
  writeText(PATHS.climateReadModel, after, dryRun);
}

function formatQuote(quote) {
  return `  { symbol: ${JSON.stringify(quote.symbol)}, name: ${JSON.stringify(quote.name)}, price: ${quote.price}, change: ${quote.change}, changePct: ${quote.changePct}, currency: ${JSON.stringify(quote.currency)}, unit: ${JSON.stringify(quote.unit)}, lastUpdated: ${JSON.stringify(quote.lastUpdated)} },`;
}

function applyUseMarkets() {
  const before = readText(PATHS.useMarkets);
  const summary = state.fallbackCommentLines.map((line) => `// ${line}`).join("\n");
  const quotesBlock = `const FALLBACK_QUOTES: MarketQuote[] = [\n${state.fallbackQuotes.map(formatQuote).join("\n")}\n];`;
  const after = before.replace(
    /\/\/ Static fallback[\s\S]*?const FALLBACK_QUOTES: MarketQuote\[\] = \[[\s\S]*?\];/,
    `${summary}\n${quotesBlock}`,
  );
  if (after === before && !before.includes(quotesBlock)) {
    throw new Error("Could not replace FALLBACK_QUOTES block in useMarkets.ts");
  }
  mark(PATHS.useMarkets, before, after);
  writeText(PATHS.useMarkets, after, dryRun);
}

function replaceConst(source, name, value) {
  const pattern = new RegExp(`const ${name} = ${JSON.stringify(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")};`);
  if (pattern.test(source)) return source;
  const generic = new RegExp(`const ${name} = "(?:\\\\.|[^"])*";`);
  const after = source.replace(generic, `const ${name} = ${JSON.stringify(value)};`);
  if (after === source) throw new Error(`Could not replace ${name} in MarketsWidget.tsx`);
  return after;
}

function applyMarketsWidget() {
  const before = readText(PATHS.marketsWidget);
  const after = replaceConst(before, "TOP_ALERT", state.topAlert);
  mark(PATHS.marketsWidget, before, after);
  writeText(PATHS.marketsWidget, after, dryRun);
}

function applyRunbook() {
  const before = readText(PATHS.runbook);
  let after = before;
  after = after.replace(
    /\| \*\*Last updated\*\* \| .* \|/,
    `| **Last updated** | ${formatDateOnly(state.asOf)} (${state.day}) |`,
  );
  after = after.replace(
    /\| \*\*Crisis level\*\* \| .* \|/,
    `| **Crisis level** | ${state.crisis.level} - ${state.crisis.label} (${state.crisis.detail}) |`,
  );
  after = after.replace(/\| \*\*Brent\*\* \| .* \|/, `| **Brent** | ${state.runbookState.brent} |`);
  after = after.replace(/\| \*\*JKM\*\* \| .* \|/, `| **JKM** | ${state.runbookState.jkm} |`);
  after = after.replace(/\| \*\*TTF\*\* \| .* \|/, `| **TTF** | ${state.runbookState.ttf} |`);
  after = after.replace(
    /\| \*\*Exposure trace\*\* \| .* \|/,
    `| **Exposure trace** | ${state.traceInputs.headline} |`,
  );
  after = after.replace(
    /\| \*\*Evidence audit\*\* \| .* \|/,
    `| **Evidence audit** | ${evidenceSummary.checked} checked · ${evidenceSummary.verified} verified · ${evidenceSummary.carried} carried · ${evidenceSummary.unsupported} unsupported · PASS |`,
  );
  const commercialSummary = authoredExposure.traces
    .map((trace) => {
      const evaluation = computeCommercialEvaluation(
        trace.commercialEvaluation,
        state.commercialInputs,
        state.asOf,
      );
      return `${trace.title}: ${evaluation.dataStatus} (${evaluation.residualStatus.replaceAll("-", " ")})`;
    })
    .join("; ");
  after = after.replace(
    /\| \*\*Commercial evaluation\*\* \| .* \|/,
    `| **Commercial evaluation** | ${commercialSummary} |`,
  );

  for (const [label, text] of Object.entries(state.priceNarratives)) {
    const pattern = new RegExp(`- \\*\\*${label}\\*\\*: .*`);
    after = after.replace(pattern, `- **${label}**: ${text}`);
  }

  mark(PATHS.runbook, before, after);
  writeText(PATHS.runbook, after, dryRun);
}

function applyTimeline() {
  const before = fs.existsSync(PATHS.timeline) ? readText(PATHS.timeline) : "";
  const lines = before.trimEnd().split("\n");
  const entryPrefix = `- **${state.day}**:`;
  const entry = state.timelineEntry;
  const idx = lines.findIndex((line) => line.startsWith(entryPrefix));
  if (idx >= 0) lines[idx] = entry;
  else lines.push(entry);
  const after = `${lines.join("\n")}\n`;
  mark(PATHS.timeline, before, after);
  writeText(PATHS.timeline, after, dryRun);
}

applyPromotedEnergyState();
applyCrossAsset();
applyConflict();
applyCharts();
applyCommodities();
applyExposureTraces();
applyEnergyRuntime();
applyClimateReadModel();
applyUseMarkets();
applyMarketsWidget();
applyRunbook();
applyTimeline();

for (const file of [
  PATHS.state,
  PATHS.crossAsset,
  PATHS.conflict,
  PATHS.charts,
  PATHS.commodities,
  PATHS.exposure,
  PATHS.intelEvents,
  PATHS.energyRuntime,
  PATHS.energyReadModel,
  PATHS.climateReadModel,
]) {
  mirrorPublicJson(file);
}

const jsonFiles = [
  PATHS.state,
  PATHS.crossAsset,
  PATHS.conflict,
  PATHS.charts,
  PATHS.commodities,
  PATHS.exposure,
  PATHS.intelEvents,
  PATHS.energyRuntime,
  PATHS.energyReadModel,
  PATHS.climateReadModel,
];

function validateStagedBundle() {
  const errors = [];
  const staged = new Map();
  for (const file of jsonFiles) {
    try {
      staged.set(file, JSON.parse(stagedText(file)));
    } catch (error) {
      errors.push(`${file} staged output is not valid JSON: ${error.message}`);
    }
  }
  const stagedState = staged.get(PATHS.state);
  const stagedExposure = staged.get(PATHS.exposure);
  const stagedRuntime = staged.get(PATHS.energyRuntime);
  const stagedReadModel = staged.get(PATHS.energyReadModel);
  const stagedClimateReadModel = staged.get(PATHS.climateReadModel);
  errors.push(...validateStateShape(stagedState || {}));
  errors.push(...validateClimateReadModel(stagedClimateReadModel || {}, { targetData: readClimateTargetData() }));
  if (energyPromotion.promoted) {
    if (JSON.stringify(stagedExposure) !== JSON.stringify(stagedReadModel)) {
      errors.push("staged promoted Energy/LNG read model is out of sync with exposure-traces");
    }
    if (stagedRuntime?.domain?.asOf !== stagedState?.asOf) errors.push("staged Energy/LNG runtime asOf is out of sync");
    if (stagedRuntime?.domain?.machineEvidence && JSON.stringify(stagedRuntime.domain.machineEvidence) !== JSON.stringify(stagedReadModel?.machineEvidence ?? [])) {
      errors.push("staged Energy/LNG runtime machine evidence is out of sync");
    }
  }
  const stagedCrossAsset = staged.get(PATHS.crossAsset);
  for (const category of stagedCrossAsset?.categories ?? []) {
    for (const asset of category.assets ?? []) {
      const expected = stagedState?.crossAsset?.[asset.id];
      if (!expected) continue;
      for (const key of ["current", "change1d", "zscore", "signal"]) {
        if (String(asset[key]) !== String(expected[key])) errors.push(`staged crossAsset.${asset.id}.${key} is out of sync`);
      }
    }
  }
  for (const trace of stagedExposure?.traces ?? []) {
    for (const hop of trace.hops ?? []) {
      for (const metric of hop.metrics ?? []) {
        const expected = stagedState?.traceInputs?.metrics?.[metric.inputId];
        if (!expected) {
          errors.push(`staged exposure metric ${metric.inputId} has no matching daily-state input`);
          continue;
        }
        for (const key of ["value", "low", "high", "unit", "status", "source", "sourceDate", "observedAt", "maxAgeDays", "cadence", "carryReason", "missingReason"]) {
          if ((metric[key] ?? null) !== (expected[key] ?? null)) errors.push(`staged exposure metric ${metric.inputId}.${key} is out of sync`);
        }
      }
    }
  }
  if (errors.length) throw new Error(`staged publication bundle validation failed:\n- ${errors.join("\n- ")}`);
}

validateStagedBundle();

if (!dryRun) {
  for (const [file, content] of pendingWrites) fs.writeFileSync(file, content);
}

if (dryRun) {
  console.log(`daily:apply dry-run would update ${changed.size} file(s):`);
} else {
  console.log(`daily:apply updated ${changed.size} file(s):`);
}
for (const file of changed) console.log(`- ${file}`);
