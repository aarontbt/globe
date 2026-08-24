import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  PATHS,
  ROOT,
  loadState,
  readJson,
  writeJson,
} from "./daily-common.mjs";
import { fetchQuote } from "./daily-fetch.mjs";

export const ENERGY_REFRESH_SCHEMA_VERSION = "energy-lng-refresh-v1";
export const ENERGY_CANDIDATE_SCHEMA_VERSION = "energy-lng-candidates-v1";
export const ENERGY_SNAPSHOT_SCHEMA_VERSION = "energy-lng-raw-snapshot-v1";

const STATUS_CONFIDENCE = {
  confirmed: "high",
  carried: "medium",
  unavailable: "unknown",
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[a-f0-9]{64}$/;

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

export function sha256(value) {
  const input = typeof value === "string" ? value : stableJson(value);
  return createHash("sha256").update(input).digest("hex");
}

function refreshFingerprintExposure(exposure) {
  const projected = structuredClone(exposure);
  delete projected.machineEvidence;
  for (const trace of projected.traces ?? []) {
    for (const hop of trace.hops ?? []) {
      for (const metric of hop.metrics ?? []) delete metric.machineEvidenceIds;
    }
  }
  for (const input of projected.commercialInputs ?? []) delete input.machineEvidenceIds;
  return projected;
}

function isoOrNull(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : String(value);
}

function dateOnly(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d{6}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-01`;
  if (/^\d{4}$/.test(text)) return `${text}-01-01`;
  return text.slice(0, 10);
}

function parseDateOnly(value) {
  const normalized = dateOnly(value);
  if (!normalized || !DATE_ONLY.test(normalized)) return null;
  const timestamp = Date.parse(`${normalized}T00:00:00Z`);
  return Number.isFinite(timestamp) ? normalized : null;
}

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export function periodBounds(value, cadence = "daily") {
  const text = String(value ?? "").trim();
  if (!text) return { start: null, end: null };
  if (/^\d{4}$/.test(text)) return { start: `${text}-01-01`, end: `${text}-12-31` };
  if (/^\d{6}$/.test(text)) {
    const year = Number(text.slice(0, 4));
    const month = Number(text.slice(4, 6));
    return { start: `${text.slice(0, 4)}-${text.slice(4, 6)}-01`, end: lastDayOfMonth(year, month) };
  }
  const normalized = parseDateOnly(text);
  if (!normalized) return { start: null, end: null };
  const date = new Date(`${normalized}T00:00:00Z`);
  if (cadence === "monthly") return { start: `${normalized.slice(0, 7)}-01`, end: lastDayOfMonth(date.getUTCFullYear(), date.getUTCMonth() + 1) };
  if (cadence === "annual") return { start: `${date.getUTCFullYear()}-01-01`, end: `${date.getUTCFullYear()}-12-31` };
  if (cadence === "weekly") {
    const day = date.getUTCDay() || 7;
    const start = new Date(date.getTime() - (day - 1) * 86_400_000).toISOString().slice(0, 10);
    const end = new Date(date.getTime() + (7 - day) * 86_400_000).toISOString().slice(0, 10);
    return { start, end };
  }
  return { start: normalized, end: normalized };
}

function periodKey(start, end) {
  return `${start ?? "unavailable"}/${end ?? "unavailable"}`;
}

function cadenceFor(source, raw = {}) {
  return raw.cadence || source.cadence || "daily";
}

function observationPeriod(raw, source) {
  const cadence = cadenceFor(source, raw);
  const explicitStart = parseDateOnly(raw.periodStart || raw.startDate);
  const explicitEnd = parseDateOnly(raw.periodEnd || raw.endDate);
  const bounds = periodBounds(raw.period || raw.observationDate || raw.sourceDate || raw.observedAt, cadence);
  return {
    start: explicitStart || bounds.start,
    end: explicitEnd || bounds.end,
  };
}

function expectedPeriods(from, to, cadence) {
  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  if (!start || !end) return [];
  const periods = [];
  let cursor = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  while (cursor <= endDate) {
    const value = cursor.toISOString().slice(0, 10);
    const bounds = periodBounds(value, cadence);
    if (!periods.includes(periodKey(bounds.start, bounds.end))) periods.push(periodKey(bounds.start, bounds.end));
    if (cadence === "annual") cursor = new Date(Date.UTC(cursor.getUTCFullYear() + 1, 0, 1));
    else if (cadence === "monthly") cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    else if (cadence === "weekly") cursor = new Date(cursor.getTime() + 7 * 86_400_000);
    else cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return periods;
}

function daysBetween(asOf, sourceDate) {
  if (!sourceDate) return Number.NaN;
  const later = Date.parse(dateOnly(asOf));
  const earlier = Date.parse(dateOnly(sourceDate));
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return Number.NaN;
  return Math.floor((later - earlier) / 86_400_000);
}

function slug(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

function sourceTargets(source) {
  return {
    targetInputIds: [...new Set(source.targetInputIds ?? [])],
    targetCommercialInputIds: [...new Set(source.targetCommercialInputIds ?? [])],
  };
}

function targetIds(source) {
  const targets = sourceTargets(source);
  return [...new Set([...targets.targetInputIds, ...targets.targetCommercialInputIds])];
}

function targetPolicy(source, targetId) {
  return source.targetPolicies?.[targetId] || {
    cadence: source.cadence,
    maxAgeDays: source.maxAgeDays,
    allowedUnits: source.allowedUnits,
    entityIds: source.entityIds,
  };
}

function policyForSource(source) {
  const policies = targetIds(source).map((targetId) => targetPolicy(source, targetId));
  if (!policies.length) return targetPolicy(source, "");
  const [first] = policies;
  return {
    cadence: first.cadence,
    maxAgeDays: first.maxAgeDays,
    allowedUnits: [...new Set(policies.flatMap((policy) => policy.allowedUnits || []))],
    entityIds: [...new Set(policies.flatMap((policy) => policy.entityIds || []))],
    observationKind: first.observationKind,
    coverageStatus: first.coverageStatus,
  };
}

function sourceSelection(source) {
  return source.selection || { type: "reviewed-event" };
}

function selectorValue(selection, key, envKey) {
  return (selection?.[envKey] ? process.env[selection[envKey]] || selection?.[key] : selection?.[key]) || "";
}

function sameSet(left, right) {
  return JSON.stringify([...new Set(left || [])].sort()) === JSON.stringify([...new Set(right || [])].sort());
}

export function loadSourceRegistry(file = PATHS.energySourceRegistry) {
  const registry = readJson(file);
  return registry;
}

export function validateSourceRegistry(registry) {
  const errors = [];
  if (registry?.schemaVersion !== "energy-lng-source-registry-v1") {
    errors.push("source registry schemaVersion must be energy-lng-source-registry-v1");
  }
  if (!Array.isArray(registry?.sources)) {
    errors.push("source registry sources must be an array");
    return errors;
  }

  const ids = new Set();
  const cadences = new Set(["daily", "weekly", "monthly", "annual", "event-driven", "contract-driven"]);
  const observationKinds = new Set(["flow", "capacity", "asset-status", "transit", "trade-demand"]);
  const coverageStatuses = new Set(["direct-observation", "public-proxy", "partial-coverage", "unavailable"]);
  for (const source of registry.sources) {
    if (!source?.id) errors.push("source registry entries require id");
    if (ids.has(source?.id)) errors.push(`source registry contains duplicate id ${source.id}`);
    ids.add(source?.id);
    if (!/^https:\/\//.test(source?.url ?? "")) errors.push(`source ${source?.id ?? "?"} url must use https`);
    if (!source?.provider) errors.push(`source ${source?.id ?? "?"} provider is required`);
    if (!source?.title) errors.push(`source ${source?.id ?? "?"} title is required`);
    if (!cadences.has(source?.cadence)) errors.push(`source ${source?.id ?? "?"} cadence is invalid`);
    if (!Number.isFinite(Number(source?.maxAgeDays)) || Number(source.maxAgeDays) <= 0) {
      errors.push(`source ${source?.id ?? "?"} maxAgeDays must be positive`);
    }
    if (!Array.isArray(source?.allowedUnits) || source.allowedUnits.length === 0) {
      errors.push(`source ${source?.id ?? "?"} allowedUnits must not be empty`);
    }
    if (!Array.isArray(source?.entityIds) || source.entityIds.length === 0) {
      errors.push(`source ${source?.id ?? "?"} entityIds must not be empty`);
    }
    if (!Array.isArray(source?.targetInputIds) || !Array.isArray(source?.targetCommercialInputIds)) {
      errors.push(`source ${source?.id ?? "?"} target input arrays are required`);
    }
    if (!Array.isArray(source?.evidenceIds)) errors.push(`source ${source?.id ?? "?"} evidenceIds must be an array`);
    if (!source?.parserVersion) errors.push(`source ${source?.id ?? "?"} parserVersion is required`);
    if (!["automated", "manual-only"].includes(source?.automation)) {
      errors.push(`source ${source?.id ?? "?"} automation is invalid`);
    }
    if (!["carry", "unavailable", "preserve-reviewed"].includes(source?.fallback)) {
      errors.push(`source ${source?.id ?? "?"} fallback is invalid`);
    }
    const selection = source?.selection;
    const validSelectionTypes = ["eia-series", "portwatch-route", "comtrade-trade", "asset-registry", "yahoo-symbol", "reviewed-event"];
    if (!selection || !validSelectionTypes.includes(selection.type)) {
      errors.push(`source ${source?.id ?? "?"} selection.type is invalid`);
    } else if (selection.type === "eia-series" && !selection.seriesId && !selection.seriesIdEnv) {
      errors.push(`source ${source.id} eia-series selection requires seriesId or seriesIdEnv`);
    } else if (selection.type === "portwatch-route" && !selection.routeId && !selection.routeIdEnv) {
      errors.push(`source ${source.id} portwatch-route selection requires routeId or routeIdEnv`);
    } else if (selection.type === "portwatch-route" && !selection.endpointEnv && !source.approvedEndpointEnv) {
      errors.push(`source ${source.id} portwatch-route selection requires an approved machine-readable endpoint environment variable`);
    } else if (selection.type === "comtrade-trade") {
      for (const key of ["reporterCode", "partnerCode", "flowCode", "commodityCode", "classificationCode"]) {
        if (!selection[key]) errors.push(`source ${source.id} comtrade-trade selection requires ${key}`);
      }
    } else if (selection.type === "asset-registry") {
      if (!selection.assetNamespace) errors.push(`source ${source.id} asset-registry selection requires assetNamespace`);
      if (!selection.assetField) errors.push(`source ${source.id} asset-registry selection requires assetField`);
    } else if (selection.type === "yahoo-symbol" && !selection.symbol) {
      errors.push(`source ${source.id} yahoo-symbol selection requires symbol`);
    }
    if (source.observationKind && !observationKinds.has(source.observationKind)) {
      errors.push(`source ${source.id} observationKind is invalid`);
    }
    if (source.coverageStatus && !coverageStatuses.has(source.coverageStatus)) {
      errors.push(`source ${source.id} coverageStatus is invalid`);
    }
    if (source.reconciliationPriority !== undefined && !Number.isFinite(Number(source.reconciliationPriority))) {
      errors.push(`source ${source.id} reconciliationPriority must be numeric`);
    }
    for (const targetId of [...(source?.targetInputIds || []), ...(source?.targetCommercialInputIds || [])]) {
      const policy = source?.targetPolicies?.[targetId];
      if (!policy) {
        errors.push(`source ${source?.id ?? "?"} target ${targetId} requires a target policy`);
        continue;
      }
      if (!cadences.has(policy.cadence)) {
        errors.push(`source ${source.id} target ${targetId} cadence is invalid`);
      }
      if (!Number.isFinite(Number(policy.maxAgeDays)) || Number(policy.maxAgeDays) <= 0) {
        errors.push(`source ${source.id} target ${targetId} maxAgeDays must be positive`);
      }
      if (!Array.isArray(policy.allowedUnits) || policy.allowedUnits.length === 0) {
        errors.push(`source ${source.id} target ${targetId} allowedUnits must not be empty`);
      }
      if (!Array.isArray(policy.entityIds) || policy.entityIds.length === 0) {
        errors.push(`source ${source.id} target ${targetId} entityIds must not be empty`);
      }
      if (policy.observationKind && !observationKinds.has(policy.observationKind)) {
        errors.push(`source ${source.id} target ${targetId} observationKind is invalid`);
      }
      if (policy.coverageStatus && !coverageStatuses.has(policy.coverageStatus)) {
        errors.push(`source ${source.id} target ${targetId} coverageStatus is invalid`);
      }
    }
  }
  return errors;
}

export function stableRecordKey({
  sourceId,
  entityIds,
  targetInputIds,
  targetCommercialInputIds,
  observationDate,
  unit,
  observationKind,
  periodStart,
  periodEnd,
}) {
  return sha256({
    sourceId,
    entityIds: [...new Set(entityIds ?? [])].sort(),
    targetInputIds: [...new Set(targetInputIds ?? [])].sort(),
    targetCommercialInputIds: [...new Set(targetCommercialInputIds ?? [])].sort(),
    observationDate: observationDate ?? null,
    unit: unit ?? null,
    observationKind: observationKind ?? "flow",
    periodStart: periodStart ?? observationDate ?? null,
    periodEnd: periodEnd ?? observationDate ?? null,
  });
}

function snapshotRef(snapshot) {
  return `snapshot:${snapshot.id}`;
}

function defaultRecordId(source, targets, observationDate, periodStart = observationDate, periodEnd = observationDate) {
  const target = [...targets.targetInputIds, ...targets.targetCommercialInputIds].map(slug).join("-") || "source";
  return `energy-observation:${slug(source.id)}:${target}:${slug(periodStart ?? observationDate ?? "unavailable")}:${slug(periodEnd ?? observationDate ?? "unavailable")}`;
}

function sourceUrlFor(source, raw) {
  return raw?.sourceUrl || source.url;
}

function unitAllowed(unit, allowedUnits) {
  if (unit === null || unit === undefined) return true;
  return allowedUnits.some((allowed) => unit === allowed || unit.startsWith(`${allowed} `) || unit.startsWith(`${allowed} (`));
}

function buildLineage(source, snapshot, recordKey, raw, derivedFrom = []) {
  return {
    sourceId: source.id,
    sourceUrl: sourceUrlFor(source, raw),
    provider: raw?.provider || source.provider,
    observationAt: isoOrNull(raw?.observedAt || raw?.periodEnd || raw?.observationDate || raw?.sourceDate),
    retrievedAt: snapshot.retrievedAt,
    snapshotHash: snapshot.contentHash,
    snapshotRef: snapshotRef(snapshot),
    parserVersion: source.parserVersion,
    recordKey,
    derivedFrom: [...new Set(derivedFrom)],
  };
}

export function normalizeObservation(raw, source, snapshot, {
  asOf,
  derivedFrom = [],
} = {}) {
  const targets = sourceTargets(source);
  const policy = policyForSource(source);
  const entityIds = [...new Set(raw?.entityIds || policy.entityIds || source.entityIds || [])];
  const period = observationPeriod(raw || {}, source);
  const observationDate = dateOnly(raw?.observationDate || period.end || period.start || raw?.sourceDate || raw?.observedAt);
  const unit = raw?.unit === undefined ? null : raw.unit;
  const observationKind = raw?.observationKind || policy.observationKind || source.observationKind || "flow";
  const recordKey = raw?.recordKey || stableRecordKey({
    sourceId: source.id,
    entityIds,
    ...targets,
    observationDate,
    unit,
    observationKind,
    periodStart: period.start,
    periodEnd: period.end,
  });
  const status = raw?.status || "confirmed";
  const id = raw?.id || defaultRecordId(source, targets, observationDate, period.start, period.end);
  const value = raw?.value;
  const coverageStatus = raw?.coverageStatus
    || raw?.coverage?.status
    || policy.coverageStatus
    || source.coverageStatus
    || (source.category === "trade-demand" ? "public-proxy" : "direct-observation");
  const coverage = {
    status: coverageStatus,
    sourcePeriod: raw?.coverage?.sourcePeriod || (period.start && period.end ? { start: period.start, end: period.end } : null),
    expectedCadence: raw?.coverage?.expectedCadence || cadenceFor(source, raw),
    observedPeriod: raw?.coverage?.observedPeriod || (period.start && period.end ? { start: period.start, end: period.end } : null),
    missingPeriods: [...new Set(raw?.coverage?.missingPeriods || [])],
    sourceStatus: snapshot.status,
    ...(raw?.coverage?.note || raw?.coverageNote ? { note: raw.coverage?.note || raw.coverageNote } : {}),
  };
  const normalized = {
    id,
    recordKey,
    label: raw?.label || source.title,
    entityIds,
    ...targets,
    observationKind,
    periodStart: period.start,
    periodEnd: period.end,
    ...(Array.isArray(raw?.aliases) ? { aliases: [...new Set(raw.aliases)] } : {}),
    coverage,
    ...(value !== undefined ? { value } : {}),
    ...(typeof raw?.low === "number" ? { low: raw.low } : {}),
    ...(typeof raw?.high === "number" ? { high: raw.high } : {}),
    ...(typeof raw?.change === "number" && Number.isFinite(raw.change) ? { change: raw.change } : {}),
    ...(typeof raw?.changePct === "number" && Number.isFinite(raw.changePct) ? { changePct: raw.changePct } : {}),
    unit,
    observationDate,
    observedAt: isoOrNull(raw?.observedAt || raw?.periodEnd || raw?.sourceDate),
    retrievedAt: snapshot.retrievedAt,
    cadence: raw?.cadence || policy.cadence,
    freshnessWindowDays: Number(raw?.freshnessWindowDays ?? policy.maxAgeDays),
    provider: raw?.provider || source.provider,
    sourceId: source.id,
    sourceUrl: sourceUrlFor(source, raw),
    confidence: raw?.confidence || STATUS_CONFIDENCE[status] || "unknown",
    status,
    evidenceIds: [...new Set(raw?.evidenceIds || source.evidenceIds || [])],
    machineEvidenceIds: [...new Set(raw?.machineEvidenceIds || (
      snapshot.status === "fetched" && source.automation === "automated" ? [snapshot.evidenceId] : []
    ))],
    ...(raw?.missingReason ? { missingReason: raw.missingReason } : {}),
    ...(raw?.carryReason ? { carryReason: raw.carryReason } : {}),
  };
  normalized.lineage = buildLineage(source, snapshot, recordKey, raw, derivedFrom);
  return normalized;
}

function unavailableCandidate(source, snapshot, reason, raw = {}) {
  return normalizeObservation({
    ...raw,
    machineEvidenceIds: [],
    status: "unavailable",
    value: undefined,
    low: undefined,
    high: undefined,
    observationDate: null,
    observedAt: null,
    unit: raw.unit ?? source.allowedUnits?.[0] ?? null,
    missingReason: reason,
    confidence: "unknown",
    coverageStatus: "unavailable",
    observationKind: raw.observationKind || source.observationKind || "flow",
  }, source, snapshot);
}

function findStateInput(state, inputId) {
  return state.traceInputs?.metrics?.[inputId] || state.commercialInputs?.[inputId] || null;
}

function evidenceForInput(exposure, inputId) {
  for (const trace of exposure.traces ?? []) {
    for (const hop of trace.hops ?? []) {
      if (hop.metrics?.some((metric) => metric.inputId === inputId)) {
        return (hop.evidenceIds ?? [])
          .map((id) => exposure.evidence?.find((item) => item.id === id))
          .find(Boolean);
      }
    }
  }
  return exposure.evidence?.find((item) => item.id === inputId);
}

function carryCandidate(source, snapshot, state, exposure, reason) {
  const targets = sourceTargets(source);
  const policy = policyForSource(source);
  const targetId = targets.targetInputIds[0] || targets.targetCommercialInputIds[0];
  const existing = targetId ? findStateInput(state, targetId) : null;
  if (!existing || existing.status === "unavailable") {
    return unavailableCandidate(source, snapshot, reason, {
      label: existing?.label || source.title,
      unit: existing?.unit || source.allowedUnits?.[0] || null,
      evidenceIds: source.evidenceIds,
    });
  }

  const evidence = source.evidenceIds
    .map((id) => exposure.evidence?.find((item) => item.id === id))
    .find(Boolean) || evidenceForInput(exposure, targetId);
  const sourceUrl = evidence?.url || source.url;
  const provider = existing.source || source.provider;
  const derivedFrom = [...new Set([
    ...(source.evidenceIds || []),
    ...(existing.evidenceIds || []),
  ])];
  return normalizeObservation({
    label: existing.label || source.title,
    entityIds: policy.entityIds,
    value: existing.value,
    low: existing.low,
    high: existing.high,
    unit: existing.unit ?? source.allowedUnits?.[0] ?? null,
    observationDate: existing.sourceDate || null,
    observedAt: existing.observedAt,
    cadence: existing.cadence || source.cadence,
    freshnessWindowDays: existing.maxAgeDays || source.maxAgeDays,
    provider,
    sourceUrl,
    status: "carried",
    confidence: "medium",
    machineEvidenceIds: [],
    evidenceIds: [...new Set([...(source.evidenceIds || []), ...(existing.evidenceIds || [])])],
    carryReason: existing.carryReason || reason,
  }, source, snapshot, { asOf: state.asOf, derivedFrom });
}

async function fetchText(url, fetchImpl, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json,text/csv,text/plain", "User-Agent": "Globe-Energy-LNG-Refresh/1.0" },
      signal: controller.signal,
    });
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTextWithRetry(url, fetchImpl, { retries = 2, backoffMs = 20_000, timeoutMs = 10_000 } = {}) {
  let attempt = 0;
  for (;;) {
    const result = await fetchText(url, fetchImpl, timeoutMs);
    if (result.response.status !== 429 || attempt >= retries) return result;
    attempt += 1;
    await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
  }
}

function parseJsonOrThrow(text, source) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${source.id}: response is not valid JSON (${error.message})`);
  }
}

