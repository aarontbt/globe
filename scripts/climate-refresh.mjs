import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import booleanIntersects from "@turf/boolean-intersects";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { feature, lineString, point } from "@turf/helpers";
import { PATHS, readJson, writeJson } from "./daily-common.mjs";

export const CLIMATE_AOI = Object.freeze({ west: 40, south: -20, east: 155, north: 45 });
const HAZARD_TYPES = new Map([["TC", "tropical-cyclone"], ["FL", "flood"]]);
const ALERT_LEVELS = new Set(["green", "orange", "red"]);
const GEOMETRY_TYPES = new Set(["Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon"]);
const POLYGON_TYPES = new Set(["Polygon", "MultiPolygon"]);
const SOURCE_STATUSES = new Set(["fresh", "stale", "unavailable", "not-run"]);
const TARGET_TYPES = new Set(["port", "corridor", "energy-entity", "exposure-trace"]);

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex");
}

function iso(value, fallback = null) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function plainText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function coordinatesAreValid(value) {
  if (!Array.isArray(value)) return false;
  if (value.length >= 2 && value.every((item) => typeof item === "number")) {
    return Number.isFinite(value[0]) && Number.isFinite(value[1]) && value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90;
  }
  return value.length > 0 && value.every(coordinatesAreValid);
}

function geometryIsValid(geometry) {
  return Boolean(geometry && GEOMETRY_TYPES.has(geometry.type) && coordinatesAreValid(geometry.coordinates));
}

function allPositions(value, positions = []) {
  if (!Array.isArray(value)) return positions;
  if (value.length >= 2 && value.every((item) => typeof item === "number")) {
    positions.push([value[0], value[1]]);
    return positions;
  }
  for (const item of value) allPositions(item, positions);
  return positions;
}

function centroidFor(geometry) {
  if (geometry.type === "Point") return geometry.coordinates;
  const positions = allPositions(geometry.coordinates);
  const totals = positions.reduce((sum, position) => [sum[0] + position[0], sum[1] + position[1]], [0, 0]);
  return positions.length ? [totals[0] / positions.length, totals[1] / positions.length] : [0, 0];
}

function aoiPolygon() {
  const { west, south, east, north } = CLIMATE_AOI;
  return feature({
    type: "Polygon",
    coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
  });
}

function geometryIntersectsAoi(geometry) {
  if (geometry.type === "Point") {
    const [longitude, latitude] = geometry.coordinates;
    return longitude >= CLIMATE_AOI.west && longitude <= CLIMATE_AOI.east && latitude >= CLIMATE_AOI.south && latitude <= CLIMATE_AOI.north;
  }
  try {
    return booleanIntersects(feature(geometry), aoiPolygon());
  } catch {
    return false;
  }
}

function sourceUrl(properties, eventType, eventId) {
  for (const candidate of [properties.url, properties.reporturl, properties.sourceurl]) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "https:") return parsed.toString();
    } catch {}
  }
  const url = new URL("https://www.gdacs.org/report.aspx");
  url.searchParams.set("eventtype", eventType);
  url.searchParams.set("eventid", eventId);
  return url.toString();
}

function countriesFor(value) {
  if (Array.isArray(value)) return value.map(plainText).filter(Boolean);
  return String(value ?? "").split(/[;,]/).map(plainText).filter(Boolean);
}

