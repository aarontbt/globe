import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fetchQuote, fetchSofr, LIQUID_QUOTES } from "./daily-fetch.mjs";
import {
  buildSourceCoverage,
  loadSourceRegistry,
  parseAssetRegistryRecords,
  parseComtradeRecords,
  parseEiaRecords,
  parseRouteRecords,
  reconcileCandidates,
  runEnergyRefresh,
  resolveStableEntityId,
  stableRecordKey,
} from "./energy-lng-refresh.mjs";
import { prepareEnergyPromotion } from "./energy-lng-promote.mjs";
import { toEnergyLngDomain } from "../src/domain/energyLngAdapter.ts";
import {
  computeCommercialEvaluation,
  PATHS,
  STATE_PATH,
  loadState,
  readJson,
  validateEvidenceAudit,
  validateStateShape,
} from "./daily-common.mjs";

function hashState() {
  return createHash("sha256").update(readFileSync(STATE_PATH)).digest("hex");
}

const baseline = loadState();
const exposure = readJson(PATHS.exposure);
const evidenceAudit = readJson(PATHS.evidenceAudit);
assert(!LIQUID_QUOTES.some((quote) => quote.symbol === "GC=F"), "daily fetch must not request gold");
assert(LIQUID_QUOTES.some((quote) => quote.symbol === "EURUSD=X"), "daily fetch must request EUR/USD");
assert(!baseline.fallbackQuotes.some((quote) => quote.symbol === "GC=F"), "daily state must not contain gold");
assert.deepEqual(validateEvidenceAudit(baseline, exposure, evidenceAudit), [], "reviewed evidence audit should pass");

const unsupportedEvidence = structuredClone(evidenceAudit);
unsupportedEvidence.entries[0].contentStatus = "unsupported";
assert(
  validateEvidenceAudit(baseline, exposure, unsupportedEvidence).some((error) => error.includes("content is unsupported")),
  "unsupported evidence should be rejected",
);

const mismatchedEvidenceUrl = structuredClone(evidenceAudit);
mismatchedEvidenceUrl.entries[0].url = "https://example.com/wrong-source";
assert(
  validateEvidenceAudit(baseline, exposure, mismatchedEvidenceUrl).some((error) => error.includes("url does not match")),
  "evidence URL drift should be rejected",
);

const landingPageEvidence = structuredClone(evidenceAudit);
landingPageEvidence.entries[0].pageType = "landing-page";
assert(
  validateEvidenceAudit(baseline, exposure, landingPageEvidence).some((error) => error.includes("cannot use a landing page")),
  "landing-page evidence should be rejected",
);

const staleExposure = structuredClone(exposure);
const staleEvidenceAudit = structuredClone(evidenceAudit);
staleExposure.evidence.find((entry) => entry.id === "e-ttf").lastChecked = "2026-07-20";
staleEvidenceAudit.entries.find((entry) => entry.evidenceId === "e-ttf").checkedAt = "2026-07-20T00:00:00Z";
assert(
  validateEvidenceAudit(baseline, staleExposure, staleEvidenceAudit).some((error) => error.includes("above maxAgeDays")),
  "stale approved evidence should be rejected",
);

const futureEvidenceAudit = structuredClone(evidenceAudit);
futureEvidenceAudit.reviewedAt = "2999-01-01T00:00:00Z";
assert(
  validateEvidenceAudit(baseline, exposure, futureEvidenceAudit).some((error) => error.includes("cannot be in the future")),
  "future evidence review timestamps should be rejected",
);

const missingHopSupport = structuredClone(evidenceAudit);
missingHopSupport.entries.find((entry) => entry.evidenceId === "e-jkm-cfd").supportedHopIds = [];
assert(
  validateEvidenceAudit(baseline, exposure, missingHopSupport).some((error) => error.includes("does not support hop")),
  "evidence without explicit hop support should be rejected",
);

const unresolvedClaimReference = structuredClone(evidenceAudit);
unresolvedClaimReference.entries[0].supportedHopIds.push("missing-trace:missing-hop");
assert(
  validateEvidenceAudit(baseline, exposure, unresolvedClaimReference).some((error) => error.includes("references unknown hop")),
  "unresolved audited claim IDs should be rejected",
);

const mismatchedMarketObservation = structuredClone(evidenceAudit);
mismatchedMarketObservation.entries
  .find((entry) => entry.evidenceId === "e-jkm-cfd")
  .observations.find((observation) => observation.inputId === "jkm-cfd-reference").value = 21;
assert(
  validateEvidenceAudit(baseline, exposure, mismatchedMarketObservation).some((error) =>
    error.includes("observation jkm-cfd-reference.value does not match"),
  ),
  "market evidence that disagrees with a confirmed metric should be rejected",
);

const stale = structuredClone(baseline);
stale.traceInputs.metrics["jkm-cfd-reference"].sourceDate = "2026-06-01";
stale.traceInputs.metrics["jkm-cfd-reference"].status = "confirmed";
assert(
  validateStateShape(stale).some((error) => error.includes("traceInputs.metrics.jkm-cfd-reference is")),
  "stale confirmed trace input should be rejected",
);

