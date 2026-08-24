import fs from "node:fs";
import {
  PATHS,
  readJson,
} from "./daily-common.mjs";
import {
  computeClimateRefreshFingerprint,
  readClimateTargetData,
  validateClimateReadModel,
} from "./climate-refresh.mjs";

function candidateEnvelope() {
  const candidatesPresent = fs.existsSync(PATHS.climateCandidates);
  const reportPresent = fs.existsSync(PATHS.climateRefreshReport);
  if (!candidatesPresent && !reportPresent) return null;
  if (candidatesPresent !== reportPresent) {
    return { artifactError: "Climate candidates and refresh report must be present as a complete pair; rerun climate:refresh" };
  }
  return {
    candidates: readJson(PATHS.climateCandidates),
    report: readJson(PATHS.climateRefreshReport),
  };
}

export function prepareClimatePromotion({
  registry = readJson(PATHS.climateSourceRegistry),
  targetData = readClimateTargetData(),
  existingReadModel = readJson(PATHS.climateReadModel),
  candidateEnvelopeOverride = undefined,
} = {}) {
  const envelope = candidateEnvelopeOverride === undefined ? candidateEnvelope() : candidateEnvelopeOverride;
  if (envelope?.artifactError) {
    return { promoted: false, readModel: existingReadModel, report: null, errors: [envelope.artifactError], warnings: [] };
  }
  if (!envelope) {
    return {
      promoted: false,
      readModel: existingReadModel,
      report: null,
      errors: validateClimateReadModel(existingReadModel, { targetData }),
      warnings: ["No climate candidate/report pair is present; the promoted climate model is unchanged."],
    };
  }

  const { candidates, report } = envelope;
  const errors = [];
  if (candidates?.schemaVersion !== "climate-candidates-v1") errors.push("Climate candidates schemaVersion is invalid");
  if (report?.schemaVersion !== "climate-refresh-v1") errors.push("Climate refresh report schemaVersion is invalid");
  if (candidates?.runId !== report?.runId) errors.push("Climate candidate/report runIds differ");
  if (candidates?.baseFingerprint !== report?.baseFingerprint) errors.push("Climate candidate/report fingerprints differ");
  const currentFingerprint = computeClimateRefreshFingerprint({ registry, targetData });
  if (candidates?.baseFingerprint !== currentFingerprint) errors.push("Climate refresh is stale relative to the source registry or impact targets; rerun climate:refresh");
  if (report?.promotion?.status !== "validated") errors.push(`Climate refresh promotion status is ${report?.promotion?.status ?? "missing"}, not validated`);
  if ((report?.validation?.errors ?? []).length) errors.push(...report.validation.errors.map((error) => `refresh validation: ${error}`));
  if (JSON.stringify(candidates?.readModel ?? null) !== JSON.stringify(report?.readModel ?? null)) errors.push("Climate candidate read model does not match the refresh report");
  errors.push(...validateClimateReadModel(candidates?.readModel ?? {}, { targetData }));

  return {
    promoted: errors.length === 0,
    readModel: errors.length === 0 ? candidates.readModel : existingReadModel,
    report,
    errors,
    warnings: report?.warnings ?? [],
  };
}
