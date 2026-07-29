import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
export const STATE_PATH = path.join(ROOT, "src/data/daily-state.json");
export const EVIDENCE_AUDIT_PATH = path.join(ROOT, "src/data/evidence-audit.json");

export const PATHS = {
  state: STATE_PATH,
  publicData: path.join(ROOT, "public/data"),
  crossAsset: path.join(ROOT, "src/data/banker-cross-asset.json"),
  conflict: path.join(ROOT, "src/data/banker-conflict.json"),
  charts: path.join(ROOT, "src/data/charts-volatility.json"),
  commodities: path.join(ROOT, "src/data/commodities-impact.json"),
  exposure: path.join(ROOT, "src/data/exposure-traces.json"),
  intelEvents: path.join(ROOT, "src/data/iran-intel-events.json"),
  evidenceAudit: EVIDENCE_AUDIT_PATH,
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

export const TRACE_STAGES = ["signal", "supply", "transport", "demand", "counterparty"];
export const TRACE_RELATIONSHIPS = ["public-contract", "operational-dependency", "market-sensitivity"];
export const EVIDENCE_KINDS = ["event", "market-observation", "contract", "official-statistics"];
export const EVIDENCE_CADENCES = ["daily", "event-driven", "contract-driven"];
export const EVIDENCE_CONTENT_STATUSES = ["verified", "unsupported", "stale", "unreachable", "manual-review"];
export const EVIDENCE_REVIEW_STATUSES = ["approved", "pending", "rejected"];
export const EVIDENCE_PAGE_TYPES = ["article", "release", "pdf", "market-data", "official-data", "landing-page"];
export const MARKET_OBSERVATION_TRACE_INPUTS = ["jkm", "ttf", "jkm-cfd-reference", "oman-marker"];

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

export function ageInDays(asOf, sourceDate) {
  const later = Date.parse(formatDateOnly(asOf));
  const earlier = Date.parse(formatDateOnly(sourceDate));
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return Number.NaN;
  return Math.floor((later - earlier) / 86_400_000);
}

export function signalForZscore(zscore) {
  const abs = Math.abs(Number(zscore));
  if (abs > 2) return "red";
  if (abs >= 1) return "amber";
  return "green";
}

function wordCount(value) {
  return String(value ?? "").trim().split(/\s+/).filter(Boolean).length;
}

export function validateStateShape(state) {
  const errors = [];
  const changePattern = /^([+-]\d+(\.\d+)?%|[+-]\d+(\.\d+)?bp|0\.0%)$/;
  const statuses = new Set(["confirmed", "estimated", "carried", "inferred"]);
  const traceStatuses = new Set(["confirmed", "carried", "unavailable"]);
  const traceCadences = new Set(["daily", "event-driven", "contract-driven"]);

  assert(state.schemaVersion === 3, "schemaVersion must be 3", errors);
  assert(Boolean(state.asOf), "asOf is required", errors);
  assert(Boolean(state.day), "day is required", errors);
  assert(Boolean(state.crisis?.label), "crisis.label is required", errors);
  assert(Number.isInteger(state.crisis?.level), "crisis.level must be an integer", errors);
  assert(Number.isInteger(state.deltaVsYesterday), "deltaVsYesterday must be an integer", errors);
  assert(Boolean(state.marketContext), "marketContext is required", errors);
  assert(Boolean(state.topAlert), "topAlert is required", errors);
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
    assert(
      wordCount(event.summary) <= 8 && String(event.summary).length <= 45,
      `todaysEvents.${event.id ?? "?"}.summary must be at most 8 words and 45 characters`,
      errors,
    );
    assert(
      wordCount(event.delta) <= 45,
      `todaysEvents.${event.id ?? "?"}.delta must be at most 45 words`,
      errors,
    );
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

  const fallbackQuotes = state.fallbackQuotes ?? [];
  for (const quote of fallbackQuotes) {
    assert(Boolean(quote.symbol), "fallbackQuotes entries require symbol", errors);
    assert(typeof quote.price === "number", `fallbackQuotes.${quote.symbol}.price must be a number`, errors);
    assert(typeof quote.change === "number", `fallbackQuotes.${quote.symbol}.change must be a number`, errors);
    assert(typeof quote.changePct === "number", `fallbackQuotes.${quote.symbol}.changePct must be a number`, errors);
    assert(Boolean(quote.source), `fallbackQuotes.${quote.symbol}.source is required`, errors);
    assert(Boolean(quote.sourceDate), `fallbackQuotes.${quote.symbol}.sourceDate is required`, errors);
    assert(statuses.has(quote.status), `fallbackQuotes.${quote.symbol}.status is invalid`, errors);
  }
  assert(fallbackQuotes.length === 2, "fallbackQuotes must contain Brent and WTI", errors);
  assert(
    fallbackQuotes.map((quote) => quote.symbol).sort().join(",") === "BZ=F,CL=F",
    "fallbackQuotes must contain exactly BZ=F and CL=F",
    errors,
  );
  const brentQuote = fallbackQuotes.find((quote) => quote.symbol === "BZ=F");
  if (brentQuote && state.crossAsset?.brent) {
    assert(
      Number(brentQuote.price) === Number(state.crossAsset.brent.current),
      "fallbackQuotes.BZ=F.price must match crossAsset.brent.current",
      errors,
    );
    assert(
      Math.abs(Number.parseFloat(state.crossAsset.brent.change1d) - Number(brentQuote.changePct)) < 0.11,
      "fallbackQuotes.BZ=F.changePct must match crossAsset.brent.change1d",
      errors,
    );
    assert(
      String(state.runbookState?.brent ?? "").includes(brentQuote.price.toFixed(2)),
      "runbookState.brent must include the confirmed BZ=F price",
      errors,
    );
  }

  const traceInputs = state.traceInputs;
  assert(Boolean(traceInputs?.headline), "traceInputs.headline is required", errors);
  const traceMetrics = traceInputs?.metrics ?? {};
  assert(Object.keys(traceMetrics).length > 0, "traceInputs.metrics must not be empty", errors);
  for (const [id, metric] of Object.entries(traceMetrics)) {
    const hasValue = metric.value !== undefined && metric.value !== null;
    const hasRange = typeof metric.low === "number" && typeof metric.high === "number";
    if (metric.status === "unavailable") {
      assert(!hasValue && !hasRange, `traceInputs.metrics.${id} unavailable values must not contain value or range`, errors);
      assert(Boolean(metric.missingReason), `traceInputs.metrics.${id} unavailable values require missingReason`, errors);
      assert(!metric.source, `traceInputs.metrics.${id} unavailable values must not name a source`, errors);
      assert(!metric.sourceDate, `traceInputs.metrics.${id} unavailable values must not contain sourceDate`, errors);
    } else {
      assert(hasValue || hasRange, `traceInputs.metrics.${id} requires value or low/high`, errors);
    }
    if (hasRange) {
      assert(metric.low <= metric.high, `traceInputs.metrics.${id}.low must not exceed high`, errors);
    }
    assert(traceStatuses.has(metric.status), `traceInputs.metrics.${id}.status is invalid`, errors);
    assert(traceCadences.has(metric.cadence), `traceInputs.metrics.${id}.cadence is invalid`, errors);
    assert(Number(metric.maxAgeDays) > 0, `traceInputs.metrics.${id}.maxAgeDays must be positive`, errors);
    if (metric.status === "confirmed") {
      assert(Boolean(metric.source), `traceInputs.metrics.${id} confirmed values require source`, errors);
      assert(Boolean(metric.sourceDate), `traceInputs.metrics.${id} confirmed values require sourceDate`, errors);
    }
    assert(!("assumptionIds" in metric), `traceInputs.metrics.${id} must not contain assumptionIds`, errors);
    if (metric.status === "carried") {
      assert(Boolean(metric.carryReason), `traceInputs.metrics.${id} carried values require carryReason`, errors);
    }
    if (metric.status !== "unavailable") {
      const age = ageInDays(state.asOf, metric.sourceDate);
      assert(Number.isFinite(age), `traceInputs.metrics.${id}.sourceDate is invalid`, errors);
      assert(age >= 0, `traceInputs.metrics.${id}.sourceDate cannot be after asOf`, errors);
      if (Number.isFinite(age) && age > Number(metric.maxAgeDays) && metric.status !== "carried") {
        errors.push(
          `traceInputs.metrics.${id} is ${age} days old, above maxAgeDays ${metric.maxAgeDays}; carry it with its original date or refresh it`,
        );
      }
    }
  }

  const commercialInputs = state.commercialInputs ?? {};
  assert(Object.keys(commercialInputs).length > 0, "commercialInputs must not be empty", errors);
  for (const [id, input] of Object.entries(commercialInputs)) {
    const hasValue = input.value !== undefined && input.value !== null;
    const hasRange = typeof input.low === "number" && typeof input.high === "number";
    assert(["lng", "crude-oil"].includes(input.commodity), `commercialInputs.${id}.commodity is invalid`, errors);
    assert(traceStatuses.has(input.status), `commercialInputs.${id}.status is invalid`, errors);
    assert(traceCadences.has(input.cadence), `commercialInputs.${id}.cadence is invalid`, errors);
    assert(Array.isArray(input.evidenceIds), `commercialInputs.${id}.evidenceIds must be an array`, errors);
    assert(!("assumptionIds" in input), `commercialInputs.${id} must not contain assumptionIds`, errors);
    if (input.status === "unavailable") {
      assert(!hasValue && !hasRange, `commercialInputs.${id} unavailable inputs must not contain value or range`, errors);
      assert(Boolean(input.missingReason), `commercialInputs.${id} unavailable inputs require missingReason`, errors);
      assert(!input.source && !input.sourceDate, `commercialInputs.${id} unavailable inputs must not contain source metadata`, errors);
      continue;
    }
    assert(hasValue || hasRange, `commercialInputs.${id} requires value or a source-published range`, errors);
    if (hasRange) assert(input.low <= input.high, `commercialInputs.${id}.low must not exceed high`, errors);
    assert(Boolean(input.source), `commercialInputs.${id} requires source`, errors);
    assert(Boolean(input.sourceDate), `commercialInputs.${id} requires sourceDate`, errors);
    if (input.status === "carried") assert(Boolean(input.carryReason), `commercialInputs.${id} carried inputs require carryReason`, errors);
    const age = ageInDays(state.asOf, input.sourceDate);
    assert(Number.isFinite(age), `commercialInputs.${id}.sourceDate is invalid`, errors);
    assert(age >= 0, `commercialInputs.${id}.sourceDate cannot be after asOf`, errors);
    if (Number.isFinite(age) && age > Number(input.maxAgeDays) && input.status !== "carried") {
      errors.push(`commercialInputs.${id} is ${age} days old, above maxAgeDays ${input.maxAgeDays}`);
    }
  }

  const evidenceUpdates = traceInputs?.evidenceUpdates ?? {};
  assert(Object.keys(evidenceUpdates).length > 0, "traceInputs.evidenceUpdates must not be empty", errors);
  for (const [id, update] of Object.entries(evidenceUpdates)) {
    assert(Boolean(update.lastChecked), `traceInputs.evidenceUpdates.${id}.lastChecked is required`, errors);
    assert(["confirmed", "carried"].includes(update.status), `traceInputs.evidenceUpdates.${id}.status is invalid`, errors);
    if (update.status === "carried") {
      assert(Boolean(update.note), `traceInputs.evidenceUpdates.${id} carried evidence requires a note`, errors);
    }
  }

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

function numericRange(input) {
  if (typeof input?.low === "number" && typeof input?.high === "number") {
    return { low: input.low, high: input.high };
  }
  if (typeof input?.value === "number") return { low: input.value, high: input.value };
  return null;
}

function roundCommercial(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function derivedMetric(metricId, label, formulaId, inputIds, unit, calculatedAt, range, missingInputIds) {
  if (!range) {
    return {
      metricId,
      label,
      formulaId,
      inputIds,
      unit,
      calculatedAt,
      status: "unavailable",
      missingInputIds,
    };
  }
  if (range.low === range.high) {
    return {
      metricId,
      label,
      formulaId,
      inputIds,
      unit,
      calculatedAt,
      status: "derived",
      unroundedValue: range.low,
      displayValue: roundCommercial(range.low),
    };
  }
  return {
    metricId,
    label,
    formulaId,
    inputIds,
    unit,
    calculatedAt,
    status: "derived",
    unroundedLow: range.low,
    unroundedHigh: range.high,
    displayLow: roundCommercial(range.low),
    displayHigh: roundCommercial(range.high),
  };
}

export function computeCommercialEvaluation(evaluation, commercialInputs, calculatedAt) {
  const requiredInputIds = [
    evaluation.originInputId,
    evaluation.destinationInputId,
    ...(evaluation.costInputIds ?? []),
  ];
  const missingInputIds = requiredInputIds.filter((id) => commercialInputs[id]?.status !== "confirmed");
  const confirmedObserved = (evaluation.observedInputIds ?? []).filter(
    (id) => commercialInputs[id]?.status === "confirmed",
  ).length;
  const unit = commercialInputs[evaluation.originInputId]?.unit
    || commercialInputs[evaluation.destinationInputId]?.unit
    || "";

  if (!missingInputIds.length) {
    const incompatible = requiredInputIds.filter((id) => commercialInputs[id]?.unit !== unit);
    missingInputIds.push(...incompatible);
  }

  let grossRange = null;
  let costRange = null;
  let residualRange = null;
  if (!missingInputIds.length) {
    const origin = numericRange(commercialInputs[evaluation.originInputId]);
    const destination = numericRange(commercialInputs[evaluation.destinationInputId]);
    const costs = evaluation.costInputIds.map((id) => numericRange(commercialInputs[id]));
    if (!origin || !destination || costs.some((item) => !item)) {
      for (const id of requiredInputIds) {
        if (!numericRange(commercialInputs[id]) && !missingInputIds.includes(id)) missingInputIds.push(id);
      }
    } else {
      grossRange = {
        low: destination.low - origin.high,
        high: destination.high - origin.low,
      };
      costRange = costs.reduce(
        (sum, item) => ({ low: sum.low + item.low, high: sum.high + item.high }),
        { low: 0, high: 0 },
      );
      residualRange = {
        low: grossRange.low - costRange.high,
        high: grossRange.high - costRange.low,
      };
    }
  }

  const inputIds = [...new Set(requiredInputIds)];
  const derivedMetrics = [
    derivedMetric(
      "gross-spread",
      "Gross verified spread",
      "destination-minus-origin",
      [evaluation.destinationInputId, evaluation.originInputId],
      unit,
      calculatedAt,
      grossRange,
      missingInputIds,
    ),
    derivedMetric(
      "transformation-cost",
      "Verified transformation cost",
      "sum-transformation-costs",
      evaluation.costInputIds,
      unit,
      calculatedAt,
      costRange,
      missingInputIds,
    ),
    derivedMetric(
      "residual-proxy",
      "Residual public proxy",
      "gross-minus-costs",
      inputIds,
      unit,
      calculatedAt,
      residualRange,
      missingInputIds,
    ),
  ];

  let residualStatus = "insufficient-verified-data";
  if (residualRange) {
    if (residualRange.low > 0) residualStatus = "positive-residual";
    else if (residualRange.high < 0) residualStatus = "negative-residual";
    else residualStatus = "crosses-zero";
  }

  return {
    ...evaluation,
    requiredInputIds,
    derivedMetrics,
    missingInputIds: [...new Set(missingInputIds)],
    dataStatus: missingInputIds.length
      ? confirmedObserved > 0 ? "partial" : "unavailable"
      : "complete",
    residualStatus,
  };
}

function sameAuditValue(actual, expected) {
  if (typeof expected === "number") return Number(actual) === expected;
  return actual === expected;
}

export function validateEvidenceAudit(state, exposure, audit) {
  const errors = [];
  const evidence = exposure?.evidence ?? [];
  const entries = audit?.entries ?? [];
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const auditById = new Map(entries.map((item) => [item.evidenceId, item]));
  const knownHopIds = new Set();
  const knownMetricIds = new Set();
  const knownCommercialInputIds = new Set((exposure?.commercialInputs ?? []).map((item) => item.inputId));
  const knownDerivedMetricIds = new Set();
  const knownRelationshipIds = new Set();
  for (const trace of exposure?.traces ?? []) {
    for (const hop of trace.hops ?? []) {
      knownHopIds.add(`${trace.id}:${hop.id}`);
      for (const metric of hop.metrics ?? []) knownMetricIds.add(metric.inputId);
    }
    for (const counterparty of trace.counterparties ?? []) {
      knownRelationshipIds.add(`${trace.id}:${counterparty.entityId}`);
    }
    for (const metric of trace.commercialEvaluation?.derivedMetrics ?? []) {
      knownDerivedMetricIds.add(`${trace.id}:${metric.metricId}`);
    }
  }

  assert(audit?.schemaVersion === 2, "evidence audit schemaVersion must be 2", errors);
  assert(audit?.asOf === state.asOf, "evidence audit asOf must match daily-state.asOf", errors);
  assert(Boolean(audit?.reviewedAt), "evidence audit reviewedAt is required", errors);
  const reviewedAt = Date.parse(audit?.reviewedAt);
  assert(Number.isFinite(reviewedAt), "evidence audit reviewedAt is invalid", errors);
  assert(
    Number.isFinite(reviewedAt) && reviewedAt <= Date.now() + 300_000,
    "evidence audit reviewedAt cannot be in the future",
    errors,
  );
  assert(Boolean(audit?.reviewer), "evidence audit reviewer is required", errors);
  assert(Array.isArray(audit?.entries), "evidence audit entries must be an array", errors);
  assert(entries.length === evidence.length, "evidence audit must contain exactly one entry per evidence reference", errors);

  for (const item of evidence) {
    assert(EVIDENCE_KINDS.includes(item.kind), `evidence ${item.id}.kind is invalid`, errors);
    assert(EVIDENCE_CADENCES.includes(item.cadence), `evidence ${item.id}.cadence is invalid`, errors);
    assert(Number(item.maxAgeDays) > 0, `evidence ${item.id}.maxAgeDays must be positive`, errors);
    assert(Boolean(item.lastChecked), `evidence ${item.id}.lastChecked is required`, errors);
    assert(Boolean(item.publishedAt), `evidence ${item.id}.publishedAt is required`, errors);
    assert(/^https:\/\//.test(item.url), `evidence ${item.id}.url must use https`, errors);

    const entry = auditById.get(item.id);
    if (!entry) {
      errors.push(`evidence audit is missing ${item.id}`);
      continue;
    }
    assert(entry.url === item.url, `evidence audit ${item.id}.url does not match exposure evidence`, errors);
    assert(/^https:\/\//.test(entry.canonicalUrl ?? ""), `evidence audit ${item.id}.canonicalUrl must use https`, errors);
    assert(
      Number(entry.httpStatus) >= 200 && Number(entry.httpStatus) < 400,
      `evidence audit ${item.id} must have a successful HTTP status`,
      errors,
    );
    assert(EVIDENCE_PAGE_TYPES.includes(entry.pageType), `evidence audit ${item.id}.pageType is invalid`, errors);
    assert(entry.pageType !== "landing-page", `evidence audit ${item.id} cannot use a landing page`, errors);
    assert(
      EVIDENCE_CONTENT_STATUSES.includes(entry.contentStatus),
      `evidence audit ${item.id}.contentStatus is invalid`,
      errors,
    );
    assert(
      EVIDENCE_REVIEW_STATUSES.includes(entry.reviewStatus),
      `evidence audit ${item.id}.reviewStatus is invalid`,
      errors,
    );
    assert(entry.reviewStatus === "approved", `evidence audit ${item.id} is not analyst-approved`, errors);
    assert(
      entry.contentStatus === "verified" || (entry.contentStatus === "stale" && item.status === "carried"),
      `evidence audit ${item.id} content is ${entry.contentStatus}`,
      errors,
    );
    assert(Boolean(entry.title), `evidence audit ${item.id}.title is required`, errors);
    assert(entry.publisher === item.publisher, `evidence audit ${item.id}.publisher does not match exposure evidence`, errors);
    assert(entry.publishedAt === item.publishedAt, `evidence audit ${item.id}.publishedAt does not match exposure evidence`, errors);
    assert(Boolean(entry.checkedAt), `evidence audit ${item.id}.checkedAt is required`, errors);
    assert(formatDateOnly(entry.checkedAt) === item.lastChecked, `evidence audit ${item.id}.checkedAt does not match lastChecked`, errors);
    const checkedAge = ageInDays(audit.reviewedAt, entry.checkedAt);
    assert(Number.isFinite(checkedAge), `evidence audit ${item.id}.checkedAt is invalid`, errors);
    assert(checkedAge >= 0, `evidence audit ${item.id}.checkedAt cannot be after reviewedAt`, errors);
    if (Number.isFinite(checkedAge) && checkedAge > Number(item.maxAgeDays) && item.status !== "carried") {
      errors.push(
        `evidence audit ${item.id} is ${checkedAge} days old, above maxAgeDays ${item.maxAgeDays}; refresh it or carry it with a reason`,
      );
    }
    assert(
      Array.isArray(entry.extractedFacts) && entry.extractedFacts.length > 0,
      `evidence audit ${item.id} requires extractedFacts`,
      errors,
    );
    assert(Boolean(entry.claimSummary), `evidence audit ${item.id}.claimSummary is required`, errors);
    assert(Array.isArray(entry.supportedHopIds), `evidence audit ${item.id}.supportedHopIds must be an array`, errors);
    assert(Array.isArray(entry.supportedMetricIds), `evidence audit ${item.id}.supportedMetricIds must be an array`, errors);
    assert(
      Array.isArray(entry.supportedCommercialInputIds),
      `evidence audit ${item.id}.supportedCommercialInputIds must be an array`,
      errors,
    );
    assert(
      Array.isArray(entry.supportedDerivedMetricIds),
      `evidence audit ${item.id}.supportedDerivedMetricIds must be an array`,
      errors,
    );
    assert(
      Array.isArray(entry.supportedRelationshipIds),
      `evidence audit ${item.id}.supportedRelationshipIds must be an array`,
      errors,
    );
    for (const hopId of entry.supportedHopIds ?? []) {
      assert(knownHopIds.has(hopId), `evidence audit ${item.id} references unknown hop ${hopId}`, errors);
    }
    for (const metricId of entry.supportedMetricIds ?? []) {
      assert(knownMetricIds.has(metricId), `evidence audit ${item.id} references unknown metric ${metricId}`, errors);
    }
    for (const inputId of entry.supportedCommercialInputIds ?? []) {
      assert(
        knownCommercialInputIds.has(inputId),
        `evidence audit ${item.id} references unknown commercial input ${inputId}`,
        errors,
      );
    }
    for (const metricId of entry.supportedDerivedMetricIds ?? []) {
      assert(
        knownDerivedMetricIds.has(metricId),
        `evidence audit ${item.id} references unknown derived metric ${metricId}`,
        errors,
      );
    }
    for (const relationshipId of entry.supportedRelationshipIds ?? []) {
      assert(
        knownRelationshipIds.has(relationshipId),
        `evidence audit ${item.id} references unknown relationship ${relationshipId}`,
        errors,
      );
    }
    if (item.status === "carried") {
      assert(Boolean(item.note), `carried evidence ${item.id} requires a note`, errors);
      assert(Boolean(entry.carryReason), `evidence audit ${item.id} carried evidence requires carryReason`, errors);
    }
  }

  for (const entry of entries) {
    if (!evidenceById.has(entry.evidenceId)) errors.push(`evidence audit references unknown id ${entry.evidenceId}`);
  }
  if (auditById.size !== entries.length) errors.push("evidence audit contains duplicate evidenceId entries");

  for (const trace of exposure?.traces ?? []) {
    for (const hop of trace.hops ?? []) {
      const hopClaimId = `${trace.id}:${hop.id}`;
      for (const evidenceId of hop.evidenceIds ?? []) {
        const entry = auditById.get(evidenceId);
        if (entry && !(entry.supportedHopIds ?? []).includes(hopClaimId)) {
          errors.push(`evidence audit ${evidenceId} does not support hop ${hopClaimId}`);
        }
      }

      for (const metric of hop.metrics ?? []) {
        if (!["confirmed", "carried"].includes(metric.status)) continue;
        const expectedMetric = state.traceInputs?.metrics?.[metric.inputId] ?? metric;
        const supportingEntries = (hop.evidenceIds ?? [])
          .map((id) => auditById.get(id))
          .filter((entry) => (entry?.supportedMetricIds ?? []).includes(metric.inputId));
        if (!supportingEntries.length) {
          errors.push(`trace metric ${metric.inputId} has no directly supporting audited evidence in ${hopClaimId}`);
          continue;
        }
        if (
          MARKET_OBSERVATION_TRACE_INPUTS.includes(metric.inputId) &&
          !supportingEntries.some((entry) => evidenceById.get(entry.evidenceId)?.kind === "market-observation")
        ) {
          errors.push(`market trace metric ${metric.inputId} requires market-observation evidence`);
        }
        for (const entry of supportingEntries) {
          const evidenceItem = evidenceById.get(entry.evidenceId);
          if (evidenceItem?.kind !== "market-observation") continue;
          const observation = (entry.observations ?? []).find((item) => item.inputId === metric.inputId);
          if (!observation) {
            errors.push(`market evidence ${entry.evidenceId} requires an observation for ${metric.inputId}`);
            continue;
          }
          for (const key of ["value", "unit", "sourceDate", "observedAt"]) {
            if (expectedMetric[key] !== undefined && !sameAuditValue(observation[key], expectedMetric[key])) {
              errors.push(`market evidence ${entry.evidenceId} observation ${metric.inputId}.${key} does not match the trace metric`);
            }
          }
          if (!observation.instrument) errors.push(`market evidence ${entry.evidenceId} observation ${metric.inputId} requires instrument`);
          if (!observation.provider) errors.push(`market evidence ${entry.evidenceId} observation ${metric.inputId} requires provider`);
        }
      }
    }

    for (const counterparty of trace.counterparties ?? []) {
      const relationshipId = `${trace.id}:${counterparty.entityId}`;
      const supported = (counterparty.evidenceIds ?? []).some((id) =>
        (auditById.get(id)?.supportedRelationshipIds ?? []).includes(relationshipId),
      );
      if (!supported) errors.push(`counterparty relationship ${relationshipId} has no directly supporting audited evidence`);
    }
  }

  for (const [inputId, input] of Object.entries(state.commercialInputs ?? {})) {
    if (!["confirmed", "carried"].includes(input.status)) continue;
    const matchingEvidenceIds = input.evidenceIds ?? [];
    const supportingEntries = matchingEvidenceIds
      .map((id) => auditById.get(id))
      .filter((entry) => (entry?.supportedCommercialInputIds ?? []).includes(inputId));
    if (!supportingEntries.length) {
      errors.push(`commercial input ${inputId} has no directly supporting audited evidence`);
      continue;
    }
    for (const entry of supportingEntries) {
      const evidenceItem = evidenceById.get(entry.evidenceId);
      if (evidenceItem?.kind !== "market-observation") continue;
      const observation = (entry.observations ?? []).find((item) => item.inputId === inputId);
      if (!observation) {
        errors.push(`market evidence ${entry.evidenceId} requires an observation for ${inputId}`);
        continue;
      }
      for (const key of ["value", "unit", "sourceDate", "observedAt"]) {
        if (input[key] !== undefined && !sameAuditValue(observation[key], input[key])) {
          errors.push(`market evidence ${entry.evidenceId} observation ${inputId}.${key} does not match the commercial input`);
        }
      }
      if (!observation.instrument) errors.push(`market evidence ${entry.evidenceId} observation ${inputId} requires instrument`);
      if (!observation.provider) errors.push(`market evidence ${entry.evidenceId} observation ${inputId} requires provider`);
    }
  }

  return errors;
}

export function summarizeEvidenceAudit(exposure, audit) {
  const evidenceById = new Map((exposure?.evidence ?? []).map((item) => [item.id, item]));
  const summary = { checked: 0, verified: 0, carried: 0, unsupported: 0, pending: 0 };
  for (const entry of audit?.entries ?? []) {
    summary.checked += 1;
    if (entry.reviewStatus !== "approved" || entry.contentStatus === "manual-review") summary.pending += 1;
    if (["unsupported", "unreachable"].includes(entry.contentStatus) || entry.reviewStatus === "rejected") {
      summary.unsupported += 1;
    } else if (evidenceById.get(entry.evidenceId)?.status === "carried" || entry.contentStatus === "stale") {
      summary.carried += 1;
    } else if (entry.contentStatus === "verified" && entry.reviewStatus === "approved") {
      summary.verified += 1;
    }
  }
  return summary;
}

export function parseArgs(argv = process.argv.slice(2)) {
  return {
    dryRun: argv.includes("--dry-run"),
    checkOnly: argv.includes("--check"),
  };
}