const carried = structuredClone(stale);
carried.traceInputs.metrics["jkm-cfd-reference"].status = "carried";
carried.traceInputs.metrics["jkm-cfd-reference"].carryReason =
  "No newer dependable JKM-linked market reference is publicly available.";
assert(
  !validateStateShape(carried).some((error) => error.includes("traceInputs.metrics.jkm-cfd-reference")),
  "explicitly carried trace input should pass freshness validation",
);

const assumedMetric = structuredClone(baseline);
assumedMetric.traceInputs.metrics["qatar-volume-at-risk"].assumptionIds = ["invented-assumption"];
assert(
  validateStateShape(assumedMetric).some((error) => error.includes("must not contain assumptionIds")),
  "assumption-backed trace inputs should be rejected",
);

const unavailableWithValue = structuredClone(baseline);
unavailableWithValue.traceInputs.metrics["qatar-volume-at-risk"].value = 10;
unavailableWithValue.traceInputs.metrics["qatar-volume-at-risk"].status = "unavailable";
unavailableWithValue.traceInputs.metrics["qatar-volume-at-risk"].source = "";
unavailableWithValue.traceInputs.metrics["qatar-volume-at-risk"].sourceDate = "";
unavailableWithValue.traceInputs.metrics["qatar-volume-at-risk"].missingReason = "Hardening fixture unavailable reason.";
assert(
  validateStateShape(unavailableWithValue).some((error) => error.includes("unavailable values must not contain value")),
  "unavailable trace inputs must not carry placeholder values",
);

const evaluationTemplate = structuredClone(exposure.traces[0].commercialEvaluation);
const completeInputs = {
  origin: { value: 10, unit: "USD/MMBtu", status: "confirmed" },
  destination: { low: 14, high: 16, unit: "USD/MMBtu", status: "confirmed" },
  freight: { value: 2, unit: "USD/MMBtu", status: "confirmed" },
  insurance: { low: 0.5, high: 1, unit: "USD/MMBtu", status: "confirmed" },
};
Object.assign(evaluationTemplate, {
  observedInputIds: ["origin", "destination", "freight", "insurance"],
  originInputId: "origin",
  destinationInputId: "destination",
  costInputIds: ["freight", "insurance"],
});
const completeEvaluation = computeCommercialEvaluation(evaluationTemplate, completeInputs, baseline.asOf);
assert.equal(completeEvaluation.dataStatus, "complete");
assert.equal(completeEvaluation.residualStatus, "positive-residual");
assert.deepEqual(
  completeEvaluation.derivedMetrics.find((metric) => metric.metricId === "residual-proxy").displayLow,
  1,
);
assert.deepEqual(
  completeEvaluation.derivedMetrics.find((metric) => metric.metricId === "residual-proxy").displayHigh,
  3.5,
);

const carriedInputs = structuredClone(completeInputs);
carriedInputs.freight.status = "carried";
const carriedEvaluation = computeCommercialEvaluation(evaluationTemplate, carriedInputs, baseline.asOf);
assert.equal(carriedEvaluation.residualStatus, "insufficient-verified-data");
assert(carriedEvaluation.missingInputIds.includes("freight"));
assert(
  carriedEvaluation.derivedMetrics.every((metric) => metric.status === "unavailable"),
  "carried inputs must not participate in calculations",
);

const mismatchedUnits = structuredClone(completeInputs);
mismatchedUnits.freight.unit = "USD/bbl";
const unitEvaluation = computeCommercialEvaluation(evaluationTemplate, mismatchedUnits, baseline.asOf);
assert.equal(unitEvaluation.residualStatus, "insufficient-verified-data");
assert(unitEvaluation.missingInputIds.includes("freight"));

const mismatchedBrent = structuredClone(baseline);
mismatchedBrent.runbookState.brent = "$1.00 placeholder";
assert(
  validateStateShape(mismatchedBrent).some((error) => error.includes("runbookState.brent")),
  "Brent narrative state that omits the confirmed quote should be rejected",
);

const overlongEvent = structuredClone(baseline);
overlongEvent.todaysEvents[0].delta = Array.from({ length: 46 }, () => "word").join(" ");
assert(
  validateStateShape(overlongEvent).some((error) => error.includes("delta must be at most 45 words")),
  "overlong daily event copy should be rejected",
);

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({
    chart: {
      result: [{
        meta: {
          regularMarketPrice: 58.7,
          chartPreviousClose: 62.55,
          regularMarketTime: 1785146971,
        },
      }],
    },
  }),
});
const yahoo = await fetchQuote({ symbol: "TTF=F", stooq: null });
assert.equal(yahoo.source, "Yahoo Finance TTF=F");
assert.equal(yahoo.price, 58.7);

let calls = 0;
globalThis.fetch = async () => {
  calls += 1;
  if (calls === 1) return { ok: false, status: 503 };
  return {
    ok: true,
    text: async () => "Symbol,Date,Time,Open,High,Low,Close,Volume\nBZ.F,2026-07-27,22:00:00,90,92,87,88,1000\n",
  };
};
const fallback = await fetchQuote({ symbol: "BZ=F", stooq: "bz.f" });
assert.equal(fallback.source, "Stooq bz.f");
assert.equal(fallback.price, 88);
globalThis.fetch = originalFetch;

globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({ refRates: [{ effectiveDate: "2026-07-24", percentRate: 3.64 }] }),
});
const sofr = await fetchSofr();
assert.equal(sofr.price, 3.64);
assert.equal(sofr.sourceDate, "2026-07-24");
globalThis.fetch = originalFetch;

const before = hashState();
const preview = spawnSync("bun", ["scripts/daily-fetch.mjs", "--dry-run"], {
  cwd: new URL("..", import.meta.url),
  encoding: "utf8",
});
assert.equal(preview.status, 0, preview.stderr || preview.stdout);
assert.equal(hashState(), before, "dry-run must not mutate daily-state.json");

const evidenceCheck = spawnSync("bun", ["scripts/daily-evidence.mjs"], {
  cwd: new URL("..", import.meta.url),
  encoding: "utf8",
});
assert.equal(evidenceCheck.status, 0, evidenceCheck.stderr || evidenceCheck.stdout);
assert(evidenceCheck.stdout.includes("PASS"), "daily:evidence should print a passing gate summary");

const energyRegistry = loadSourceRegistry();
const eiaProductionSource = energyRegistry.sources.find((source) => source.id === "src-eia-qatar-production");
const eiaMultiPeriod = parseEiaRecords({
  data: [
    { seriesId: "QATAR_LNG_PRODUCTION", entityIds: ["qatarenergy", "ras-laffan"], metric: "qatar-lng-production", value: 76, unit: "MTPA", period: "2024" },
    { seriesId: "QATAR_LNG_PRODUCTION", entityIds: ["qatarenergy", "ras-laffan"], metric: "qatar-lng-production", value: 77, unit: "MTPA", period: "2025" },
  ],
}, eiaProductionSource);
assert.equal(eiaMultiPeriod.length, 2, "EIA parser should preserve multi-period series observations");
assert.throws(
  () => parseEiaRecords({ data: [{ seriesId: "WRONG_SERIES", entityIds: ["qatarenergy", "ras-laffan"], metric: "qatar-lng-production", value: 77, unit: "MTPA", period: "2025" }] }, eiaProductionSource),
  /wrong EIA series|no selected series/,
  "EIA parser must reject a wrong configured series",
);

const pressureSource = energyRegistry.sources.find((source) => source.id === "src-imf-portwatch-hormuz-pressure");
const routeRecords = parseRouteRecords([
  { routeId: "hormuz", entityIds: ["hormuz"], metric: "route-pressure", value: 70, unit: "index", date: "2026-08-18" },
  { routeId: "suez", entityIds: ["hormuz"], metric: "route-pressure", value: 99, unit: "index", date: "2026-08-18" },
], pressureSource);
assert.equal(routeRecords.length, 1, "PortWatch parser must select the configured route exactly");
assert.equal(routeRecords[0].value, 70);
assert.throws(
  () => parseRouteRecords([{ routeId: "suez", entityIds: ["hormuz"], metric: "route-pressure", value: 99, unit: "index", date: "2026-08-18" }], pressureSource),
  /no selected route/,
  "PortWatch parser must reject unrelated routes",
);

const unlocodeSource = energyRegistry.sources.find((source) => source.id === "src-unlocode-ras-laffan");
const assetRecord = parseAssetRegistryRecords({ data: [{ namespace: "UN/LOCODE", code: "QARLF", stableEntityId: "ras-laffan-port", name: "Ras Laffan", observationDate: "2025-12-31" }] }, unlocodeSource)[0];
assert.deepEqual(assetRecord.entityIds, ["ras-laffan-port"], "UN/LOCODE parser should resolve the stable port entity");
assert.equal(resolveStableEntityId({ code: "QARLF", name: "Ras Laffan" }, { QARLF: "ras-laffan-port" }), "ras-laffan-port");
const gemSource = energyRegistry.sources.find((source) => source.id === "src-gem-ras-laffan-status");
const gemRecord = parseAssetRegistryRecords({ assets: [{ namespace: "GEM", code: "ras-laffan", stableEntityId: "ras-laffan", name: "Ras Laffan LNG Complex", status: "operating", observationDate: "2025-12-31" }] }, gemSource)[0];
assert.deepEqual(gemRecord.entityIds, ["ras-laffan"], "GEM parser should resolve the stable terminal entity");
assert(gemRecord.aliases.includes("ras-laffan"), "asset registry records should retain stable aliases");

const comtradeSource = energyRegistry.sources.find((source) => source.id === "src-comtrade-japan-lng-demand");
const tradeRecord = parseComtradeRecords([{
  reporterCode: "392",
  partnerCode: "0",
  flowCode: "M",
  cmdCode: "271111",
  period: "202607",
  primaryValue: 201000000,
  netWgt: 2800000000,
  netWgtUnit: "kg",
}], comtradeSource)[0];
assert.equal(tradeRecord.periodStart, "2026-07-01");
assert.equal(tradeRecord.periodEnd, "2026-07-31");
assert.equal(tradeRecord.unit, "USD");
assert.equal(tradeRecord.coverageStatus, "public-proxy");
assert(String(tradeRecord.coverageNote).includes("not cargo-level"), "Comtrade records must be explicitly labeled as non-cargo context");

