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
  return String(value).slice(0, 10);
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
  for (const source of registry.sources) {
    if (!source?.id) errors.push("source registry entries require id");
    if (ids.has(source?.id)) errors.push(`source registry contains duplicate id ${source.id}`);
    ids.add(source?.id);
    if (!/^https:\/\//.test(source?.url ?? "")) errors.push(`source ${source?.id ?? "?"} url must use https`);
    if (!source?.provider) errors.push(`source ${source?.id ?? "?"} provider is required`);
    if (!source?.title) errors.push(`source ${source?.id ?? "?"} title is required`);
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
    const validSelectionTypes = ["eia-series", "portwatch-route", "yahoo-symbol", "reviewed-event"];
    if (!selection || !validSelectionTypes.includes(selection.type)) {
      errors.push(`source ${source?.id ?? "?"} selection.type is invalid`);
    } else if (selection.type === "eia-series" && !selection.seriesId && !selection.seriesIdEnv) {
      errors.push(`source ${source.id} eia-series selection requires seriesId or seriesIdEnv`);
    } else if (selection.type === "portwatch-route" && !selection.routeId && !selection.routeIdEnv) {
      errors.push(`source ${source.id} portwatch-route selection requires routeId or routeIdEnv`);
    } else if (selection.type === "yahoo-symbol" && !selection.symbol) {
      errors.push(`source ${source.id} yahoo-symbol selection requires symbol`);
    }
    for (const targetId of [...(source?.targetInputIds || []), ...(source?.targetCommercialInputIds || [])]) {
      const policy = source?.targetPolicies?.[targetId];
      if (!policy) {
        errors.push(`source ${source?.id ?? "?"} target ${targetId} requires a target policy`);
        continue;
      }
      if (!["daily", "event-driven", "contract-driven"].includes(policy.cadence)) {
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
}) {
  return sha256({
    sourceId,
    entityIds: [...new Set(entityIds ?? [])].sort(),
    targetInputIds: [...new Set(targetInputIds ?? [])].sort(),
    targetCommercialInputIds: [...new Set(targetCommercialInputIds ?? [])].sort(),
    observationDate: observationDate ?? null,
    unit: unit ?? null,
  });
}

function snapshotRef(snapshot) {
  return `snapshot:${snapshot.id}`;
}

function defaultRecordId(source, targets, observationDate) {
  const target = [...targets.targetInputIds, ...targets.targetCommercialInputIds].map(slug).join("-") || "source";
  return `energy-observation:${slug(source.id)}:${target}:${slug(observationDate ?? "unavailable")}`;
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
    observationAt: isoOrNull(raw?.observedAt || raw?.observationDate || raw?.sourceDate),
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
  const observationDate = dateOnly(raw?.observationDate || raw?.sourceDate || raw?.observedAt);
  const unit = raw?.unit === undefined ? null : raw.unit;
  const recordKey = raw?.recordKey || stableRecordKey({
    sourceId: source.id,
    entityIds,
    ...targets,
    observationDate,
    unit,
  });
  const status = raw?.status || "confirmed";
  const id = raw?.id || defaultRecordId(source, targets, observationDate);
  const value = raw?.value;
  const normalized = {
    id,
    recordKey,
    label: raw?.label || source.title,
    entityIds,
    ...targets,
    ...(value !== undefined ? { value } : {}),
    ...(typeof raw?.low === "number" ? { low: raw.low } : {}),
    ...(typeof raw?.high === "number" ? { high: raw.high } : {}),
    ...(typeof raw?.change === "number" && Number.isFinite(raw.change) ? { change: raw.change } : {}),
    ...(typeof raw?.changePct === "number" && Number.isFinite(raw.changePct) ? { changePct: raw.changePct } : {}),
    unit,
    observationDate,
    observedAt: isoOrNull(raw?.observedAt || raw?.sourceDate),
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
  return row?.metric || row?.metricId || row?.measure || null;
}

function keepSelectedRow(row, selection, { idKey, idValue }) {
  const rowId = row?.[idKey] || row?.[`${idKey}_id`] || row?.id || row?.seriesId || row?.series_id || row?.routeId || row?.route_id;
  if (idValue && rowId !== idValue) return false;
  const entityIds = rowEntityIds(row);
  if (selection.entityId && entityIds.length && !entityIds.includes(selection.entityId)) return false;
  const metric = rowMetric(row);
  if (selection.metric && metric && metric !== selection.metric) return false;
  return true;
}

function currentRows(rows) {
  const dates = rows.map((row) => Date.parse(dateOnly(row.observationDate || row.sourceDate || row.observedAt) || "")).filter(Number.isFinite);
  if (!dates.length) return rows;
  const latest = Math.max(...dates);
  return rows.filter((row) => Date.parse(dateOnly(row.observationDate || row.sourceDate || row.observedAt) || "") === latest);
}

function parseEiaRecords(payload, source) {
  const rows = payload?.response?.data || payload?.data || payload?.observations || [];
  if (!Array.isArray(rows)) throw new Error("EIA response data must be an array");
  const selection = sourceSelection(source);
  const seriesId = selectorValue(selection, "seriesId", "seriesIdEnv");
  if (!seriesId) throw new Error(`${source.id}: EIA series selector is not configured`);
  const selected = rows.filter((row) => keepSelectedRow(row, selection, { idKey: "seriesId", idValue: seriesId }));
  if (!selected.length) throw new Error(`${source.id}: response contains no selected series/entity rows`);
  return currentRows(selected).map((row) => ({
    label: row.seriesDescription || row.description || selection.metric || "EIA energy observation",
    entityIds: rowEntityIds(row).length ? rowEntityIds(row) : [selection.entityId],
    value: Number(row.value),
    unit: row.unit || row.unitOfMeasure || "",
    observationDate: row.period || row.date,
    observedAt: row.observedAt || row.period,
    metric: rowMetric(row),
  }));
}

function parseRouteRecords(payload, source) {
  const rows = payload?.data || payload?.observations || payload?.records || payload;
  if (!Array.isArray(rows)) throw new Error("route response records must be an array");
  const selection = sourceSelection(source);
  const routeId = selectorValue(selection, "routeId", "routeIdEnv");
  if (!routeId) throw new Error(`${source.id}: PortWatch route selector is not configured`);
  const selected = rows.filter((row) => keepSelectedRow(row, selection, { idKey: "routeId", idValue: routeId }));
  if (!selected.length) throw new Error(`${source.id}: response contains no selected route/entity rows`);
  return currentRows(selected).map((row) => ({
    label: row.label || row.name || selection.metric || "Hormuz route observation",
    entityIds: rowEntityIds(row).length ? rowEntityIds(row) : [selection.entityId],
    value: row.value ?? row.transits ?? row.count,
    low: row.low,
    high: row.high,
    unit: row.unit || "LNG transits",
    observationDate: row.observationDate || row.date || row.period,
    observedAt: row.observedAt || row.date,
    metric: rowMetric(row),
  }));
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
  const id = `energy-snapshot:${slug(source.id)}:${contentHash ? contentHash.slice(0, 16) : slug(retrievedAt)}`;
  return {
    id,
    sourceId: source.id,
    provider: source.provider,
    url,
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
    ...(error ? { error } : {}),
    lineageRef: `snapshot:${id}`,
  };
}

async function fetchAutomatedSource(source, {
  fetchImpl,
  retrievedAt,
  offline,
  fixture,
}) {
  const fixtureRows = fixture?.sources?.[source.id];
  if (fixtureRows) {
    const content = JSON.stringify(fixtureRows);
    const selection = sourceSelection(source);
    const records = selection.type === "eia-series"
      ? parseEiaRecords({ data: fixtureRows }, source)
      : selection.type === "portwatch-route"
        ? parseRouteRecords(fixtureRows, source)
        : fixtureRows;
    return {
      snapshot: snapshotFor(source, retrievedAt, {
        status: "fetched",
        httpStatus: 200,
        contentType: "application/json",
        content,
        observedAt: fixtureRows[0]?.observedAt || fixtureRows[0]?.observationDate,
      }),
      records,
    };
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
    return {
      snapshot: snapshotFor(source, retrievedAt, {
        status: "fetched",
        httpStatus: 200,
        contentType: "application/json",
        content: raw,
        observedAt: quote.observedAt,
        url: source.url,
      }),
      records: [raw],
    };
  }

  if (source.id === "src-eia-lng-baseline") {
    const apiKey = process.env.EIA_API_KEY;
    const endpoint = process.env.EIA_DATA_URL;
    if (!apiKey && !endpoint) throw new Error("EIA_API_KEY or EIA_DATA_URL is required for the EIA connector");
    const url = endpoint || `${source.url}?api_key=${encodeURIComponent(apiKey)}`;
    const { response, text } = await fetchText(url, fetchImpl);
    const payload = parseJsonOrThrow(text, source);
    if (!response.ok) throw new Error(`EIA ${response.status}`);
    return {
      snapshot: snapshotFor(source, retrievedAt, {
        status: "fetched",
        httpStatus: response.status,
        contentType: response.headers.get("content-type"),
        content: text,
        url,
      }),
      records: parseEiaRecords(payload, source),
    };
  }

  if (source.id === "src-imf-portwatch-hormuz") {
    const url = process.env.PORTWATCH_DATA_URL;
    if (!url) throw new Error("PORTWATCH_DATA_URL is required for the machine-readable PortWatch connector");
    const { response, text } = await fetchText(url, fetchImpl);
    const payload = parseJsonOrThrow(text, source);
    if (!response.ok) throw new Error(`PortWatch ${response.status}`);
    return {
      snapshot: snapshotFor(source, retrievedAt, {
        status: "fetched",
        httpStatus: response.status,
        contentType: response.headers.get("content-type"),
        content: text,
        url,
      }),
      records: parseRouteRecords(payload, source),
    };
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
        const targetKey = `${target}:${candidate.observationDate ?? "unavailable"}:${candidate.unit ?? ""}`;
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
      if (source && source.category !== "reviewed-event" && hasValue && typeof candidate.value !== "number") {
        errors.push(`${context}.value must be numeric for ${source.category} observations`);
      }
      if (!hasValue && !hasRange) errors.push(`${context} requires value or low/high`);
      if (hasRange && candidate.low > candidate.high) errors.push(`${context}.low must not exceed high`);
      if (!candidate?.observationDate) errors.push(`${context} observed records require observationDate`);
      if (candidate?.status === "carried" && !candidate?.carryReason) errors.push(`${context} carried records require carryReason`);
      if (candidate?.status === "confirmed" && !candidate?.sourceUrl) errors.push(`${context} confirmed records require sourceUrl`);
      const age = daysBetween(asOf, candidate.observationDate);
      if (candidate?.status === "confirmed" && Number.isFinite(age) && age > Number(candidate.freshnessWindowDays)) {
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

  for (const source of registry.sources.filter((item) => item.enabled)) {
    const retrievedAt = new Date(Date.parse(now)).toISOString();
    if (source.automation === "manual-only") {
      const snapshot = snapshotFor(source, retrievedAt, { error: "Manual-only reviewed evidence is not fetched by automation" });
      snapshots.push(snapshot);
      observations.push(...fallbackForSource(source, snapshot, state, exposure));
      continue;
    }

    try {
      const fetched = await fetchAutomatedSource(source, { fetchImpl, retrievedAt, offline, fixture });
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
      const snapshot = snapshotFor(source, retrievedAt, { status: "failed", error: message });
      snapshots.push(snapshot);
      validation.warnings.push(`${source.id}: ${message}; applying declared ${source.fallback} fallback`);
      observations.push(...fallbackForSource(source, snapshot, state, exposure, message));
    }
  }

  const deduped = deduplicateCandidates(observations);
  for (const duplicate of deduped.duplicates) validation.errors.push(`duplicate candidate record ${duplicate.key} (${duplicate.id})`);
  attachSnapshotRecords(snapshots, deduped.candidates);
  machineEvidence.push(...buildMachineEvidence(snapshots, deduped.candidates));
  const finalCandidateValidation = validateNormalizedCandidates({
    candidates: deduped.candidates,
    sources: registry.sources,
    state,
    exposure,
    asOf,
    snapshots,
    machineEvidence,
  });
  validation.errors.push(...finalCandidateValidation.errors);
  validation.warnings.push(...finalCandidateValidation.warnings);
  const completedAt = new Date(Date.parse(now)).toISOString();
  const runId = `energy-refresh:${sha256({ baseFingerprint, asOf, trigger, observations: deduped.candidates.map((item) => ({ recordKey: item.recordKey, status: item.status, value: item.value, low: item.low, high: item.high, change: item.change, changePct: item.changePct, provider: item.provider })) }).slice(0, 24)}`;
  const promotionErrors = [...validation.errors];
  const promotion = {
    status: promotionErrors.length ? "blocked" : "validated",
    eligibleRecordIds: promotionErrors.length ? [] : deduped.candidates.map((item) => item.id),
    rejectedRecordIds: promotionErrors.length ? deduped.candidates.map((item) => item.id) : [],
    assessmentVersion: promotionErrors.length ? null : assessmentVersion(asOf, deduped.candidates),
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
    observations: deduped.candidates,
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
      observations: deduped.candidates,
      machineEvidence,
      validation,
    });
    writeJson(PATHS.energyRefreshReport, report);
  }
  return report;
}

function parseArgs(argv = process.argv.slice(2)) {
  const fixtureIndex = argv.indexOf("--fixture");
  return {
    dryRun: argv.includes("--dry-run"),
    trigger: argv.includes("--event") ? "event" : "daily",
    offline: argv.includes("--offline"),
    fixtureName: fixtureIndex >= 0 ? argv[fixtureIndex + 1] : null,
  };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const report = await runEnergyRefresh({
    trigger: args.trigger,
    offline: args.offline || process.env.ENERGY_OFFLINE === "1",
    fixtureName: args.fixtureName,
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