function rowEntityIds(row) {
  if (Array.isArray(row?.entityIds)) return row.entityIds;
  if (typeof row?.entityId === "string") return [row.entityId];
  if (typeof row?.entity === "string") return [row.entity];
  return [];
}

function rowMetric(row) {
  return row?.metric || row?.metricId || row?.measure || row?.indicator || row?.measureId || null;
}

function rowIdentifier(row, idKey) {
  return row?.[idKey] || row?.[`${idKey}_id`] || row?.[idKey.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)] || null;
}

function keepSelectedRow(row, selection, { idKey, idValue, requireId = false }) {
  const rowId = rowIdentifier(row, idKey);
  if (idValue && rowId !== idValue) return false;
  if (requireId && !rowId) return false;
  const entityIds = rowEntityIds(row);
  if (selection.entityId && entityIds.length && !entityIds.includes(selection.entityId)) return false;
  const metric = rowMetric(row);
  if (selection.metric && metric !== selection.metric) return false;
  return true;
}

function filterPeriodRows(rows, source, { from = null, to = null } = {}) {
  if (!from && !to) return rows;
  const startLimit = parseDateOnly(from) || "0000-01-01";
  const endLimit = parseDateOnly(to) || "9999-12-31";
  return rows.filter((row) => {
    const period = observationPeriod(row, source);
    if (!period.start && !period.end) return false;
    return (period.end || period.start) >= startLimit && (period.start || period.end) <= endLimit;
  });
}