const conflictPeriod = { start: "2025-01-01", end: "2025-12-31" };
const conflictCandidates = [
  { recordKey: stableRecordKey({ sourceId: "src-eia-qatar-production", entityIds: ["qatarenergy", "ras-laffan"], targetInputIds: ["qatar-production-baseline"], targetCommercialInputIds: [], observationDate: "2025-12-31", unit: "MTPA", observationKind: "flow", periodStart: conflictPeriod.start, periodEnd: conflictPeriod.end }), sourceId: "src-eia-qatar-production", entityIds: ["qatarenergy", "ras-laffan"], targetInputIds: ["qatar-production-baseline"], targetCommercialInputIds: [], observationKind: "flow", periodStart: conflictPeriod.start, periodEnd: conflictPeriod.end, observationDate: "2025-12-31", unit: "MTPA", status: "confirmed", value: 77 },
  { recordKey: stableRecordKey({ sourceId: "src-eia-qatar-exports", entityIds: ["qatarenergy", "ras-laffan"], targetInputIds: ["qatar-production-baseline"], targetCommercialInputIds: [], observationDate: "2025-12-31", unit: "MTPA", observationKind: "flow", periodStart: conflictPeriod.start, periodEnd: conflictPeriod.end }), sourceId: "src-eia-qatar-exports", entityIds: ["qatarenergy", "ras-laffan"], targetInputIds: ["qatar-production-baseline"], targetCommercialInputIds: [], observationKind: "flow", periodStart: conflictPeriod.start, periodEnd: conflictPeriod.end, observationDate: "2025-12-31", unit: "MTPA", status: "confirmed", value: 77.5 },
];
const conflictResolution = reconcileCandidates(conflictCandidates, energyRegistry.sources);
assert.equal(conflictResolution.reconciliations.length, 1, "conflicting observations should create a reconciliation record");
assert.equal(conflictResolution.reconciliations[0].status, "resolved");
assert.equal(conflictResolution.reconciliations[0].candidateRecordKeys.length, 2);
assert.equal(conflictResolution.candidates.filter((candidate) => candidate.selectedForAssessment).length, 1);