function normalizeFeature(rawFeature, snapshot, now) {
  const properties = rawFeature?.properties ?? {};
  const eventTypeCode = String(properties.eventtype ?? properties.eventType ?? "").toUpperCase();
  const type = HAZARD_TYPES.get(eventTypeCode);
  const geometry = rawFeature?.geometry;
  const eventId = String(properties.eventid ?? properties.eventId ?? properties.id ?? "").trim();
  if (!type) return { warning: `ignored unsupported event type ${eventTypeCode || "unknown"}` };
  if (!eventId) return { warning: "ignored GDACS feature without event ID" };
  if (!geometryIsValid(geometry)) return { warning: `ignored ${eventTypeCode}:${eventId} with invalid geometry` };
  if (!geometryIntersectsAoi(geometry)) return { ignored: true };

  const episodeId = String(properties.episodeid ?? properties.episodeId ?? "").trim() || null;
  const alertText = String(properties.alertlevel ?? properties.alertLevel ?? "unknown").toLowerCase();
  const alertLevel = ALERT_LEVELS.has(alertText) ? alertText : "unknown";
  const updatedAt = iso(properties.lastupdate ?? properties.updatedAt ?? properties.todate, now);
  const validFrom = iso(properties.fromdate ?? properties.validFrom);
  const validTo = iso(properties.todate ?? properties.validTo);
  if (validTo && Date.parse(validTo) < Date.parse(now)) return { ignored: true };

  const title = plainText(properties.name ?? properties.eventname ?? properties.description) || `${type === "flood" ? "Flood" : "Tropical cyclone"} ${eventId}`;
  const description = plainText(properties.description ?? properties.htmldescription ?? properties.severitydata?.severitytext) || "GDACS hazard event.";
  const id = `gdacs:${eventTypeCode.toLowerCase()}:${eventId}${episodeId ? `:${episodeId}` : ""}`;
  return {
    hazard: {
      id,
      sourceId: "gdacs-event-list",
      sourceEventId: eventId,
      sourceEpisodeId: episodeId,
      type,
      title,
      description,
      alertLevel,
      countries: countriesFor(properties.country ?? properties.countries),
      geometry,
      centroid: centroidFor(geometry),
      observedAt: iso(properties.fromdate ?? properties.observedAt, updatedAt),
      updatedAt,
      validFrom,
      validTo,
      sourceUrl: sourceUrl(properties, eventTypeCode, eventId),
      impactAssessment: POLYGON_TYPES.has(geometry.type) ? "available" : "unavailable",
      lineage: { snapshotId: snapshot.id, contentHash: snapshot.contentHash },
    },
  };
}

export function normalizeGdacs(payload, snapshot, now) {
  const warnings = [];
  const byId = new Map();
  for (const rawFeature of payload?.features ?? []) {
    const normalized = normalizeFeature(rawFeature, snapshot, now);
    if (normalized.warning) warnings.push(normalized.warning);
    if (!normalized.hazard) continue;
    const existing = byId.get(normalized.hazard.id);
    if (!existing || normalized.hazard.updatedAt > existing.updatedAt) byId.set(normalized.hazard.id, normalized.hazard);
  }
  return { hazards: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)), warnings };
}

function climateTargets({ ports, corridors, exposure }) {
  const targets = [];
  for (const portRecord of ports ?? []) {
    if (coordinatesAreValid(portRecord.coordinates)) targets.push({ type: "port", id: portRecord.id, name: portRecord.name, geometry: point(portRecord.coordinates), coordinates: portRecord.coordinates });
  }
  for (const corridor of corridors ?? []) {
    if (coordinatesAreValid(corridor.path) && corridor.path.length >= 2) targets.push({ type: "corridor", id: corridor.id, name: corridor.name, geometry: lineString(corridor.path) });
  }
  const entities = new Map();
  for (const entity of exposure?.entities ?? []) {
    entities.set(entity.id, entity);
    if (coordinatesAreValid(entity.coordinates)) targets.push({ type: "energy-entity", id: entity.id, name: entity.name, geometry: point(entity.coordinates), coordinates: entity.coordinates });
  }
  for (const trace of exposure?.traces ?? []) {
    const route = (trace.routeEntityIds ?? []).map((id) => entities.get(id)?.coordinates).filter(coordinatesAreValid);
    if (route.length >= 2) targets.push({ type: "exposure-trace", id: trace.id, name: trace.title, geometry: lineString(route) });
  }
  return targets;
}