function eiaRowSeriesId(row) {
  return row?.seriesId || row?.series_id || row?.series || row?.seriesID || null;
}

function eiaValue(row, selection) {
  if (row?.value !== undefined) return row.value;
  if (selection.metric && row?.[selection.metric] !== undefined) return row[selection.metric];
  const valueKey = Object.keys(row || {}).find((key) => /value|quantity|volume|production|export/i.test(key) && !/units?$/i.test(key));
  return valueKey ? row[valueKey] : undefined;
}

export function parseEiaRecords(payload, source, options = {}) {
  const rows = payload?.response?.data || payload?.data || payload?.observations || [];
  if (!Array.isArray(rows)) throw new Error("EIA response data must be an array");
  const selection = sourceSelection(source);
  const seriesId = selectorValue(selection, "seriesId", "seriesIdEnv");
  if (!seriesId) throw new Error(`${source.id}: EIA series selector is not configured`);
  const explicitSeriesIds = rows.map(eiaRowSeriesId).filter(Boolean);
  const responseSeriesId = payload?.response?.seriesId || payload?.response?.series_id || payload?.seriesId || payload?.series_id;
  if (explicitSeriesIds.length > 0 && explicitSeriesIds.some((id) => id !== seriesId)) {
    if (!explicitSeriesIds.includes(seriesId)) throw new Error(`${source.id}: response contains the wrong EIA series; expected ${seriesId}`);
  } else if (!explicitSeriesIds.length && responseSeriesId && responseSeriesId !== seriesId) {
    throw new Error(`${source.id}: response series ${responseSeriesId} does not match configured EIA series ${seriesId}`);
  } else if (!explicitSeriesIds.length && !responseSeriesId && rows.length) {
    throw new Error(`${source.id}: EIA response does not identify configured series ${seriesId}`);
  }
  const selected = rows.filter((row) => keepSelectedRow(row, selection, { idKey: "seriesId", idValue: seriesId, requireId: explicitSeriesIds.length > 0 }));
  if (!selected.length) throw new Error(`${source.id}: response contains no selected series/entity rows`);
  const ranged = filterPeriodRows(selected, source, options);
  if (!ranged.length) throw new Error(`${source.id}: selected EIA series has no observations in the requested period`);
  return ranged.map((row) => ({
    label: row.seriesDescription || row.description || selection.metric || "EIA energy observation",
    entityIds: rowEntityIds(row).length ? rowEntityIds(row) : policyForSource(source).entityIds,
    value: Number(eiaValue(row, selection)),
    unit: row.unit || row.unitOfMeasure || row[`${selection.metric || "value"}-units`] || "",
    period: row.period || row.date,
    observedAt: row.observedAt || row.period,
    metric: rowMetric(row),
    observationKind: source.observationKind || policyForSource(source).observationKind || "flow",
  }));
}

export function parseRouteRecords(payload, source, options = {}) {
  const rows = payload?.data || payload?.observations || payload?.records || payload;
  if (!Array.isArray(rows)) throw new Error("route response records must be an array");
  const selection = sourceSelection(source);
  const routeId = selectorValue(selection, "routeId", "routeIdEnv");
  if (!routeId) throw new Error(`${source.id}: PortWatch route selector is not configured`);
  const responseRouteId = payload?.routeId || payload?.route_id || payload?.route;
  if (responseRouteId && responseRouteId !== routeId) throw new Error(`${source.id}: response route ${responseRouteId} does not match configured route ${routeId}`);
  const selected = rows.filter((row) => keepSelectedRow(row, selection, { idKey: "routeId", idValue: routeId, requireId: true }));
  if (!selected.length) throw new Error(`${source.id}: response contains no selected route/entity rows`);
  const ranged = filterPeriodRows(selected, source, options);
  if (!ranged.length) throw new Error(`${source.id}: selected PortWatch route has no observations in the requested period`);
  return ranged.map((row) => ({
    label: row.label || row.name || selection.metric || "Hormuz route observation",
    entityIds: rowEntityIds(row).length ? rowEntityIds(row) : [selection.entityId],
    value: row.value ?? row.transits ?? row.count,
    low: row.low,
    high: row.high,
    unit: row.unit || "LNG transits",
    observationDate: row.observationDate || row.date || row.period,
    observedAt: row.observedAt || row.date,
    metric: rowMetric(row),
    observationKind: source.observationKind || "transit",
  }));
}

function comtradeRows(payload) {
  return payload?.data || payload?.results || payload?.records || payload?.dataset || payload;
}

function fieldValue(row, keys) {
  for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  return undefined;
}

function codeMatches(actual, expected) {
  if (expected === undefined || expected === null || expected === "") return true;
  return String(actual ?? "") === String(expected);
}

export function parseComtradeRecords(payload, source, options = {}) {
  const rows = comtradeRows(payload);
  if (!Array.isArray(rows)) throw new Error("UN Comtrade response records must be an array");
  const selection = sourceSelection(source);
  const selected = rows.filter((row) => (
    codeMatches(fieldValue(row, ["reporterCode", "reporter", "reporterISO", "reporterIso"]), selection.reporterCode)
      && codeMatches(fieldValue(row, ["partnerCode", "partner", "partnerISO", "partnerIso"]), selection.partnerCode)
      && codeMatches(fieldValue(row, ["flowCode", "flow", "flowDesc"]), selection.flowCode)
      && codeMatches(fieldValue(row, ["cmdCode", "commodityCode", "commodity"]), selection.commodityCode)
  ));
  if (!selected.length) throw new Error(`${source.id}: response contains no selected reporter/partner/flow/commodity rows`);
  const ranged = filterPeriodRows(selected, source, options);
  if (!ranged.length) throw new Error(`${source.id}: selected trade series has no observations in the requested period`);
  return ranged.map((row) => {
    const period = fieldValue(row, [selection.periodField || "period", "periodDesc", "date"]);
    const bounds = periodBounds(period, source.cadence);
    const primaryValue = Number(fieldValue(row, ["primaryValue", "primary_value", "tradeValue", "trade_value", "value"]));
    const quantity = fieldValue(row, ["netWgt", "netWeight", "qty", "quantity"]);
    const unit = fieldValue(row, ["primaryValueUnit", "primaryValueUnitAbbr"]) || "USD";
    return {
      label: `${fieldValue(row, ["cmdDesc", "commodityDescription"]) || selection.commodityCode} monthly trade-demand context`,
      entityIds: rowEntityIds(row).length ? rowEntityIds(row) : policyForSource(source).entityIds,
      value: primaryValue,
      ...(quantity !== undefined ? { aliases: [`quantity:${quantity}${fieldValue(row, ["netWgtUnit", "qtyUnitAbbr", "quantityUnit"]) || ""}`] } : {}),
      unit,
      observationDate: bounds.end,
      periodStart: bounds.start,
      periodEnd: bounds.end,
      observedAt: row.observedAt || bounds.end,
      observationKind: "trade-demand",
      coverageStatus: "public-proxy",
      coverageNote: "UN Comtrade monthly customs trade context; it is not cargo-level movement or a live vessel observation.",
      provider: row.provider || source.provider,
    };
  });
}

