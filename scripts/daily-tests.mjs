import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fetchQuote, fetchSofr, LIQUID_QUOTES } from "./daily-fetch.mjs";
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

console.log("daily:test passed");