const energyFixtureOptions = {
  state: baseline,
  exposure,
  registry: energyRegistry,
  asOf: baseline.asOf,
  now: baseline.asOf,
  offline: true,
  dryRun: true,
};
const phase2Energy = await runEnergyRefresh({ ...energyFixtureOptions, fixtureName: "phase2-valid" });
assert.equal(phase2Energy.promotion.status, "validated", "Qatar/Hormuz Phase 2 fixture should validate");
assert(phase2Energy.observations.some((record) => record.observationKind === "capacity"), "Phase 2 should include terminal capacity observations");
assert(phase2Energy.observations.some((record) => record.observationKind === "asset-status"), "Phase 2 should include stable asset observations");
assert(phase2Energy.observations.some((record) => record.observationKind === "transit" && record.targetInputIds.includes("hormuz-route-pressure")), "Phase 2 should include route-pressure history");
assert(phase2Energy.observations.some((record) => record.observationKind === "trade-demand" && record.coverage.status === "public-proxy"), "Phase 2 should include public-proxy trade context");
const phase2Repeat = await runEnergyRefresh({ ...energyFixtureOptions, fixtureName: "phase2-valid" });
assert.equal(phase2Repeat.runId, phase2Energy.runId, "Phase 2 refresh should be idempotent");
assert.deepEqual(phase2Repeat.observations.map((record) => record.recordKey), phase2Energy.observations.map((record) => record.recordKey));
const pressureSubset = phase2Energy.observations.filter((record) => record.targetInputIds.includes("hormuz-route-pressure") && record.periodStart !== "2026-08-17");
const partialCoverage = buildSourceCoverage(pressureSource, [{ sourceId: pressureSource.id, status: "fetched" }], pressureSubset);
assert.equal(partialCoverage.status, "partial-coverage", "coverage should flag missing route periods");
assert(partialCoverage.missingPeriods.includes("2026-08-17/2026-08-17"));
const phase2Observation = phase2Energy.observations.find((record) => record.targetInputIds.includes("qatar-production-baseline"));
const phase2Snapshot = phase2Energy.snapshots.find((snapshot) => snapshot.sourceId === phase2Observation.sourceId);
assert(phase2Observation.lineage.snapshotRef.startsWith("snapshot:energy-snapshot:"));
assert.equal(phase2Observation.lineage.snapshotHash.length, 64);
assert.equal(phase2Observation.lineage.snapshotHash, phase2Snapshot.contentHash, "normalized records should retain their raw snapshot hash");
assert(phase2Snapshot.recordKeys.includes(phase2Observation.recordKey), "raw snapshots should list linked normalized record keys");
assert(phase2Observation.machineEvidenceIds.length > 0, "confirmed Phase 2 observations should link machine evidence");
const backfillOptions = { ...energyFixtureOptions, fixtureName: "phase2-valid", sourceId: "src-imf-portwatch-hormuz-pressure", from: "2026-08-16", to: "2026-08-18" };
const backfill = await runEnergyRefresh(backfillOptions);
const backfillRepeat = await runEnergyRefresh(backfillOptions);
assert.equal(backfill.promotion.status, "validated", "a scoped historical backfill should validate");
assert.equal(backfillRepeat.runId, backfill.runId, "historical backfills should be deterministic");
assert.deepEqual(backfillRepeat.observations.map((record) => record.recordKey), backfill.observations.map((record) => record.recordKey));
const phase2Promotion = prepareEnergyPromotion({
  state: baseline,
  exposure,
  audit: evidenceAudit,
  registry: energyRegistry,
  candidateEnvelopeOverride: {
    candidates: {
      schemaVersion: "energy-lng-candidates-v1",
      runId: phase2Energy.runId,
      asOf: baseline.asOf,
      baseFingerprint: phase2Energy.baseFingerprint,
      observations: phase2Energy.observations,
      machineEvidence: phase2Energy.machineEvidence,
      reconciliations: phase2Energy.reconciliations,
      coverage: phase2Energy.coverage,
      sourceFilter: phase2Energy.sourceFilter,
      requestedPeriod: phase2Energy.requestedPeriod,
    },
    report: phase2Energy,
  },
});
assert(phase2Promotion.promoted, `Phase 2 promotion should update the read model: ${phase2Promotion.errors.join("; ")}`);
assert.equal(validateStateShape(phase2Promotion.state).length, 0, "promoted Phase 2 state should remain valid");
assert(phase2Promotion.readModel.entities.find((entity) => entity.id === "ras-laffan-port")?.identitySources?.includes("UN/LOCODE"));
assert(phase2Promotion.readModel.traces.find((trace) => trace.id === "qatar-supply")?.routeEntityIds.includes("ras-laffan-port"));
const phase2Flow = phase2Promotion.readModel.traces.find((trace) => trace.id === "qatar-supply")?.physicalFlow;
assert(phase2Flow?.observations.some((record) => record.observationKind === "trade-demand" && record.coverageStatus === "public-proxy"));
assert(phase2Flow?.observations.some((record) => record.observationKind === "transit" && record.periodEnd === "2026-08-18"));
assert.equal(phase2Promotion.readModel.traces.find((trace) => trace.id === "qatar-supply")?.flowPressure?.components.length, 6);
assert((phase2Promotion.readModel.traces.find((trace) => trace.id === "qatar-supply")?.alternatives ?? []).some((alternative) => alternative.feasibility === "potential"));
assert((phase2Promotion.readModel.traces.find((trace) => trace.id === "qatar-supply")?.watchItems.length ?? 0) > 0, "watchlist should remain available after Phase 2 promotion");
const scopedBackfillPromotion = prepareEnergyPromotion({
  state: baseline,
  exposure,
  audit: evidenceAudit,
  registry: energyRegistry,
  candidateEnvelopeOverride: {
    candidates: {
      schemaVersion: "energy-lng-candidates-v1",
      runId: backfill.runId,
      asOf: baseline.asOf,
      baseFingerprint: backfill.baseFingerprint,
      observations: backfill.observations,
      machineEvidence: backfill.machineEvidence,
      reconciliations: backfill.reconciliations,
      coverage: backfill.coverage,
      sourceFilter: backfill.sourceFilter,
      requestedPeriod: backfill.requestedPeriod,
    },
    report: backfill,
  },
});
assert(scopedBackfillPromotion.promoted, `scoped backfill should promote without dropping unrelated state: ${scopedBackfillPromotion.errors.join("; ")}`);
const baseDomain = toEnergyLngDomain(exposure);
const preservedCoverageSource = Object.keys(baseDomain.coverage ?? {}).find((sourceId) => sourceId !== backfill.sourceFilter);
if (preservedCoverageSource) {
  assert.deepEqual(
    scopedBackfillPromotion.domain.coverage?.[preservedCoverageSource],
    baseDomain.coverage?.[preservedCoverageSource],
    "scoped backfill must preserve unrelated source coverage",
  );
}
const preservedMachineEvidenceId = (baseDomain.machineEvidence ?? []).find((item) => item.sourceId !== backfill.sourceFilter)?.id;
if (preservedMachineEvidenceId) {
  assert(
    scopedBackfillPromotion.domain.machineEvidence?.some((item) => item.id === preservedMachineEvidenceId),
    "scoped backfill must preserve unrelated machine evidence",
  );
}
const validEnergy = await runEnergyRefresh({ ...energyFixtureOptions, fixtureName: "valid" });
assert.equal(validEnergy.promotion.status, "validated", "valid Energy/LNG fixture should validate");
assert(validEnergy.observations.some((record) => record.status === "carried"), "valid refresh should retain explicit carried route/event data");
assert(validEnergy.observations.some((record) => record.status === "unavailable"), "valid refresh should retain explicit unavailable volume data");
assert(validEnergy.observations.find((record) => record.targetInputIds.includes("hormuz-transits")).confidence !== "high", "carried route data must lower confidence");