export function resolveStableEntityId(record, aliases = {}) {
  const candidates = [
    record?.stableEntityId,
    record?.entityId,
    record?.id,
    record?.alias,
    record?.code,
    record?.locode,
    record?.unlocode,
    record?.assetCode,
    record?.name,
  ].filter(Boolean).map((value) => String(value));
  for (const candidate of candidates) {
    if (aliases[candidate]) return aliases[candidate];
    const normalized = candidate.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (aliases[normalized]) return aliases[normalized];
  }
  return record?.stableEntityId || record?.entityId || null;
}

export function parseAssetRegistryRecords(payload, source) {
  const rows = payload?.assets || payload?.data || payload?.records || payload;
  if (!Array.isArray(rows)) throw new Error("asset registry response records must be an array");
  const selection = sourceSelection(source);
  const aliases = source.entityAliases || {};
  const selected = rows.filter((row) => {
    const namespace = row.namespace || row.source || row.registry || selection.assetNamespace;
    if (selection.assetNamespace && namespace && String(namespace).toLowerCase() !== String(selection.assetNamespace).toLowerCase()) return false;
    const stableId = resolveStableEntityId(row, aliases);
    const configuredCode = selectorValue(selection, "assetCode", "assetCodeEnv");
    if (configuredCode && stableId !== configuredCode && row.code !== configuredCode && row.locode !== configuredCode && row.unlocode !== configuredCode) return false;
    if (selection.entityId && stableId && stableId !== selection.entityId) return false;
    return true;
  });
  if (!selected.length) throw new Error(`${source.id}: asset registry contains no selected stable entity`);
  return selected.map((row) => {
    const entityId = resolveStableEntityId(row, aliases) || selection.entityId;
    const field = selection.assetField;
    const rawValue = field === "capacity"
      ? fieldValue(row, ["capacity", "exportCapacity", "importCapacity", "capacityMTPA"])
      : field === "status"
        ? fieldValue(row, ["status", "projectStatus", "operatingStatus"])
        : fieldValue(row, ["value", "name"]);
    const isNumeric = rawValue !== undefined && rawValue !== null && rawValue !== "" && Number.isFinite(Number(rawValue));
    return {
      label: row.name || row.assetName || source.title,
      entityIds: entityId ? [entityId] : policyForSource(source).entityIds,
      aliases: [row.locode, row.unlocode, row.code, row.alias, row.name].filter(Boolean),
      ...(isNumeric ? { value: Number(rawValue) } : { value: rawValue }),
      unit: field === "capacity" ? (row.unit || "MTPA") : (row.unit || ""),
      observationDate: row.observationDate || row.updatedAt || row.asOf || row.date,
      observedAt: row.observedAt || row.updatedAt || row.asOf || row.date,
      observationKind: field === "capacity" ? "capacity" : field === "status" || field === "identity" ? "asset-status" : "flow",
      coverageStatus: "direct-observation",
      sourceUrl: row.sourceUrl || source.url,
    };
  });
}

function redactUrlSecrets(url) {
  if (typeof url !== "string" || !url) return url;
  return url
    .replace(/(subscription[-_]?key|api[_-]?key|apikey|token|access[_-]?key)=([^&]*)/gi, (_match, param) => `${param}=%REDACTED%`)
    .replace(/(subscription[-_]?key|api[_-]?key|apikey|token|access[_-]?key)\/([^/?&]+)/gi, (_match, param) => `${param}/%REDACTED%`);
}

function snapshotFor(source, retrievedAt, {
  status = "skipped",
  httpStatus = null,
  contentType = null,
  content = null,
  observedAt = null,
  url = source.url,
  error,
} = {}) {
  const contentHash = content === null ? null : sha256(content);
  const id = `energy-snapshot:${slug(source.id)}:${contentHash ? contentHash.slice(0, 16) : sha256({ sourceId: source.id, status, error: error || null }).slice(0, 16)}`;
  const artifactPath = content === null ? undefined : path.join("src/data/energy-lng-snapshots", `${id}.json`);
  return {
    id,
    sourceId: source.id,
    provider: source.provider,
    url: redactUrlSecrets(url),
    retrievedAt,
    observedAt: observedAt ? isoOrNull(observedAt) : null,
    httpStatus,
    contentType,
    contentHash,
    parserVersion: source.parserVersion,
    status,
    canonicalUrl: source.url,
    evidenceId: `machine-evidence:${id}`,
    recordKeys: [],
    ...(content !== null ? {
      rawSnapshotRef: `raw-snapshot:${id}`,
      artifactPath,
    } : {}),
    ...(error ? { error } : {}),
    lineageRef: `snapshot:${id}`,
  };
}

function persistRawSnapshot(snapshot, content, dryRun = false) {
  if (content === null || content === undefined || !snapshot.artifactPath || dryRun) return;
  const file = path.join(ROOT, snapshot.artifactPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, content);
  const actualHash = sha256(fs.readFileSync(file, "utf8"));
  if (actualHash !== snapshot.contentHash) throw new Error(`${snapshot.sourceId}: persisted raw snapshot hash does not match metadata`);
}

function parseSnapshotRecords(source, snapshot, content, parser, dryRun = false) {
  persistRawSnapshot(snapshot, content, dryRun);
  try {
    return parser();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    snapshot.status = "failed";
    snapshot.error = message;
    const wrapped = new Error(message);
    wrapped.snapshot = snapshot;
    throw wrapped;
  }
}

function addQuery(url, params) {
  const next = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") next.searchParams.set(key, String(value));
  }
  return next.toString();
}

function eiaEndpoint(source, selection, { from = null, to = null } = {}) {
  const seriesId = selectorValue(selection, "seriesId", "seriesIdEnv");
  const configured = process.env.EIA_DATA_URL || source.url;
  let url = configured.replace("{seriesId}", encodeURIComponent(seriesId));
  if (/\/seriesid\/?$/i.test(url)) url = `${url.replace(/\/$/, "")}/${encodeURIComponent(seriesId)}`;
  const apiKey = process.env.EIA_API_KEY;
  return addQuery(url, {
    api_key: apiKey,
    series_id: /\/seriesid\//i.test(url) ? undefined : seriesId,
    start: from,
    end: to,
  });
}

function approvedPortWatchEndpoint(source, selection) {
  const envKey = selection.endpointEnv || source.approvedEndpointEnv || "PORTWATCH_DATA_URL";
  const endpoint = process.env[envKey];
  if (!endpoint) throw new Error(`${source.id}: ${envKey} is required for the approved machine-readable PortWatch connector`);
  if (!/^https:\/\//.test(endpoint) || /\/pages\//i.test(endpoint) || /methodology/i.test(endpoint)) {
    throw new Error(`${source.id}: PortWatch endpoint must be an approved HTTPS machine-readable endpoint, not a methodology page`);
  }
  return endpoint;
}

function portWatchEndpoint(source, selection, { from = null, to = null } = {}) {
  return addQuery(approvedPortWatchEndpoint(source, selection), {
    routeId: selectorValue(selection, "routeId", "routeIdEnv"),
    metric: selection.metric,
    from,
    to,
  });
}

function comtradeEndpoint(source, selection, { from = null, to = null } = {}, overridePeriod = null) {
  const endpoint = process.env.COMTRADE_DATA_URL || source.url;
  const periods = overridePeriod ?? (from && to && selection.frequency === "A" ? `${from.slice(0, 4)},${to.slice(0, 4)}` : from && to ? `${from.slice(0, 7).replace("-", "")},${to.slice(0, 7).replace("-", "")}` : from || to);
  return addQuery(endpoint, {
    subscription_key: process.env.COMTRADE_API_KEY,
    typeCode: selection.typeCode || "C",
    freqCode: selection.frequency || (source.cadence === "annual" ? "A" : "M"),
    clCode: selection.classificationCode,
    period: periods,
    reporterCode: selection.reporterCode,
    cmdCode: selection.commodityCode,
    flowCode: selection.flowCode,
    partnerCode: selection.partnerCode,
    includeDesc: "true",
  });
}