function impactFor(hazard, target) {
  if (!POLYGON_TYPES.has(hazard.geometry.type)) return null;
  const footprint = feature(hazard.geometry);
  try {
    if (target.geometry.geometry.type === "Point" && booleanPointInPolygon(target.geometry, footprint)) {
      return { relationship: "inside-footprint", method: "point-in-polygon" };
    }
    if (target.geometry.geometry.type !== "Point" && booleanIntersects(target.geometry, footprint)) {
      return { relationship: "intersects-footprint", method: "geometry-intersection" };
    }
  } catch {}
  return null;
}

export function deriveClimateImpacts(hazards, targetData) {
  const impacts = [];
  for (const hazard of hazards) {
    for (const target of climateTargets(targetData)) {
      const derived = impactFor(hazard, target);
      if (!derived) continue;
      impacts.push({
        id: `${hazard.id}:${target.type}:${target.id}`,
        hazardId: hazard.id,
        targetType: target.type,
        targetId: target.id,
        targetName: target.name,
        ...(target.coordinates ? { targetCoordinates: target.coordinates } : {}),
        relationship: derived.relationship,
        status: "derived",
        confidence: "high",
        derivedFrom: { hazardId: hazard.id, sourceId: "gdacs-event-list", method: derived.method },
      });
    }
  }
  return impacts.sort((a, b) => a.id.localeCompare(b.id));
}

function targetProjection(targetData) {
  return {
    ports: (targetData.ports ?? []).map(({ id, coordinates }) => ({ id, coordinates })),
    corridors: (targetData.corridors ?? []).map(({ id, path: route }) => ({ id, path: route })),
    entities: (targetData.exposure?.entities ?? []).map(({ id, coordinates }) => ({ id, coordinates })),
    traces: (targetData.exposure?.traces ?? []).map(({ id, routeEntityIds }) => ({ id, routeEntityIds })),
  };
}

export function computeClimateRefreshFingerprint({ registry, targetData }) {
  return sha256({ registry, targets: targetProjection(targetData), areaOfInterest: CLIMATE_AOI });
}

function knownTargetKeys(targetData) {
  return new Set(climateTargets(targetData).map((target) => `${target.type}:${target.id}`));
}