const previousEiaSeriesId = process.env.EIA_SERIES_ID;
process.env.EIA_SERIES_ID = "QATAR_LNG_TEST";
const scopedEnergy = await runEnergyRefresh({ ...energyFixtureOptions, fixtureName: "eia-portwatch-valid" });
if (previousEiaSeriesId === undefined) delete process.env.EIA_SERIES_ID;
else process.env.EIA_SERIES_ID = previousEiaSeriesId;
assert.equal(scopedEnergy.promotion.status, "validated", "scoped EIA/PortWatch fixture should validate");
const scopedVolume = scopedEnergy.observations.find((record) => record.targetInputIds.includes("qatar-volume-at-risk"));
const scopedRoute = scopedEnergy.observations.find((record) => record.targetInputIds.includes("hormuz-transits"));
assert.equal(scopedVolume.value, 77.5, "EIA parser should select the configured Qatar series");
assert.deepEqual(scopedVolume.entityIds, ["qatarenergy", "ras-laffan"], "EIA parser should preserve target entity scope");
assert.equal(scopedRoute.value, 4, "PortWatch parser should select the configured Hormuz route");
assert(!scopedEnergy.observations.some((record) => record.value === 19.2 || record.value === 99), "unrelated EIA/route rows must not become candidates");
assert(scopedEnergy.machineEvidence.some((item) => item.targetInputIds.includes("qatar-volume-at-risk")), "EIA observation should have machine snapshot evidence");
assert(scopedVolume.machineEvidenceIds.length === 1, "confirmed EIA observation should link its snapshot evidence");
if (previousEiaSeriesId === undefined) process.env.EIA_SERIES_ID = "QATAR_LNG_TEST";
else process.env.EIA_SERIES_ID = previousEiaSeriesId;
const scopedPromotion = prepareEnergyPromotion({
  state: baseline,
  exposure,
  audit: evidenceAudit,
  registry: energyRegistry,
  candidateEnvelopeOverride: {
    candidates: {
      schemaVersion: "energy-lng-candidates-v1",
      runId: scopedEnergy.runId,
      asOf: baseline.asOf,
      baseFingerprint: scopedEnergy.baseFingerprint,
      observations: scopedEnergy.observations,
      machineEvidence: scopedEnergy.machineEvidence,
    },
    report: scopedEnergy,
  },
});
if (previousEiaSeriesId === undefined) delete process.env.EIA_SERIES_ID;
else process.env.EIA_SERIES_ID = previousEiaSeriesId;
assert(scopedPromotion.promoted, `machine-evidenced EIA/PortWatch candidates should promote: ${scopedPromotion.errors.join("; ")}`);
assert.equal(validateEvidenceAudit(scopedPromotion.state, scopedPromotion.exposure, evidenceAudit).length, 0, "machine snapshot evidence should support an automated trace metric");
assert.equal(scopedPromotion.readModel.machineEvidence.length, 3, "promoted read model should expose machine snapshot evidence");

if (previousEiaSeriesId === undefined) process.env.EIA_SERIES_ID = "QATAR_LNG_TEST";
else process.env.EIA_SERIES_ID = previousEiaSeriesId;
const scopedRepeat = await runEnergyRefresh({ ...energyFixtureOptions, fixtureName: "eia-portwatch-valid" });
if (previousEiaSeriesId === undefined) delete process.env.EIA_SERIES_ID;
else process.env.EIA_SERIES_ID = previousEiaSeriesId;
assert.equal(scopedRepeat.runId, scopedEnergy.runId, "scoped repeated refreshes should be idempotent");
assert.deepEqual(scopedRepeat.machineEvidence, scopedEnergy.machineEvidence, "scoped repeated refreshes should preserve snapshot evidence");

const mutatedTarget = structuredClone(scopedEnergy.observations);
const mutatedVolume = mutatedTarget.find((record) => record.targetInputIds.includes("qatar-volume-at-risk"));
mutatedVolume.targetInputIds = ["hormuz-transits"];
const mutatedTargetPromotion = prepareEnergyPromotion({
  state: baseline,
  exposure,
  audit: evidenceAudit,
  registry: energyRegistry,
  candidateEnvelopeOverride: {
    candidates: {
      schemaVersion: "energy-lng-candidates-v1",
      runId: scopedEnergy.runId,
      asOf: baseline.asOf,
      baseFingerprint: scopedEnergy.baseFingerprint,
      observations: mutatedTarget,
      machineEvidence: scopedEnergy.machineEvidence,
    },
    report: { ...scopedEnergy, observations: mutatedTarget },
  },
});
assert(!mutatedTargetPromotion.promoted, "candidate target-scope mutation must be rejected");
assert(mutatedTargetPromotion.errors.some((error) => error.includes("recordKey") || error.includes("targetInputIds")), "scope mutation should identify the integrity failure");

const staleState = structuredClone(baseline);
staleState.traceInputs.metrics.ttf.value = 70;
const stalePromotion = prepareEnergyPromotion({
  state: staleState,
  exposure,
  audit: evidenceAudit,
  registry: energyRegistry,
  candidateEnvelopeOverride: {
    candidates: {
      schemaVersion: "energy-lng-candidates-v1",
      runId: scopedEnergy.runId,
      asOf: baseline.asOf,
      baseFingerprint: scopedEnergy.baseFingerprint,
      observations: scopedEnergy.observations,
      machineEvidence: scopedEnergy.machineEvidence,
    },
    report: scopedEnergy,
  },
});
assert(!stalePromotion.promoted, "stale candidate state must be rejected");
assert(stalePromotion.errors.some((error) => error.includes("stale")), "stale candidate rejection should require a rerun");