function assetRegistryEndpoint(source, selection, { from = null, to = null } = {}) {
  const endpointEnv = selection.endpointEnv || source.approvedEndpointEnv || "ASSET_REGISTRY_DATA_URL";
  const endpoint = process.env[endpointEnv];
  if (!endpoint) throw new Error(`${source.id}: ${endpointEnv} is required for the asset registry connector`);
  if (!/^https:\/\//.test(endpoint)) throw new Error(`${source.id}: asset registry endpoint must use https`);
  return addQuery(endpoint, {
    namespace: selection.assetNamespace,
    code: selectorValue(selection, "assetCode", "assetCodeEnv"),
    from,
    to,
  });
}

async function fetchAutomatedSource(source, {
  fetchImpl,
  retrievedAt,
  offline,
  fixture,
  from = null,
  to = null,
  dryRun = false,
}) {
  const fixtureRows = fixture?.sources?.[source.id];
  if (fixtureRows) {
    const content = JSON.stringify(fixtureRows);
    const selection = sourceSelection(source);
    const snapshot = snapshotFor(source, retrievedAt, {
      status: "fetched",
      httpStatus: 200,
      contentType: "application/json",
      content,
      observedAt: fixtureRows[0]?.observedAt || fixtureRows[0]?.observationDate,
    });
    const records = parseSnapshotRecords(source, snapshot, content, () => {
      if (selection.type === "eia-series") return parseEiaRecords({ data: fixtureRows }, source, { from, to });
      if (selection.type === "portwatch-route") return parseRouteRecords(fixtureRows, source, { from, to });
      if (selection.type === "comtrade-trade") return parseComtradeRecords(fixtureRows, source, { from, to });
      if (selection.type === "asset-registry") return parseAssetRegistryRecords(fixtureRows, source, { from, to });
      return fixtureRows;
    }, dryRun);
    return { snapshot, records };
  }
  if (offline) {
    return {
      snapshot: snapshotFor(source, retrievedAt, { error: "Offline refresh requested" }),
      records: [],
    };
  }

  if (source.id === "src-yahoo-ttf") {
    const quote = await fetchQuote({ symbol: "TTF=F", stooq: null });
    if (quote.error) throw new Error(quote.error);
    const raw = {
      label: "Dutch TTF",
      entityIds: ["ttf"],
      value: quote.price,
      change: quote.change,
      changePct: quote.changePct,
      unit: "EUR/MWh",
      sourceDate: quote.sourceDate,
      observedAt: quote.observedAt,
      provider: quote.source,
    };
    const content = JSON.stringify(raw);
    const snapshot = snapshotFor(source, retrievedAt, {
        status: "fetched",
        httpStatus: 200,
        contentType: "application/json",
        content,
        observedAt: quote.observedAt,
        url: source.url,
      });
    persistRawSnapshot(snapshot, content, dryRun);
    return { snapshot, records: [raw] };
  }

  const selection = sourceSelection(source);
  if (selection.type === "eia-series") {
    if (!process.env.EIA_API_KEY && !process.env.EIA_DATA_URL) throw new Error("EIA_API_KEY or EIA_DATA_URL is required for the EIA connector");
    const url = eiaEndpoint(source, selection, { from, to });
    const { response, text } = await fetchText(url, fetchImpl);
    if (!response.ok) throw new Error(`EIA ${response.status}`);
    const snapshot = snapshotFor(source, retrievedAt, {
        status: "fetched",
        httpStatus: response.status,
        contentType: response.headers?.get?.("content-type") || "application/json",
        content: text,
        url,
      });
    const records = parseSnapshotRecords(source, snapshot, text, () => parseEiaRecords(parseJsonOrThrow(text, source), source, { from, to }), dryRun);
    return { snapshot, records };
  }

  if (selection.type === "portwatch-route") {
    const url = portWatchEndpoint(source, selection, { from, to });
    const { response, text } = await fetchText(url, fetchImpl);
    if (!response.ok) throw new Error(`PortWatch ${response.status}`);
    const snapshot = snapshotFor(source, retrievedAt, {
        status: "fetched",
        httpStatus: response.status,
        contentType: response.headers?.get?.("content-type") || "application/json",
        content: text,
        url,
      });
    const records = parseSnapshotRecords(source, snapshot, text, () => parseRouteRecords(parseJsonOrThrow(text, source), source, { from, to }), dryRun);
    return { snapshot, records };
  }

  if (selection.type === "comtrade-trade") {
    let url = comtradeEndpoint(source, selection, { from, to });
    let { response, text } = await fetchTextWithRetry(url, fetchImpl);
    if (!response.ok) throw new Error(`UN Comtrade ${response.status}`);
    // Monthly feeds publish with a lag; when the default latest-month request
    // returns no rows and no explicit window was requested, walk back up to 12
    // months to find the newest published period instead of failing over.
    const parsedProbe = (() => { try { return parseJsonOrThrow(text, source); } catch { return null; } })();
    const probeRows = comtradeRows(parsedProbe);
    const hasExplicitWindow = Boolean(from || to);
    if (selection.frequency !== "A" && !hasExplicitWindow && response.ok && Array.isArray(probeRows) && !probeRows.length) {
      const cursor = new Date();
      for (let step = 1; step <= 12; step += 1) {
        cursor.setUTCMonth(cursor.getUTCMonth() - 1);
        const candidatePeriod = `${cursor.getUTCFullYear()}${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
        url = comtradeEndpoint(source, selection, { from, to }, candidatePeriod);
        ({ response, text } = await fetchTextWithRetry(url, fetchImpl));
        if (!response.ok) throw new Error(`UN Comtrade ${response.status}`);
        const parsed = (() => { try { return parseJsonOrThrow(text, source); } catch { return null; } })();
        const rows = comtradeRows(parsed);
        if (Array.isArray(rows) && rows.length) break;
      }
    }
    if (!response.ok) throw new Error(`UN Comtrade ${response.status}`);
    const snapshot = snapshotFor(source, retrievedAt, {
      status: "fetched",
      httpStatus: response.status,
      contentType: response.headers?.get?.("content-type") || "application/json",
      content: text,
      url,
    });
    const records = parseSnapshotRecords(source, snapshot, text, () => parseComtradeRecords(parseJsonOrThrow(text, source), source, { from, to }), dryRun);
    return { snapshot, records };
  }

  if (selection.type === "asset-registry") {
    const url = assetRegistryEndpoint(source, selection, { from, to });
    const { response, text } = await fetchText(url, fetchImpl);
    if (!response.ok) throw new Error(`Asset registry ${response.status}`);
    const snapshot = snapshotFor(source, retrievedAt, {
      status: "fetched",
      httpStatus: response.status,
      contentType: response.headers?.get?.("content-type") || "application/json",
      content: text,
      url,
    });
    const records = parseSnapshotRecords(source, snapshot, text, () => parseAssetRegistryRecords(parseJsonOrThrow(text, source), source), dryRun);
    return { snapshot, records };
  }

  throw new Error(`No connector is configured for ${source.id}`);
}

function fallbackForSource(source, snapshot, state, exposure, error) {
  const policy = policyForSource(source);
  const reason = `Machine refresh ${error ? `failed: ${error}. ` : "returned no usable record. "}${source.fallback === "carry" || source.fallback === "preserve-reviewed" ? "Previous approved observation carried with its original observation date." : "No approved observation is available."}`;
  if (source.fallback === "carry" || source.fallback === "preserve-reviewed") {
    return [carryCandidate(source, snapshot, state, exposure, reason)];
  }
  const existing = source.targetInputIds?.map((inputId) => findStateInput(state, inputId)).find(Boolean);
  return [unavailableCandidate(source, snapshot, reason, {
    entityIds: policy.entityIds,
    evidenceIds: source.evidenceIds,
    unit: policy.allowedUnits?.[0] ?? null,
    cadence: existing?.cadence || policy.cadence,
    freshnessWindowDays: existing?.maxAgeDays || policy.maxAgeDays,
    label: existing?.label || source.title,
  })];
}

function sourceFixture(fixtureName) {
  if (!fixtureName) return null;
  const file = path.isAbsolute(fixtureName)
    ? fixtureName
    : path.join(ROOT, "scripts/fixtures/energy-lng", `${fixtureName}.json`);
  if (!fs.existsSync(file)) throw new Error(`Energy/LNG fixture not found: ${file}`);
  return readJson(file);
}

export function deduplicateCandidates(candidates) {
  const byKey = new Map();
  const duplicates = [];
  for (const candidate of candidates) {
    const key = candidate.recordKey || candidate.id;
    if (byKey.has(key)) duplicates.push({ key, id: candidate.id });
    else byKey.set(key, candidate);
  }
  return { candidates: [...byKey.values()], duplicates };
}

function candidatePeriod(candidate) {
  return {
    start: candidate.periodStart || candidate.observationDate || null,
    end: candidate.periodEnd || candidate.observationDate || null,
  };
}

function candidateTargetKey(candidate) {
  const targets = [...(candidate.targetInputIds || []), ...(candidate.targetCommercialInputIds || [])].sort();
  const entities = [...(candidate.entityIds || [])].sort();
  const period = candidatePeriod(candidate);
  return `${targets.join(",") || entities.join(",")}:${candidate.observationKind || "flow"}:${period.start || "unavailable"}:${period.end || "unavailable"}:${candidate.unit || ""}`;
}

export function buildSourceCoverage(source, snapshots, candidates, { from = null, to = null } = {}) {
  const sourceCandidates = candidates.filter((candidate) => candidate.sourceId === source.id);
  const snapshot = snapshots.find((item) => item.sourceId === source.id);
  const observed = sourceCandidates
    .map(candidatePeriod)
    .filter((period) => period.start && period.end)
    .sort((left, right) => left.start.localeCompare(right.start));
  const observedPeriod = observed.length
    ? { start: observed[0].start, end: observed[observed.length - 1].end }
    : null;
  const sourcePeriod = observedPeriod || (from && to ? { start: from, end: to } : null);
  const expectedCadence = source.cadence;
  const expected = sourcePeriod ? expectedPeriods(sourcePeriod.start, sourcePeriod.end, expectedCadence) : [];
  const observedKeys = new Set(observed.map((period) => periodKey(period.start, period.end)));
  const missingPeriods = expected.filter((period) => !observedKeys.has(period));
  const usable = sourceCandidates.filter((candidate) => candidate.status !== "unavailable");
  let status = "direct-observation";
  if (!usable.length || snapshot?.status === "failed" || snapshot?.status === "skipped") status = "unavailable";
  else if (source.category === "trade-demand" || sourceCandidates.some((candidate) => candidate.coverage?.status === "public-proxy")) status = "public-proxy";
  else if (missingPeriods.length || sourceCandidates.some((candidate) => candidate.coverage?.status === "partial-coverage")) status = "partial-coverage";
  return {
    status,
    sourcePeriod,
    expectedCadence,
    observedPeriod,
    missingPeriods,
    sourceStatus: snapshot?.status || "skipped",
    ...(source.category === "trade-demand" ? { note: "Monthly or annual customs trade context is not cargo-level movement." } : {}),
  };
}

function candidateStatusPriority(status) {
  return status === "confirmed" ? 3 : status === "carried" ? 2 : 1;
}

export function reconcileCandidates(candidates, sources) {
  const sourceById = new Map((sources || []).map((source) => [source.id, source]));
  const groups = new Map();
  for (const candidate of candidates) {
    const key = candidateTargetKey(candidate);
    const group = groups.get(key) || [];
    group.push(candidate);
    groups.set(key, group);
  }
  const reconciliations = [];
  const nextCandidates = candidates.map((candidate) => ({ ...candidate }));
  const byRecordKey = new Map(nextCandidates.map((candidate) => [candidate.recordKey, candidate]));
  for (const [targetKey, group] of groups) {
    if (group.length < 2) {
      if (group[0]) group[0].selectedForAssessment = true;
      continue;
    }
    const ranked = [...group].sort((left, right) => {
      const statusDelta = candidateStatusPriority(right.status) - candidateStatusPriority(left.status);
      if (statusDelta) return statusDelta;
      const priorityDelta = Number(sourceById.get(right.sourceId)?.reconciliationPriority || 0) - Number(sourceById.get(left.sourceId)?.reconciliationPriority || 0);
      if (priorityDelta) return priorityDelta;
      return String(right.observationDate || "").localeCompare(String(left.observationDate || "")) || left.sourceId.localeCompare(right.sourceId);
    });
    const selected = ranked.find((candidate) => candidate.status !== "unavailable") || null;
    const reconciliationId = `reconciliation:${sha256({ targetKey, recordKeys: group.map((candidate) => candidate.recordKey).sort() }).slice(0, 24)}`;
    const values = new Set(group.filter((candidate) => candidate.value !== undefined).map((candidate) => JSON.stringify(candidate.value)));
    const status = selected ? "resolved" : "unresolved";
    const basis = selected
      ? ranked.some((candidate) => Number(sourceById.get(candidate.sourceId)?.reconciliationPriority || 0) !== Number(sourceById.get(selected.sourceId)?.reconciliationPriority || 0))
        ? "highest-priority-confirmed"
        : "latest-confirmed"
      : "preserved-unavailable";
    const note = values.size > 1
      ? "Sources disagree for the same physical-flow period; all inputs are preserved and the selected assessment basis is explicit."
      : "Multiple source observations are preserved for the same physical-flow period; the selected assessment basis is explicit.";
    reconciliations.push({
      id: reconciliationId,
      targetKey,
      candidateRecordKeys: group.map((candidate) => candidate.recordKey).sort(),
      sourceIds: [...new Set(group.map((candidate) => candidate.sourceId))].sort(),
      selectedRecordKey: selected?.recordKey || null,
      status,
      basis,
      note,
    });
    for (const candidate of group) {
      const next = byRecordKey.get(candidate.recordKey);
      if (!next) continue;
      next.reconciliationId = reconciliationId;
      next.selectedForAssessment = Boolean(selected && next.recordKey === selected.recordKey);
    }
  }
  return { candidates: nextCandidates, reconciliations };
}

export function computeEnergyRefreshFingerprint({ state, exposure, registry }) {
  const sourceConfig = (registry?.sources ?? []).map((source) => ({
    ...source,
    selectionRuntime: {
      seriesId: source.selection?.seriesIdEnv ? process.env[source.selection.seriesIdEnv] ?? null : undefined,
      routeId: source.selection?.routeIdEnv ? process.env[source.selection.routeIdEnv] ?? null : undefined,
    },
  }));
  return sha256({
    asOf: state?.asOf,
    state,
    exposure: refreshFingerprintExposure(exposure),
    registry: {
      schemaVersion: registry?.schemaVersion,
      sources: sourceConfig,
    },
  });
}

function attachSnapshotRecords(snapshots, candidates) {
  const recordKeysBySnapshot = new Map(snapshots.map((snapshot) => [snapshotRef(snapshot), new Set()]));
  for (const candidate of candidates) {
    const keys = recordKeysBySnapshot.get(candidate.lineage?.snapshotRef);
    if (keys) keys.add(candidate.recordKey);
  }
  for (const snapshot of snapshots) {
    snapshot.recordKeys = [...(recordKeysBySnapshot.get(snapshotRef(snapshot)) || [])].sort();
  }
}

function buildMachineEvidence(snapshots, candidates) {
  return snapshots
    .filter((snapshot) => snapshot.status === "fetched" && snapshot.contentHash && snapshot.recordKeys.length)
    .map((snapshot) => {
      const records = candidates.filter((candidate) => candidate.lineage?.snapshotRef === snapshotRef(snapshot));
      return {
        id: snapshot.evidenceId,
        sourceId: snapshot.sourceId,
        provider: snapshot.provider,
        url: snapshot.url,
        snapshotRef: snapshotRef(snapshot),
        retrievedAt: snapshot.retrievedAt,
        observedAt: snapshot.observedAt,
        contentHash: snapshot.contentHash,
        parserVersion: snapshot.parserVersion,
        recordKeys: [...snapshot.recordKeys],
        targetInputIds: [...new Set(records.flatMap((candidate) => candidate.targetInputIds || []))],
        targetCommercialInputIds: [...new Set(records.flatMap((candidate) => candidate.targetCommercialInputIds || []))],
        observationKind: records[0]?.observationKind,
        coverage: records[0]?.coverage,
        status: "validated",
      };
    });
}

function knownInputIds(state, exposure) {
  return new Set([
    ...Object.keys(state.traceInputs?.metrics || {}),
    ...(exposure.commercialInputs || []).map((input) => input.inputId),
    ...Object.keys(state.commercialInputs || {}),
  ]);
}

function knownEntityIds(exposure) {
  return new Set((exposure.entities || []).map((entity) => entity.id));
}

function knownEvidenceIds(exposure) {
  return new Set((exposure.evidence || []).map((evidence) => evidence.id));
}

export function validateNormalizedCandidates({
  candidates,
  sources,
  state,
  exposure,
  asOf,
  snapshots = [],
  machineEvidence = [],
  allowHistorical = false,
}) {
  const errors = [];
  const warnings = [];
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const entityIds = knownEntityIds(exposure);
  const inputIds = knownInputIds(state, exposure);
  const evidenceIds = knownEvidenceIds(exposure);
  const evidenceById = new Map((exposure.evidence || []).map((evidence) => [evidence.id, evidence]));
  const snapshotByRef = new Map(snapshots.map((snapshot) => [snapshotRef(snapshot), snapshot]));
  const machineEvidenceById = new Map(machineEvidence.map((item) => [item.id, item]));
  const ids = new Set();
  const recordKeys = new Set();
  const targetKeys = new Set();

  for (const candidate of candidates) {
    const context = `candidate ${candidate?.id ?? "?"}`;
    if (!candidate?.id) errors.push(`${context} id is required`);
    if (ids.has(candidate?.id)) errors.push(`${context} is duplicated`);
    ids.add(candidate?.id);
    if (!candidate?.recordKey || !SHA256.test(candidate.recordKey)) errors.push(`${context}.recordKey must be a sha256 hash`);
    if (recordKeys.has(candidate?.recordKey)) errors.push(`${context}.recordKey is duplicated`);
    recordKeys.add(candidate?.recordKey);
    if (!candidate?.sourceId || !sourceById.has(candidate.sourceId)) errors.push(`${context} references unknown source ${candidate?.sourceId}`);
    const source = sourceById.get(candidate?.sourceId);
    if (source && !source.enabled) errors.push(`${context} references disabled source ${source.id}`);
    if (!/^https:\/\//.test(candidate?.sourceUrl ?? "")) errors.push(`${context}.sourceUrl must use https`);
    if (!candidate?.provider) errors.push(`${context}.provider is required`);
    if (!Array.isArray(candidate?.entityIds) || candidate.entityIds.length === 0) errors.push(`${context}.entityIds is required`);
    for (const entityId of candidate?.entityIds || []) {
      if (!entityIds.has(entityId)) errors.push(`${context} references unknown entity ${entityId}`);
    }
    for (const inputId of [...(candidate?.targetInputIds || []), ...(candidate?.targetCommercialInputIds || [])]) {
      if (!inputIds.has(inputId)) errors.push(`${context} references unknown input ${inputId}`);
    }
    if (source) {
      const expectedTargets = sourceTargets(source);
      if (!sameSet(candidate.targetInputIds, expectedTargets.targetInputIds)) {
        errors.push(`${context}.targetInputIds do not match registered source ${source.id}`);
      }
      if (!sameSet(candidate.targetCommercialInputIds, expectedTargets.targetCommercialInputIds)) {
        errors.push(`${context}.targetCommercialInputIds do not match registered source ${source.id}`);
      }
      const expectedEntities = policyForSource(source).entityIds;
      if (!sameSet(candidate.entityIds, expectedEntities)) {
        errors.push(`${context}.entityIds do not match the target policy for ${source.id}`);
      }
      const expectedRecordKey = stableRecordKey({
        sourceId: candidate.sourceId,
        entityIds: candidate.entityIds,
        targetInputIds: candidate.targetInputIds,
        targetCommercialInputIds: candidate.targetCommercialInputIds,
        observationDate: candidate.observationDate,
        unit: candidate.unit,
        observationKind: candidate.observationKind,
        periodStart: candidate.periodStart,
        periodEnd: candidate.periodEnd,
      });
      if (candidate.recordKey !== expectedRecordKey) errors.push(`${context}.recordKey does not match normalized fields`);
      const expectedEvidenceIds = source.evidenceIds || [];
      if (!sameSet(candidate.evidenceIds, expectedEvidenceIds)) {
        errors.push(`${context}.evidenceIds do not match registered source ${source.id}`);
      }
      const targetPolicy = policyForSource(source);
      if (candidate.cadence !== targetPolicy.cadence) errors.push(`${context}.cadence does not match target publication policy`);
      if (Number(candidate.freshnessWindowDays) !== Number(targetPolicy.maxAgeDays)) {
        errors.push(`${context}.freshnessWindowDays does not match target publication policy`);
      }
      for (const target of [...(candidate.targetInputIds || []), ...(candidate.targetCommercialInputIds || [])]) {
        const targetKey = `${candidate.sourceId}:${target}:${candidate.observationKind ?? "flow"}:${candidate.periodStart ?? candidate.observationDate ?? "unavailable"}:${candidate.periodEnd ?? candidate.observationDate ?? "unavailable"}:${candidate.unit ?? ""}`;
        if (targetKeys.has(targetKey)) errors.push(`${context} duplicates target observation ${targetKey}`);
        targetKeys.add(targetKey);
      }
      const derivedEvidenceUrls = (candidate.lineage?.derivedFrom || [])
        .map((id) => evidenceById.get(id)?.url)
        .filter(Boolean);
      if (candidate.sourceUrl !== source.url && !derivedEvidenceUrls.includes(candidate.sourceUrl)) {
        errors.push(`${context}.sourceUrl does not match registered source or derived evidence ${source.id}`);
      }
      const currentSources = [...(candidate.targetInputIds || []), ...(candidate.targetCommercialInputIds || [])]
        .map((inputId) => findStateInput(state, inputId)?.source)
        .filter(Boolean);
      const providerMatches = candidate.provider === source.provider
        || candidate.provider.startsWith(`${source.provider} `)
        || (candidate.status === "carried" && currentSources.includes(candidate.provider));
      if (!providerMatches) {
        errors.push(`${context}.provider does not match registered or carried source ${source.id}`);
      }
      if (Number(candidate.freshnessWindowDays) <= 0) errors.push(`${context}.freshnessWindowDays must be positive`);
      if (targetPolicy.allowedUnits.length && candidate.unit !== null && !unitAllowed(candidate.unit, targetPolicy.allowedUnits)) {
        errors.push(`${context}.unit ${candidate.unit} is not allowed by target policy ${source.id}`);
      }
      if (source.automation === "manual-only" && candidate.status === "confirmed") {
        errors.push(`${context} cannot promote a newly confirmed record from manual-only source ${source.id}`);
      }
      for (const evidenceId of candidate.evidenceIds || []) {
        if (!evidenceIds.has(evidenceId)) errors.push(`${context} references unknown evidence ${evidenceId}`);
      }
      if (source.automation === "automated" && candidate.status === "confirmed" && !candidate.machineEvidenceIds?.length) {
        errors.push(`${context} confirmed automated records require machine snapshot evidence`);
      }
    }
    if (!Array.isArray(candidate?.machineEvidenceIds)) errors.push(`${context}.machineEvidenceIds is required`);
    for (const evidenceId of candidate?.machineEvidenceIds || []) {
      if (!machineEvidenceById.has(evidenceId)) errors.push(`${context} references unknown machine evidence ${evidenceId}`);
    }
    if (candidate?.status !== "confirmed" && (candidate?.machineEvidenceIds || []).length) {
      errors.push(`${context} carried or unavailable records must not claim machine snapshot evidence`);
    }
    if (!candidate?.lineage?.snapshotRef) errors.push(`${context}.lineage.snapshotRef is required`);
    if (candidate?.lineage?.snapshotHash && !SHA256.test(candidate.lineage.snapshotHash)) {
      errors.push(`${context}.lineage.snapshotHash must be a sha256 hash when present`);
    }
    if (!candidate?.lineage?.recordKey || candidate.lineage.recordKey !== candidate.recordKey) {
      errors.push(`${context}.lineage.recordKey must match recordKey`);
    }
    if (!["flow", "capacity", "asset-status", "transit", "trade-demand"].includes(candidate?.observationKind)) {
      errors.push(`${context}.observationKind is invalid`);
    }
    for (const periodField of ["periodStart", "periodEnd"]) {
      if (candidate?.[periodField] !== null && candidate?.[periodField] !== undefined && !DATE_ONLY.test(candidate[periodField])) {
        errors.push(`${context}.${periodField} must be YYYY-MM-DD or null`);
      }
    }
    if (candidate?.periodStart && candidate?.periodEnd && candidate.periodStart > candidate.periodEnd) {
      errors.push(`${context}.periodStart must not be after periodEnd`);
    }
    const coverage = candidate?.coverage;
    if (!coverage || !["direct-observation", "public-proxy", "partial-coverage", "unavailable"].includes(coverage.status)) {
      errors.push(`${context}.coverage status is invalid or missing`);
    } else {
      if (!coverage.expectedCadence) errors.push(`${context}.coverage.expectedCadence is required`);
      if (!Array.isArray(coverage.missingPeriods)) errors.push(`${context}.coverage.missingPeriods must be an array`);
      if (!["fetched", "failed", "skipped"].includes(coverage.sourceStatus)) errors.push(`${context}.coverage.sourceStatus is invalid`);
    }
    const candidateSnapshot = snapshotByRef.get(candidate?.lineage?.snapshotRef);
    if (!candidateSnapshot) {
      errors.push(`${context}.lineage.snapshotRef does not reference a report snapshot`);
    } else {
      if (candidateSnapshot.sourceId !== candidate.sourceId) errors.push(`${context} snapshot source does not match candidate source`);
      if (candidate.status === "confirmed") {
        if (candidateSnapshot.status !== "fetched") errors.push(`${context} confirmed records require a fetched snapshot`);
        if (candidate.lineage.snapshotHash !== candidateSnapshot.contentHash) errors.push(`${context} snapshot hash does not match report snapshot`);
        if (!candidateSnapshot.recordKeys.includes(candidate.recordKey)) errors.push(`${context} recordKey is not listed in its snapshot evidence`);
        if (!candidate.machineEvidenceIds.includes(candidateSnapshot.evidenceId)) errors.push(`${context} does not link its snapshot evidence`);
      } else if (candidate.lineage.snapshotHash && candidate.lineage.snapshotHash !== candidateSnapshot.contentHash) {
        errors.push(`${context} carried/unavailable snapshot hash does not match report snapshot`);
      }
    }
    if (!DATE_ONLY.test(candidate?.observationDate ?? "") && candidate?.observationDate !== null) {
      errors.push(`${context}.observationDate must be YYYY-MM-DD or null`);
    }
    if (!Number.isFinite(Date.parse(candidate?.retrievedAt ?? ""))) errors.push(`${context}.retrievedAt is invalid`);
    if (candidate?.observationDate && daysBetween(asOf, candidate.observationDate) < 0) {
      errors.push(`${context}.observationDate cannot be after asOf`);
    }
    const hasValue = candidate?.value !== undefined && candidate?.value !== null;
    const hasRange = typeof candidate?.low === "number" && typeof candidate?.high === "number";
    if (typeof candidate?.value === "number" && !Number.isFinite(candidate.value)) errors.push(`${context}.value must be finite`);
    if (candidate?.change !== undefined && (typeof candidate.change !== "number" || !Number.isFinite(candidate.change))) errors.push(`${context}.change must be finite when present`);
    if (candidate?.changePct !== undefined && (typeof candidate.changePct !== "number" || !Number.isFinite(candidate.changePct))) errors.push(`${context}.changePct must be finite when present`);
    if (candidate?.low !== undefined && typeof candidate.low !== "number") errors.push(`${context}.low must be numeric`);
    if (candidate?.high !== undefined && typeof candidate.high !== "number") errors.push(`${context}.high must be numeric`);
    if (candidate?.status === "unavailable") {
      if (hasValue || hasRange) errors.push(`${context} unavailable records must not contain a value or range`);
      if (!candidate?.missingReason) errors.push(`${context} unavailable records require missingReason`);
    } else {
      if (source && source.category !== "reviewed-event" && candidate.observationKind !== "asset-status" && hasValue && typeof candidate.value !== "number") {
        errors.push(`${context}.value must be numeric for ${source.category} observations`);
      }
      if (!hasValue && !hasRange) errors.push(`${context} requires value or low/high`);
      if (hasRange && candidate.low > candidate.high) errors.push(`${context}.low must not exceed high`);
      if (!candidate?.observationDate) errors.push(`${context} observed records require observationDate`);
      if (candidate?.status === "carried" && !candidate?.carryReason) errors.push(`${context} carried records require carryReason`);
      if (candidate?.status === "confirmed" && !candidate?.sourceUrl) errors.push(`${context} confirmed records require sourceUrl`);
      const age = daysBetween(asOf, candidate.observationDate);
      if (candidate?.status === "confirmed" && !allowHistorical && Number.isFinite(age) && age > Number(candidate.freshnessWindowDays)) {
        errors.push(`${context} is ${age} days old, above freshnessWindowDays ${candidate.freshnessWindowDays}`);
      }
      if (candidate?.status === "carried" && Number.isFinite(age) && age > Number(candidate.freshnessWindowDays)) {
        warnings.push(`${context} is carried at ${age} days old, above freshnessWindowDays ${candidate.freshnessWindowDays}`);
      }
    }
    if (!["confirmed", "carried", "unavailable"].includes(candidate?.status)) errors.push(`${context}.status is invalid`);
    if (!["high", "medium", "low", "unknown"].includes(candidate?.confidence)) errors.push(`${context}.confidence is invalid`);
    if (candidate?.confidence !== STATUS_CONFIDENCE[candidate?.status]) {
      errors.push(`${context}.confidence is inconsistent with ${candidate?.status} status`);
    }
  }

  for (const snapshot of snapshots) {
    if (!["fetched", "failed", "skipped"].includes(snapshot.status)) errors.push(`snapshot ${snapshot.id} status is invalid`);
    if (snapshot.status === "fetched" && (!snapshot.contentHash || !SHA256.test(snapshot.contentHash))) {
      errors.push(`snapshot ${snapshot.id} fetched records require contentHash`);
    }
    if (snapshot.status === "fetched" && (!snapshot.rawSnapshotRef || !snapshot.artifactPath)) {
      errors.push(`snapshot ${snapshot.id} fetched records require durable raw snapshot linkage`);
    }
    if (!/^https:\/\//.test(snapshot.url || "") || !/^https:\/\//.test(snapshot.canonicalUrl || "")) {
      errors.push(`snapshot ${snapshot.id} urls must use https`);
    }
    if (!snapshot.evidenceId || !Array.isArray(snapshot.recordKeys)) errors.push(`snapshot ${snapshot.id} machine evidence metadata is incomplete`);
  }

  return { errors, warnings };
}

function assessmentVersion(asOf, observations) {
  return `energy-assessment:${sha256({ asOf, observations: observations.map((item) => ({ id: item.id, recordKey: item.recordKey, status: item.status, value: item.value, low: item.low, high: item.high, change: item.change, changePct: item.changePct })) }).slice(0, 24)}`;
}

export async function runEnergyRefresh({
  state = loadState(),
  exposure = readJson(PATHS.exposure),
  registry = loadSourceRegistry(),
  asOf = state.asOf,
  trigger = "daily",
  now = new Date().toISOString(),
  fetchImpl = globalThis.fetch,
  offline = process.env.ENERGY_OFFLINE === "1",
  fixtureName = null,
  sourceId = null,
  from = null,
  to = null,
  dryRun = false,
} = {}) {
  const startedAt = now;
  const fixture = sourceFixture(fixtureName);
  const baseFingerprint = computeEnergyRefreshFingerprint({ state, exposure, registry });
  const validation = { errors: validateSourceRegistry(registry), warnings: [] };
  const snapshots = [];
  const observations = [];
  const machineEvidence = [];

  if (validation.errors.length) {
    const report = {
      schemaVersion: ENERGY_REFRESH_SCHEMA_VERSION,
      runId: `energy-refresh:invalid:${sha256(registry).slice(0, 16)}`,
      trigger,
      asOf,
      startedAt,
      completedAt: now,
      baseFingerprint,
      sourceDefinitions: registry.sources || [],
      snapshots,
      machineEvidence,
      observations,
      reconciliations: [],
      coverage: {},
      sourceFilter: sourceId,
      requestedPeriod: from || to ? { start: from, end: to } : null,
      validation,
      promotion: {
        status: "blocked",
        eligibleRecordIds: [],
        rejectedRecordIds: [],
        assessmentVersion: null,
        calculatedAt: null,
        errors: [...validation.errors],
      },
    };
    if (!dryRun) {
      writeJson(PATHS.energyCandidates, {
        schemaVersion: ENERGY_CANDIDATE_SCHEMA_VERSION,
        runId: report.runId,
        asOf,
        baseFingerprint,
        observations,
        machineEvidence,
        validation,
      });
      writeJson(PATHS.energyRefreshReport, report);
    }
    return report;
  }

  const enabledSources = registry.sources.filter((item) => item.enabled);
  if (sourceId && !enabledSources.some((source) => source.id === sourceId)) validation.errors.push(`unknown source filter ${sourceId}`);
  for (const source of enabledSources) {
    const retrievedAt = new Date(Date.parse(now)).toISOString();
    if (sourceId && source.id !== sourceId) {
      snapshots.push(snapshotFor(source, retrievedAt, { error: `Source filter ${sourceId} selected` }));
      continue;
    }
    if (source.automation === "manual-only") {
      const snapshot = snapshotFor(source, retrievedAt, { error: "Manual-only reviewed evidence is not fetched by automation" });
      snapshots.push(snapshot);
      observations.push(...fallbackForSource(source, snapshot, state, exposure));
      continue;
    }

    try {
      const fetched = await fetchAutomatedSource(source, { fetchImpl, retrievedAt, offline, fixture, from, to, dryRun });
      snapshots.push(fetched.snapshot);
      if (!fetched.records.length) {
        observations.push(...fallbackForSource(source, fetched.snapshot, state, exposure));
        continue;
      }
      for (const raw of fetched.records) {
        observations.push(normalizeObservation(raw, source, fetched.snapshot, { asOf }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const snapshot = error?.snapshot || snapshotFor(source, retrievedAt, { status: "failed", error: message });
      snapshots.push(snapshot);
      validation.warnings.push(`${source.id}: ${message}; applying declared ${source.fallback} fallback`);
      observations.push(...fallbackForSource(source, snapshot, state, exposure, message));
    }
  }

  const deduped = deduplicateCandidates(observations);
  for (const duplicate of deduped.duplicates) validation.errors.push(`duplicate candidate record ${duplicate.key} (${duplicate.id})`);
  const coverage = {};
  for (const source of enabledSources) {
    const sourceCoverage = buildSourceCoverage(source, snapshots, deduped.candidates, { from, to });
    coverage[source.id] = sourceCoverage;
    for (const candidate of deduped.candidates.filter((item) => item.sourceId === source.id)) {
      candidate.coverage = { ...candidate.coverage, ...sourceCoverage };
    }
    const snapshot = snapshots.find((item) => item.sourceId === source.id);
    if (snapshot) Object.assign(snapshot, {
      sourcePeriod: sourceCoverage.sourcePeriod,
      expectedCadence: sourceCoverage.expectedCadence,
      observedPeriod: sourceCoverage.observedPeriod,
      missingPeriods: sourceCoverage.missingPeriods,
      sourceStatus: sourceCoverage.sourceStatus,
    });
  }
  const reconciled = reconcileCandidates(deduped.candidates, registry.sources);
  attachSnapshotRecords(snapshots, reconciled.candidates);
  machineEvidence.push(...buildMachineEvidence(snapshots, reconciled.candidates));
  const finalCandidateValidation = validateNormalizedCandidates({
    candidates: reconciled.candidates,
    sources: registry.sources,
    state,
    exposure,
    asOf,
    snapshots,
    machineEvidence,
    allowHistorical: Boolean(from || to),
  });
  validation.errors.push(...finalCandidateValidation.errors);
  validation.warnings.push(...finalCandidateValidation.warnings);
  const completedAt = new Date(Date.parse(now)).toISOString();
  const runId = `energy-refresh:${sha256({ baseFingerprint, asOf, trigger, sourceId, from, to, observations: reconciled.candidates.map((item) => ({ recordKey: item.recordKey, status: item.status, value: item.value, low: item.low, high: item.high, change: item.change, changePct: item.changePct, provider: item.provider, selectedForAssessment: item.selectedForAssessment })) }).slice(0, 24)}`;
  const promotionErrors = [...validation.errors];
  const promotion = {
    status: promotionErrors.length ? "blocked" : "validated",
    eligibleRecordIds: promotionErrors.length ? [] : reconciled.candidates.map((item) => item.id),
    rejectedRecordIds: promotionErrors.length ? reconciled.candidates.map((item) => item.id) : [],
    assessmentVersion: promotionErrors.length ? null : assessmentVersion(asOf, reconciled.candidates),
    calculatedAt: promotionErrors.length ? null : completedAt,
    errors: promotionErrors,
  };
  const report = {
    schemaVersion: ENERGY_REFRESH_SCHEMA_VERSION,
    runId,
    trigger,
    asOf,
    startedAt,
    completedAt,
    baseFingerprint,
    sourceDefinitions: registry.sources,
    snapshots,
    machineEvidence,
    observations: reconciled.candidates,
    reconciliations: reconciled.reconciliations,
    coverage,
    sourceFilter: sourceId,
    requestedPeriod: from || to ? { start: from, end: to } : null,
    validation,
    promotion,
  };
  if (!dryRun) {
    writeJson(PATHS.energyCandidates, {
      schemaVersion: ENERGY_CANDIDATE_SCHEMA_VERSION,
      runId,
      asOf,
      baseFingerprint,
      generatedAt: completedAt,
      observations: reconciled.candidates,
      machineEvidence,
      reconciliations: reconciled.reconciliations,
      coverage,
      sourceFilter: sourceId,
      requestedPeriod: from || to ? { start: from, end: to } : null,
      validation,
    });
    writeJson(PATHS.energyRefreshReport, report);
    writeJson(PATHS.energySnapshotManifest, {
      schemaVersion: ENERGY_SNAPSHOT_SCHEMA_VERSION,
      generatedAt: completedAt,
      snapshots: snapshots.map((snapshot) => ({ ...snapshot })),
    });
  }
  return report;
}

function parseArgs(argv = process.argv.slice(2)) {
  const fixtureIndex = argv.indexOf("--fixture");
  const sourceIndex = argv.indexOf("--source");
  const fromIndex = argv.indexOf("--from");
  const toIndex = argv.indexOf("--to");
  return {
    dryRun: argv.includes("--dry-run"),
    trigger: argv.includes("--event") ? "event" : "daily",
    offline: argv.includes("--offline"),
    fixtureName: fixtureIndex >= 0 ? argv[fixtureIndex + 1] : null,
    sourceId: sourceIndex >= 0 ? argv[sourceIndex + 1] : null,
    from: fromIndex >= 0 ? argv[fromIndex + 1] : null,
    to: toIndex >= 0 ? argv[toIndex + 1] : null,
  };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const report = await runEnergyRefresh({
    trigger: args.trigger,
    offline: args.offline || process.env.ENERGY_OFFLINE === "1",
    fixtureName: args.fixtureName,
    sourceId: args.sourceId,
    from: args.from,
    to: args.to,
    dryRun: args.dryRun,
  });
  console.log(`energy:refresh ${args.dryRun ? "dry-run " : ""}result: ${report.promotion.status}`);
  for (const snapshot of report.snapshots) {
    console.log(`- ${snapshot.sourceId}: ${snapshot.status}${snapshot.error ? ` (${snapshot.error})` : ""}`);
  }
  for (const observation of report.observations) {
    const value = observation.status === "unavailable" ? "unavailable" : observation.value ?? `${observation.low}–${observation.high}`;
    console.log(`- ${observation.id}: ${value} ${observation.unit ?? ""} · ${observation.status}`);
  }
  for (const [sourceId, item] of Object.entries(report.coverage || {})) {
    console.log(`- coverage ${sourceId}: ${item.status} · ${item.expectedCadence} · missing ${item.missingPeriods.length}`);
  }
  if (report.validation.warnings.length) {
    console.log(`- warnings: ${report.validation.warnings.length}`);
  }
  if (report.validation.errors.length) {
    for (const error of report.validation.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