export function validateClimateReadModel(model, { targetData = null } = {}) {
  const errors = [];
  if (model?.schemaVersion !== "climate-read-model-v1") errors.push("climate read model schemaVersion is invalid");
  if (!iso(model?.asOf)) errors.push("climate read model asOf is invalid");
  if (!iso(model?.generatedAt)) errors.push("climate read model generatedAt is invalid");
  if (stableJson(model?.areaOfInterest) !== stableJson(CLIMATE_AOI)) errors.push("climate read model areaOfInterest is invalid");
  if (model?.sourceStatus?.sourceId !== "gdacs-event-list") errors.push("climate sourceStatus sourceId is invalid");
  if (!String(model?.sourceStatus?.sourceUrl ?? "").startsWith("https://")) errors.push("climate sourceStatus must use HTTPS");
  if (!SOURCE_STATUSES.has(model?.sourceStatus?.status)) errors.push("climate sourceStatus status is invalid");
  const hazards = new Map();
  for (const hazard of model?.hazards ?? []) {
    if (hazards.has(hazard.id)) errors.push(`duplicate climate hazard ${hazard.id}`);
    hazards.set(hazard.id, hazard);
    if (!HAZARD_TYPES.has(hazard.type === "tropical-cyclone" ? "TC" : hazard.type === "flood" ? "FL" : "")) errors.push(`hazard ${hazard.id} has unsupported type`);
    if (!geometryIsValid(hazard.geometry)) errors.push(`hazard ${hazard.id} has invalid geometry`);
    else if (!geometryIntersectsAoi(hazard.geometry)) errors.push(`hazard ${hazard.id} is outside the climate area of interest`);
    if (!coordinatesAreValid(hazard.centroid)) errors.push(`hazard ${hazard.id} has invalid centroid`);
    if (!String(hazard.sourceUrl ?? "").startsWith("https://")) errors.push(`hazard ${hazard.id} sourceUrl must use HTTPS`);
    if (!ALERT_LEVELS.has(hazard.alertLevel) && hazard.alertLevel !== "unknown") errors.push(`hazard ${hazard.id} alertLevel is invalid`);
    if (!iso(hazard.observedAt)) errors.push(`hazard ${hazard.id} observedAt is invalid`);
    if (!iso(hazard.updatedAt)) errors.push(`hazard ${hazard.id} updatedAt is invalid`);
    if (hazard.validFrom && !iso(hazard.validFrom)) errors.push(`hazard ${hazard.id} validFrom is invalid`);
    if (hazard.validTo && !iso(hazard.validTo)) errors.push(`hazard ${hazard.id} validTo is invalid`);
    if (!hazard.lineage?.snapshotId || !/^[a-f0-9]{64}$/.test(hazard.lineage?.contentHash ?? "")) errors.push(`hazard ${hazard.id} lineage is invalid`);
    if (hazard.impactAssessment === "available" && !POLYGON_TYPES.has(hazard.geometry?.type)) errors.push(`hazard ${hazard.id} cannot have footprint impacts`);
  }
  const knownTargets = targetData ? knownTargetKeys(targetData) : null;
  const impactIds = new Set();
  for (const impact of model?.impacts ?? []) {
    if (impactIds.has(impact.id)) errors.push(`duplicate climate impact ${impact.id}`);
    impactIds.add(impact.id);
    const hazard = hazards.get(impact.hazardId);
    if (!hazard) errors.push(`impact ${impact.id} references unknown hazard ${impact.hazardId}`);
    if (hazard && !POLYGON_TYPES.has(hazard.geometry.type)) errors.push(`impact ${impact.id} derives from a point-only hazard`);
    if (knownTargets && !knownTargets.has(`${impact.targetType}:${impact.targetId}`)) errors.push(`impact ${impact.id} references unknown target`);
    if (!TARGET_TYPES.has(impact.targetType)) errors.push(`impact ${impact.id} targetType is invalid`);
    if (!new Set(["inside-footprint", "intersects-footprint"]).has(impact.relationship)) errors.push(`impact ${impact.id} relationship is invalid`);
    if (impact.targetCoordinates && !coordinatesAreValid(impact.targetCoordinates)) errors.push(`impact ${impact.id} targetCoordinates are invalid`);
    if (impact.derivedFrom?.hazardId !== impact.hazardId) errors.push(`impact ${impact.id} lineage is inconsistent`);
    if (impact.derivedFrom?.sourceId !== "gdacs-event-list") errors.push(`impact ${impact.id} source lineage is invalid`);
  }
  return errors;
}

export function readClimateTargetData() {
  return {
    ports: readJson(path.join(PATHS.root, "src/data/ports.json")),
    corridors: readJson(path.join(PATHS.root, "src/data/corridors.json")),
    exposure: readJson(PATHS.exposure),
  };
}

function buildRequestUrl(source, now) {
  const url = new URL(source.endpoint);
  const from = new Date(Date.parse(now) - 7 * 86_400_000).toISOString().slice(0, 10);
  url.searchParams.set("eventlist", source.eventTypes.join(";"));
  url.searchParams.set("fromDate", from);
  url.searchParams.set("toDate", now.slice(0, 10));
  return url.toString();
}

