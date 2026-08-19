import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fetchQuote, fetchSofr, LIQUID_QUOTES } from "./daily-fetch.mjs";
import {
  loadSourceRegistry,
  runEnergyRefresh,
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
const energyFixtureOptions = {
  state: baseline,
  exposure,
  registry: energyRegistry,
  asOf: baseline.asOf,
  now: baseline.asOf,
  offline: true,
  dryRun: true,
};
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