const missingPairPromotion = prepareEnergyPromotion({
  state: baseline,
  exposure,
  audit: evidenceAudit,
  registry: energyRegistry,
  candidateEnvelopeOverride: { artifactError: "candidate/report pair is incomplete" },
});
assert(!missingPairPromotion.promoted, "partial candidate/report artifacts must fail closed");
assert(missingPairPromotion.errors.some((error) => error.includes("incomplete")), "partial artifact failure should be visible");

const blockedPromotion = prepareEnergyPromotion({
  state: baseline,
  exposure,
  audit: evidenceAudit,
  registry: energyRegistry,
  candidateEnvelopeOverride: {
    candidates: {
      schemaVersion: "energy-lng-candidates-v1",
      runId: validEnergy.runId,
      asOf: baseline.asOf,
      observations: validEnergy.observations,
    },
    report: {
      ...validEnergy,
      validation: { errors: ["fixture validation failure"], warnings: [] },
      promotion: { ...validEnergy.promotion, status: "blocked" },
    },
  },
});
assert.equal(blockedPromotion.promoted, false, "failed Energy/LNG validation must not promote runtime data");
assert(blockedPromotion.errors.length > 0, "failed Energy/LNG validation must be visible to the operator");

const protectedPublicationFiles = [
  PATHS.state,
  PATHS.exposure,
  PATHS.energyRuntime,
  PATHS.energyReadModel,
  `${PATHS.publicData}/daily-state.json`,
  `${PATHS.publicData}/exposure-traces.json`,
  `${PATHS.publicData}/energy-lng-runtime.json`,
  `${PATHS.publicData}/energy-lng-read-model.json`,
];
const originalRefreshReport = readFileSync(PATHS.energyRefreshReport);
const protectedHashes = new Map(protectedPublicationFiles.map((file) => [file, createHash("sha256").update(readFileSync(file)).digest("hex")]));
try {
  const invalidReport = structuredClone(readJson(PATHS.energyRefreshReport));
  invalidReport.validation.errors = ["hardening atomicity fixture failure"];
  invalidReport.promotion.status = "blocked";
  writeFileSync(PATHS.energyRefreshReport, `${JSON.stringify(invalidReport, null, 2)}\n`);
  const failedApply = spawnSync("bun", ["scripts/daily-apply.mjs"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  assert.notEqual(failedApply.status, 0, "invalid refresh report must block daily:apply");
  for (const [file, hash] of protectedHashes) {
    assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), hash, `${file} changed after a failed promotion`);
  }
} finally {
  writeFileSync(PATHS.energyRefreshReport, originalRefreshReport);
}

const repeatedEnergy = await runEnergyRefresh({ ...energyFixtureOptions, fixtureName: "valid" });
assert.equal(repeatedEnergy.runId, validEnergy.runId, "repeated Energy/LNG fetches should be idempotent");
assert.deepEqual(repeatedEnergy.observations, validEnergy.observations, "repeated Energy/LNG fetches should produce identical candidates");

for (const fixtureName of ["stale", "malformed", "duplicate", "unit-mismatched"]) {
  const invalidEnergy = await runEnergyRefresh({ ...energyFixtureOptions, fixtureName });
  assert.equal(invalidEnergy.promotion.status, "blocked", `${fixtureName} fixture should be blocked`);
  assert(invalidEnergy.validation.errors.length > 0, `${fixtureName} fixture should report validation errors`);
}

const unavailableEnergy = await runEnergyRefresh({ ...energyFixtureOptions, fixtureName: "unavailable" });
assert.equal(unavailableEnergy.promotion.status, "validated", "unavailable fallback fixture should remain publishable as explicit unavailable data");
const unavailableVolume = unavailableEnergy.observations.find((record) => record.targetInputIds.includes("qatar-volume-at-risk"));
assert.equal(unavailableVolume.status, "unavailable");
assert.equal(unavailableVolume.value, undefined, "unavailable records must not invent a value");
const unavailableTtfState = structuredClone(baseline);
const unavailableTtfExposure = structuredClone(exposure);
const markTtfUnavailable = (input) => {
  delete input.value;
  delete input.low;
  delete input.high;
  delete input.source;
  delete input.sourceDate;
  delete input.observedAt;
  delete input.carryReason;
  input.status = "unavailable";
  input.missingReason = "TTF machine observation unavailable for hardening test.";
};
markTtfUnavailable(unavailableTtfState.traceInputs.metrics.ttf);
markTtfUnavailable(unavailableTtfState.commercialInputs["lng-ttf"]);
for (const trace of unavailableTtfExposure.traces) {
  for (const hop of trace.hops) {
    for (const metric of hop.metrics) {
      if (metric.inputId === "ttf") markTtfUnavailable(metric);
    }
  }
}
const unavailableTtfInput = unavailableTtfExposure.commercialInputs.find((input) => input.inputId === "lng-ttf");
if (unavailableTtfInput) markTtfUnavailable(unavailableTtfInput);
const unavailableTtfEnergy = await runEnergyRefresh({
  state: unavailableTtfState,
  exposure: unavailableTtfExposure,
  registry: energyRegistry,
  asOf: unavailableTtfState.asOf,
  now: unavailableTtfState.asOf,
  offline: true,
  dryRun: true,
  fixtureName: "unavailable",
});
const unavailablePromotion = prepareEnergyPromotion({
  state: unavailableTtfState,
  exposure: unavailableTtfExposure,
  audit: evidenceAudit,
  registry: energyRegistry,
  candidateEnvelopeOverride: {
    candidates: {
      schemaVersion: "energy-lng-candidates-v1",
      runId: unavailableTtfEnergy.runId,
      asOf: unavailableTtfState.asOf,
      baseFingerprint: unavailableTtfEnergy.baseFingerprint,
      observations: unavailableTtfEnergy.observations,
      machineEvidence: unavailableTtfEnergy.machineEvidence,
    },
    report: unavailableTtfEnergy,
  },
});
assert(unavailablePromotion.promoted, "unavailable TTF should remain explicitly publishable");
assert.equal(unavailablePromotion.state.crossAsset.ttf.status, "unavailable");
assert.equal(validateStateShape(unavailablePromotion.state).length, 0, "unavailable TTF cross-asset state should remain valid");
assert.equal(validateEvidenceAudit(unavailablePromotion.state, unavailablePromotion.exposure, evidenceAudit).length, 0, "unavailable TTF should not invent evidence or a value");