export async function runClimateRefresh({
  now = new Date().toISOString(),
  registry = readJson(PATHS.climateSourceRegistry),
  targetData = readClimateTargetData(),
  payload = null,
  fetchImpl = fetch,
  dryRun = false,
} = {}) {
  const generatedAt = iso(now);
  if (!generatedAt) throw new Error(`Invalid refresh time ${now}`);
  const source = registry?.sources?.find((item) => item.id === "gdacs-event-list");
  if (!source || !String(source.endpoint).startsWith("https://")) throw new Error("GDACS source registry entry is missing or invalid");
  const requestUrl = buildRequestUrl(source, generatedAt);
  let responsePayload = payload;
  if (!responsePayload) {
    const response = await fetchImpl(requestUrl, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`GDACS refresh failed with HTTP ${response.status}`);
    responsePayload = await response.json();
  }
  if (!responsePayload || !Array.isArray(responsePayload.features)) throw new Error("GDACS response is not a GeoJSON FeatureCollection");

  const contentHash = sha256(responsePayload);
  const snapshot = { id: `climate-snapshot:gdacs:${contentHash.slice(0, 24)}`, sourceId: source.id, sourceUrl: requestUrl, fetchedAt: generatedAt, contentHash };
  const { hazards, warnings } = normalizeGdacs(responsePayload, snapshot, generatedAt);
  const impacts = deriveClimateImpacts(hazards, targetData);
  const readModel = {
    schemaVersion: "climate-read-model-v1",
    asOf: generatedAt,
    generatedAt,
    areaOfInterest: { ...CLIMATE_AOI },
    sourceStatus: {
      sourceId: "gdacs-event-list",
      name: "GDACS",
      sourceUrl: requestUrl,
      status: "fresh",
      checkedAt: generatedAt,
      lastSuccessfulAt: generatedAt,
      freshnessHours: 6,
      contentHash,
      error: null,
    },
    hazards,
    impacts,
  };
  const validationErrors = validateClimateReadModel(readModel, { targetData });
  const baseFingerprint = computeClimateRefreshFingerprint({ registry, targetData });
  const runId = `climate-refresh:${generatedAt}:${contentHash.slice(0, 12)}`;
  const candidates = { schemaVersion: "climate-candidates-v1", runId, baseFingerprint, readModel };
  const report = {
    schemaVersion: "climate-refresh-v1",
    runId,
    asOf: generatedAt,
    baseFingerprint,
    request: { sourceId: source.id, url: requestUrl, eventTypes: source.eventTypes, windowDays: 7 },
    snapshots: [snapshot],
    counts: { sourceFeatures: responsePayload.features.length, hazards: hazards.length, impacts: impacts.length },
    warnings,
    validation: { errors: validationErrors },
    promotion: { status: validationErrors.length ? "rejected" : "validated", calculatedAt: generatedAt },
    readModel,
  };
  if (validationErrors.length) throw new Error(`Climate refresh validation failed:\n- ${validationErrors.join("\n- ")}`);

  if (!dryRun) {
    fs.mkdirSync(PATHS.climateSnapshotDir, { recursive: true });
    writeJson(path.join(PATHS.climateSnapshotDir, `${snapshot.id.replace(/[^a-z0-9.-]+/gi, "-")}.json`), { ...snapshot, payload: responsePayload });
    writeJson(PATHS.climateCandidates, candidates);
    writeJson(PATHS.climateRefreshReport, report);
  }
  return { candidates, report, readModel, warnings };
}

function parseArgs(argv) {
  const args = { dryRun: false, fixture: null, now: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--dry-run") args.dryRun = true;
    else if (argv[index] === "--fixture") args.fixture = argv[++index];
    else if (argv[index] === "--now") args.now = argv[++index];
  }
  return args;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const payload = args.fixture ? readJson(path.resolve(PATHS.root, args.fixture)) : null;
  const result = await runClimateRefresh({ now: args.now ?? new Date().toISOString(), payload, dryRun: args.dryRun });
  console.log(`climate:refresh ${args.dryRun ? "dry-run " : ""}validated ${result.readModel.hazards.length} hazard(s) and ${result.readModel.impacts.length} impact(s)`);
  for (const warning of result.warnings) console.warn(`- ${warning}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
