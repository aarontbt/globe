import fs from "node:fs";
import {
  PATHS,
  computeCommercialEvaluation,
  loadState,
  readJson,
  signalForZscore,
} from "./daily-common.mjs";
import {
  computeEnergyRefreshFingerprint,
  loadSourceRegistry,
  sha256,
  validateNormalizedCandidates,
} from "./energy-lng-refresh.mjs";
import {
  applyEnergyLngCandidates,
  toEnergyLngDomain,
  toExposureTraceReadModel,
} from "../src/domain/energyLngAdapter.ts";

function clone(value) {
  return structuredClone(value);
}

function patchInput(input, candidate, asOf) {
  const next = { ...input };
  for (const key of [
    "value", "low", "high", "source", "sourceDate", "observedAt", "carryReason", "missingReason",
    "periodStart", "periodEnd", "coverageStatus", "coverageNote", "sourceAgeDays", "machineEvidenceIds",
  ]) {
    delete next[key];
  }
  next.status = candidate.status;
  next.unit = candidate.unit;
  next.cadence = candidate.cadence;
  next.maxAgeDays = candidate.freshnessWindowDays;
  next.observationKind = candidate.observationKind;
  next.periodStart = candidate.periodStart;
  next.periodEnd = candidate.periodEnd;
  next.coverageStatus = candidate.coverage.status;
  if (candidate.coverage.note) next.coverageNote = candidate.coverage.note;
  next.sourceAgeDays = candidate.observationDate
    ? Math.max(0, Math.floor((Date.parse(String(asOf).slice(0, 10)) - Date.parse(String(candidate.observationDate))) / 86_400_000))
    : null;
  if (candidate.machineEvidenceIds?.length) next.machineEvidenceIds = candidate.machineEvidenceIds;
  if (candidate.status === "unavailable") {
    next.source = "";
    next.sourceDate = "";
    next.missingReason = candidate.missingReason;
  } else {
    if (candidate.value !== undefined) next.value = candidate.value;
    if (candidate.low !== undefined) next.low = candidate.low;
    if (candidate.high !== undefined) next.high = candidate.high;
    next.source = candidate.provider;
    next.sourceDate = candidate.observationDate;
    if (candidate.observedAt) next.observedAt = candidate.observedAt;
    if (candidate.status === "carried") next.carryReason = candidate.carryReason;
  }
  return next;
}

function candidateTargets(candidate) {
  return [...new Set([...(candidate.targetInputIds ?? []), ...(candidate.targetCommercialInputIds ?? [])])];
}

