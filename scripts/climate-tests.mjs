import assert from "node:assert/strict";
import path from "node:path";
import { PATHS, readJson } from "./daily-common.mjs";
import {
  deriveClimateImpacts,
  readClimateTargetData,
  runClimateRefresh,
  validateClimateReadModel,
} from "./climate-refresh.mjs";
import { prepareClimatePromotion } from "./climate-promote.mjs";
import { resolveClimateFreshness } from "../src/domain/climate.ts";
import { createClimateHazardLayers } from "../src/layers/climateHazards.ts";

const NOW = "2026-08-20T04:00:00.000Z";
const fixture = readJson(path.join(PATHS.root, "scripts/fixtures/climate/valid.geojson"));
const registry = readJson(PATHS.climateSourceRegistry);
const targetData = readClimateTargetData();

const refreshed = await runClimateRefresh({ now: NOW, payload: fixture, registry, targetData, dryRun: true });
assert.equal(refreshed.readModel.hazards.length, 2, "AOI filtering should retain two valid hazards");
assert(refreshed.warnings.some((warning) => warning.includes("invalid geometry")), "malformed geometry should be reported");
assert.deepEqual(validateClimateReadModel(refreshed.readModel, { targetData }), [], "valid climate read model should pass");

const flood = refreshed.readModel.hazards.find((hazard) => hazard.type === "flood");
const cyclone = refreshed.readModel.hazards.find((hazard) => hazard.type === "tropical-cyclone");
assert(flood && cyclone, "fixture should normalize both flood and cyclone hazards");
assert.equal(cyclone.impactAssessment, "unavailable", "point-only cyclone must not claim footprint impacts");
assert(!refreshed.readModel.impacts.some((impact) => impact.hazardId === cyclone.id), "point-only cyclone must not derive impacts");
assert(refreshed.readModel.impacts.some((impact) => impact.hazardId === flood.id && impact.targetType === "port" && impact.targetId === "singapore"), "Singapore port should be inside the flood footprint");
assert(refreshed.readModel.impacts.some((impact) => impact.hazardId === flood.id && impact.targetType === "corridor" && impact.targetId === "malacca"), "Malacca corridor should intersect the flood footprint");
assert(refreshed.readModel.impacts.some((impact) => impact.hazardId === flood.id && impact.targetType === "energy-entity"), "energy entities should be evaluated against footprints");
assert(refreshed.readModel.impacts.some((impact) => impact.hazardId === flood.id && impact.targetType === "exposure-trace"), "selected exposure routes should be evaluated against footprints");

const pointOnlyImpacts = deriveClimateImpacts([cyclone], targetData);
assert.deepEqual(pointOnlyImpacts, [], "point-only derivation must remain empty");

const emptyRefresh = await runClimateRefresh({
  now: NOW,
  payload: { type: "FeatureCollection", features: [] },
  registry,
  targetData,
  dryRun: true,
});
assert.deepEqual(emptyRefresh.readModel.hazards, [], "successful empty source response should publish an empty hazard list");
assert.equal(emptyRefresh.readModel.sourceStatus.status, "fresh", "successful empty response should still be fresh");

const validPromotion = prepareClimatePromotion({
  registry,
  targetData,
  existingReadModel: readJson(PATHS.climateReadModel),
  candidateEnvelopeOverride: refreshed,
});
assert(validPromotion.promoted, `valid climate candidate should promote: ${validPromotion.errors.join("; ")}`);

const mismatchedRun = structuredClone(refreshed);
mismatchedRun.report.runId = "different-run";
const rejectedRun = prepareClimatePromotion({ registry, targetData, existingReadModel: readJson(PATHS.climateReadModel), candidateEnvelopeOverride: mismatchedRun });
assert(!rejectedRun.promoted && rejectedRun.errors.some((error) => error.includes("runIds differ")), "run ID mismatch should fail closed");

const unknownTarget = structuredClone(refreshed);
unknownTarget.candidates.readModel.impacts[0].targetId = "missing-target";
unknownTarget.report.readModel = structuredClone(unknownTarget.candidates.readModel);
const rejectedTarget = prepareClimatePromotion({ registry, targetData, existingReadModel: readJson(PATHS.climateReadModel), candidateEnvelopeOverride: unknownTarget });
assert(!rejectedTarget.promoted && rejectedTarget.errors.some((error) => error.includes("unknown target")), "unknown impact target should fail closed");

assert.equal(resolveClimateFreshness(refreshed.readModel.sourceStatus, Date.parse(NOW) + 5 * 3_600_000), "fresh");
assert.equal(resolveClimateFreshness(refreshed.readModel.sourceStatus, Date.parse(NOW) + 7 * 3_600_000), "stale");
assert(
  ["fresh", "not-run"].includes(resolveClimateFreshness(readJson(PATHS.climateReadModel).sourceStatus, Date.parse(NOW))),
  "promoted climate data may be fresh; an unpromoted baseline may remain not-run",
);

const layers = createClimateHazardLayers(refreshed.readModel, new Set(["red", "orange"]), flood.id, Date.parse(NOW));
assert.equal(layers.length, 3, "climate layer factory should return footprint, centroid, and selected-impact layers");
assert.equal(layers[1].props.data.length, 2, "default red/orange filters should include both fixture hazards");
assert(layers[2].props.data.every((impact) => impact.hazardId === flood.id), "impact layer should only display the selected hazard targets");

console.log("climate:test passed");