const carriedHigh = structuredClone(unavailableEnergy.observations);
const carriedTtf = carriedHigh.find((record) => record.targetInputIds.includes("ttf"));
carriedTtf.confidence = "high";
const carriedHighPromotion = prepareEnergyPromotion({
  state: baseline,
  exposure,
  audit: evidenceAudit,
  registry: energyRegistry,
  candidateEnvelopeOverride: {
    candidates: {
      schemaVersion: "energy-lng-candidates-v1",
      runId: unavailableEnergy.runId,
      asOf: baseline.asOf,
      baseFingerprint: unavailableEnergy.baseFingerprint,
      observations: carriedHigh,
      machineEvidence: unavailableEnergy.machineEvidence,
    },
    report: { ...unavailableEnergy, observations: carriedHigh },
  },
});
assert(!carriedHighPromotion.promoted, "carried observations with high confidence must be rejected");

const marketState = structuredClone(baseline);
const marketExposure = structuredClone(exposure);
const marketAudit = structuredClone(evidenceAudit);
marketState.traceInputs.metrics.ttf.value = 77.77;
marketState.commercialInputs["lng-ttf"].value = 77.77;
for (const trace of marketExposure.traces) {
  for (const hop of trace.hops) {
    for (const metric of hop.metrics) {
      if (metric.inputId === "ttf") metric.value = 77.77;
    }
  }
}
const marketInput = marketExposure.commercialInputs.find((input) => input.inputId === "lng-ttf");
if (marketInput) marketInput.value = 77.77;
for (const entry of marketAudit.entries) {
  for (const observation of entry.observations ?? []) {
    if (observation.inputId === "ttf" || observation.inputId === "lng-ttf") observation.value = 77.77;
  }
}
const updatedTtf = await runEnergyRefresh({
  state: marketState,
  exposure: marketExposure,
  registry: energyRegistry,
  asOf: marketState.asOf,
  now: marketState.asOf,
  offline: true,
  dryRun: true,
  fixtureName: "ttf-updated",
});
const updatedTtfPromotion = prepareEnergyPromotion({
  state: marketState,
  exposure: marketExposure,
  audit: marketAudit,
  registry: energyRegistry,
  candidateEnvelopeOverride: {
    candidates: {
      schemaVersion: "energy-lng-candidates-v1",
      runId: updatedTtf.runId,
      asOf: marketState.asOf,
      baseFingerprint: updatedTtf.baseFingerprint,
      observations: updatedTtf.observations,
      machineEvidence: updatedTtf.machineEvidence,
    },
    report: updatedTtf,
  },
});
assert(updatedTtfPromotion.promoted, `TTF promotion should synchronize all views: ${updatedTtfPromotion.errors.join("; ")}`);
assert.equal(updatedTtfPromotion.state.traceInputs.metrics.ttf.value, 77.77);
assert.equal(updatedTtfPromotion.state.commercialInputs["lng-ttf"].value, 77.77);
assert.equal(updatedTtfPromotion.state.crossAsset.ttf.current, 77.77, "TTF cross-asset current must follow the promoted observation");
assert.equal(updatedTtfPromotion.state.crossAsset.ttf.change1d, "+5.6%", "TTF cross-asset change must follow the promoted observation");
assert(updatedTtfPromotion.state.runbookState.ttf.includes("77.77"), "TTF runbook quote must follow the promoted observation");

const domain = toEnergyLngDomain(exposure);
assert(domain.observations.some((record) => record.id === "observation:qatar-supply:qatar-output-status"), "Qatar observations must be trace scoped");
assert(domain.observations.some((record) => record.id === "observation:hormuz-delivery:qatar-output-status"), "Hormuz LNG observations must be trace scoped");
for (const assessment of domain.assessments.filter((item) => item.commodity === "lng")) {
  assert(assessment.flowPressure.components.length === 6, `${assessment.traceId} must expose all six Flow Pressure components`);
  assert(assessment.alternatives.every((alternative) => alternative.feasibility !== "commercially-executable"), `${assessment.traceId} must not claim unverified alternatives are executable`);
}

console.log("daily:test passed");