function assessmentCandidates(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    if (candidate.selectedForAssessment === false) continue;
    for (const target of candidateTargets(candidate)) {
      const group = groups.get(target) ?? [];
      group.push(candidate);
      groups.set(target, group);
    }
  }
  const selected = new Map();
  for (const [target, group] of groups) {
    const ranked = [...group].sort((left, right) =>
      String(right.periodEnd || right.observationDate || "").localeCompare(String(left.periodEnd || left.observationDate || ""))
      || (right.status === "confirmed" ? 3 : right.status === "carried" ? 2 : 1) - (left.status === "confirmed" ? 3 : left.status === "carried" ? 2 : 1)
      || String(right.sourceId).localeCompare(String(left.sourceId)),
    );
    if (ranked[0]) selected.set(target, ranked[0]);
  }
  return [...new Set(selected.values())];
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function signedPct(value) {
  const rounded = round(value, 1);
  if (Object.is(rounded, -0) || rounded === 0) return "0.0%";
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%`;
}

function ttfAssetDefinition() {
  const data = readJson(PATHS.crossAsset);
  return data.categories.flatMap((category) => category.assets).find((asset) => asset.id === "ttf");
}

function applyTtfCrossAsset(nextState, candidate) {
  if (!candidate.targetInputIds?.includes("ttf") || !nextState.crossAsset?.ttf) return;
  const previous = nextState.crossAsset.ttf;
  if (candidate.status === "unavailable") {
    nextState.crossAsset.ttf = {
      ...previous,
      status: "unavailable",
      source: "",
      sourceDate: "",
      missingReason: candidate.missingReason,
      carryReason: undefined,
    };
    return;
  }
  if (candidate.status === "carried") {
    nextState.crossAsset.ttf = {
      ...previous,
      status: "carried",
      source: candidate.provider,
      sourceDate: candidate.observationDate,
      carryReason: candidate.carryReason,
      missingReason: undefined,
    };
    return;
  }

  const asset = ttfAssetDefinition();
  const price = Number(candidate.value);
  if (!asset || !Number.isFinite(price)) return;
  const previousStdDev = previous.zscore === 0
    ? null
    : Math.abs((previous.current - asset.baseline90d) / previous.zscore);
  const zscore = previousStdDev
    ? round((price - asset.baseline90d) / previousStdDev, 2)
    : previous.zscore;
  nextState.crossAsset.ttf = {
    ...previous,
    current: round(price, 2),
    change1d: Number.isFinite(Number(candidate.changePct)) ? signedPct(candidate.changePct) : previous.change1d,
    zscore,
    signal: signalForZscore(zscore),
    status: "confirmed",
    source: candidate.provider,
    sourceDate: candidate.observationDate,
    carryReason: undefined,
    missingReason: undefined,
  };
}

function applyCandidateInputs(state, candidates) {
  const next = clone(state);
  for (const candidate of assessmentCandidates(candidates)) {
    for (const inputId of candidate.targetInputIds ?? []) {
      if (next.traceInputs?.metrics?.[inputId]) {
        next.traceInputs.metrics[inputId] = patchInput(next.traceInputs.metrics[inputId], candidate, state.asOf);
      }
    }
    for (const inputId of candidate.targetCommercialInputIds ?? []) {
      if (next.commercialInputs?.[inputId]) {
        const patched = patchInput(next.commercialInputs[inputId], candidate, state.asOf);
        patched.evidenceIds = [...new Set(candidate.evidenceIds ?? next.commercialInputs[inputId].evidenceIds ?? [])];
        next.commercialInputs[inputId] = patched;
      }
    }
    if (candidate.targetInputIds?.includes("ttf") && next.crossAsset?.ttf) {
      applyTtfCrossAsset(next, candidate);
    }
    if (candidate.targetInputIds?.includes("ttf") && next.runbookState?.ttf) {
      const carriedSuffix = "; carried after machine refresh failure";
      if (candidate.status === "carried" && !next.runbookState.ttf.includes(carriedSuffix)) {
        next.runbookState.ttf = `${next.runbookState.ttf}${carriedSuffix}`;
      } else if (candidate.status === "confirmed") {
        const change = Number.isFinite(Number(candidate.changePct)) ? signedPct(candidate.changePct) : next.crossAsset.ttf.change1d;
        next.runbookState.ttf = `${Number(candidate.value).toFixed(2)} EUR/MWh (${candidate.observationDate}, ${candidate.provider}; ${change})`;
      } else if (candidate.status === "unavailable") {
        next.runbookState.ttf = `TTF unavailable (${candidate.missingReason})`;
      }
    }
  }
  return next;
}

function applyStateToExposure(exposure, state) {
  const next = clone(exposure);
  next.asOf = state.asOf;
  next.day = state.day;
  next.headline = state.traceInputs.headline;
  for (const trace of next.traces ?? []) {
    for (const hop of trace.hops ?? []) {
      for (const metric of hop.metrics ?? []) {
        const update = state.traceInputs.metrics[metric.inputId];
        if (!update) continue;
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
      }
    }
    trace.commercialEvaluation = computeCommercialEvaluation(
      trace.commercialEvaluation,
      state.commercialInputs,
      state.asOf,
    );
  }
  next.commercialInputs = next.commercialInputs.map((input) => ({
    inputId: input.inputId,
    ...(state.commercialInputs[input.inputId] ?? input),
  }));
  for (const evidence of next.evidence ?? []) {
    const update = state.traceInputs.evidenceUpdates[evidence.id];
    if (update) Object.assign(evidence, update);
  }
  return next;
}

function compareValues(actual, expected) {
  if (typeof expected === "number") return Number(actual) === expected;
  return actual === expected;
}

function validateCandidateEvidenceCompatibility({ candidates, sources, exposure, audit }) {
  const errors = [];
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const auditById = new Map((audit?.entries ?? []).map((entry) => [entry.evidenceId, entry]));
  for (const candidate of candidates) {
    const source = sourceById.get(candidate.sourceId);
    if (!source || source.category !== "market-context" || candidate.status === "unavailable") continue;
    for (const evidenceId of candidate.evidenceIds ?? []) {
      const entry = auditById.get(evidenceId);
      if (!entry) {
        errors.push(`candidate ${candidate.id} market evidence ${evidenceId} is not analyst-approved`);
        continue;
      }
      for (const inputId of [...candidate.targetInputIds, ...candidate.targetCommercialInputIds]) {
        const observation = (entry.observations ?? []).find((item) => item.inputId === inputId);
        if (!observation) {
          errors.push(`candidate ${candidate.id} market evidence ${evidenceId} has no observation for ${inputId}`);
          continue;
        }
        for (const key of ["value", "unit", "sourceDate", "observedAt"]) {
          const expected = candidate[key === "sourceDate" ? "observationDate" : key];
          if (expected !== undefined && expected !== null && !compareValues(observation[key], expected)) {
            errors.push(`candidate ${candidate.id} ${inputId}.${key} does not match approved evidence ${evidenceId}`);
          }
        }
      }
    }
  }
  return errors;
}

function candidateEnvelope() {
  const candidatesPresent = fs.existsSync(PATHS.energyCandidates);
  const reportPresent = fs.existsSync(PATHS.energyRefreshReport);
  if (!candidatesPresent && !reportPresent) return null;
  if (candidatesPresent !== reportPresent) {
    return { artifactError: "Energy/LNG candidates and refresh report must be present as a complete pair; rerun energy:refresh" };
  }
  const candidates = readJson(PATHS.energyCandidates);
  const report = readJson(PATHS.energyRefreshReport);
  return { candidates, report };
}

function runtimeVersion(domain, asOf) {
  return `energy-runtime:${sha256({ asOf, domain }).slice(0, 24)}`;
}

function mergeById(existing, incoming) {
  const values = new Map((existing ?? []).map((item) => [item.id, item]));
  for (const item of incoming ?? []) values.set(item.id, item);
  return [...values.values()];
}

function applyPublishedCollections(domain, report) {
  const sourceFilter = report?.sourceFilter;
  if (!sourceFilter) {
    domain.machineEvidence = report?.machineEvidence ?? [];
    domain.coverage = report?.coverage ?? {};
    domain.reconciliations = report?.reconciliations ?? [];
    return;
  }

  domain.machineEvidence = mergeById(domain.machineEvidence, report.machineEvidence);
  const selectedCoverage = report.coverage?.[sourceFilter];
  domain.coverage = selectedCoverage
    ? { ...(domain.coverage ?? {}), [sourceFilter]: selectedCoverage }
    : (domain.coverage ?? {});
  domain.reconciliations = mergeById(domain.reconciliations, report.reconciliations);
}

export function prepareEnergyPromotion({
  state = loadState(),
  exposure = readJson(PATHS.exposure),
  audit = readJson(PATHS.evidenceAudit),
  registry = loadSourceRegistry(),
  candidateEnvelopeOverride = undefined,
} = {}) {
  const envelope = candidateEnvelopeOverride === undefined ? candidateEnvelope() : candidateEnvelopeOverride;
  const baseDomain = toEnergyLngDomain(exposure);
  const existingRuntime = fs.existsSync(PATHS.energyRuntime) ? readJson(PATHS.energyRuntime) : null;
  if (envelope?.artifactError) {
    return {
      promoted: false,
      state,
      exposure,
      domain: baseDomain,
      readModel: exposure,
      runtime: existingRuntime,
      report: null,
      errors: [envelope.artifactError],
      warnings: [],
    };
  }
  if (!envelope) {
    if (existingRuntime?.promotionStatus === "promoted") {
      return {
        promoted: false,
        state,
        exposure,
        domain: baseDomain,
        readModel: exposure,
        runtime: existingRuntime,
        report: null,
        errors: ["Energy/LNG runtime is already promoted but its candidate/report pair is missing; rerun energy:refresh before promotion"],
        warnings: [],
      };
    }
    const runtime = {
      schemaVersion: "energy-lng-runtime-v1",
      promotionStatus: "not-run",
      promotedAt: state.asOf,
      assessmentVersion: runtimeVersion(baseDomain, state.asOf),
      sourceRunId: null,
      promotedRecordIds: [],
      domain: baseDomain,
      readModelVersion: "energy-lng-read-model-v1",
    };
    return {
      promoted: false,
      state,
      exposure,
      domain: baseDomain,
      readModel: toExposureTraceReadModel(baseDomain),
      runtime,
      report: null,
      errors: [],
      warnings: ["No Energy/LNG candidate report is present; canonical runtime bootstrapped from reviewed exposure data."],
    };
  }

  const { candidates, report } = envelope;
  const errors = [];
  const warnings = [];
  if (candidates?.schemaVersion !== "energy-lng-candidates-v1") errors.push("Energy/LNG candidates schemaVersion is invalid");
  if (report?.schemaVersion !== "energy-lng-refresh-v1") errors.push("Energy/LNG refresh report schemaVersion is invalid");
  if (report?.runId !== candidates?.runId) errors.push("Energy/LNG candidate runId does not match refresh report");
  if (report?.asOf !== state.asOf) errors.push(`Energy/LNG candidate asOf ${report?.asOf} does not match daily-state.asOf ${state.asOf}`);
  const currentFingerprint = computeEnergyRefreshFingerprint({ state, exposure, registry });
  if (!report?.baseFingerprint) errors.push("Energy/LNG refresh report is missing its input fingerprint; rerun energy:refresh");
  if (!candidates?.baseFingerprint) errors.push("Energy/LNG candidates are missing their input fingerprint; rerun energy:refresh");
  if (report?.baseFingerprint && candidates?.baseFingerprint && report.baseFingerprint !== candidates.baseFingerprint) {
    errors.push("Energy/LNG candidate/report fingerprints differ");
  }
  if (report?.validation?.errors?.length) errors.push(...report.validation.errors.map((error) => `refresh validation: ${error}`));
  if (report?.promotion?.status !== "validated") errors.push(`Energy/LNG refresh promotion status is ${report?.promotion?.status}, not validated`);
  if (JSON.stringify(candidates?.observations ?? []) !== JSON.stringify(report?.observations ?? [])) {
    errors.push("Energy/LNG candidates do not match the observations in the refresh report");
  }
  if (JSON.stringify(candidates?.machineEvidence ?? []) !== JSON.stringify(report?.machineEvidence ?? [])) {
    errors.push("Energy/LNG candidates do not match machine snapshot evidence in the refresh report");
  }
  for (const key of ["reconciliations", "coverage", "sourceFilter", "requestedPeriod"]) {
    if (candidates?.[key] !== undefined && JSON.stringify(candidates[key]) !== JSON.stringify(report?.[key] ?? null)) {
      errors.push(`Energy/LNG candidates do not match refresh report ${key}`);
    }
  }

  const candidateValidation = validateNormalizedCandidates({
    candidates: candidates?.observations ?? [],
    sources: registry.sources,
    state,
    exposure,
    asOf: state.asOf,
    snapshots: report?.snapshots ?? [],
    machineEvidence: report?.machineEvidence ?? [],
    allowHistorical: Boolean(report?.requestedPeriod),
  });
  errors.push(...candidateValidation.errors);
  warnings.push(...candidateValidation.warnings);
  errors.push(...validateCandidateEvidenceCompatibility({
    candidates: candidates?.observations ?? [],
    sources: registry.sources,
    exposure,
    audit,
  }));
  if (errors.length) {
    return {
      promoted: false,
      state,
      exposure,
      domain: baseDomain,
      readModel: exposure,
      runtime: null,
      report,
      errors,
      warnings,
    };
  }

  const stagedState = applyCandidateInputs(state, candidates.observations);
  const stagedExposure = applyStateToExposure(exposure, stagedState);
  const promotedFingerprint = computeEnergyRefreshFingerprint({ state: stagedState, exposure: stagedExposure, registry });
  if (currentFingerprint !== report.baseFingerprint && currentFingerprint !== promotedFingerprint) {
    errors.push("Energy/LNG refresh is stale relative to current daily state, exposure, or source registry; rerun energy:refresh");
  }
  if (errors.length) {
    return {
      promoted: false,
      state,
      exposure,
      domain: baseDomain,
      readModel: exposure,
      runtime: existingRuntime,
      report,
      errors,
      warnings,
    };
  }
  const stagedDomain = toEnergyLngDomain(stagedExposure);
  applyPublishedCollections(stagedDomain, report);
  const domain = applyEnergyLngCandidates(stagedDomain, candidates.observations, report.promotion.calculatedAt || stagedState.asOf);
  const readModel = toExposureTraceReadModel(domain);
  const runtime = {
    schemaVersion: "energy-lng-runtime-v1",
    promotionStatus: "promoted",
    promotedAt: report.promotion.calculatedAt || stagedState.asOf,
    assessmentVersion: runtimeVersion(domain, stagedState.asOf),
    sourceRunId: report.runId,
    baseFingerprint: report.baseFingerprint,
    promotedRecordIds: candidates.observations.map((candidate) => candidate.id),
    domain,
    readModelVersion: "energy-lng-read-model-v1",
  };
  return {
    promoted: true,
    state: stagedState,
    exposure: readModel,
    domain,
    readModel,
    runtime,
    report,
    errors: [],
    warnings,
  };
}

export function writeEnergyRuntime(prepared, writeFile = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)) {
  if (!prepared.runtime) return;
  writeFile(PATHS.energyRuntime, prepared.runtime);
  writeFile(PATHS.energyReadModel, prepared.readModel);
}
