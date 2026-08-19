import { calculateFlowPressure } from "./flowPressure";
import { rankAlternatives } from "./alternatives";
import type {
  CommercialEvaluation,
  DerivedCommercialMetric,
  EvidenceReference,
  ExposureTrace,
  ExposureTraceData,
  ObservedCommercialInput,
  PublicEntity,
  TraceCounterparty,
  TraceHop,
  TraceMetric,
} from "../types";
import type {
  EnergyAlternative,
  EnergyLngAssessment,
  EnergyLngCadence,
  EnergyLngCommercialEvaluation,
  EnergyLngConfidence,
  EnergyLngDomain,
  EnergyLngEntity,
  EnergyLngEntityKind,
  EnergyLngHop,
  EnergyLngObservation,
  EnergyLngRecordMeta,
  EnergyLngRecordStatus,
  EnergyLngRelationship,
  EnergyLngRelationshipType,
  EnergyLngRiskControl,
  EnergyLngSource,
} from "../types/energyLng";
import type { EnergyLngNormalizedCandidate } from "../types/energyLngPipeline";

type LegacyMetric = TraceMetric & { cadence?: EnergyLngCadence };

const ENTITY_KIND_OVERRIDES: Record<string, EnergyLngEntityKind> = {
  "ras-laffan": "export-terminal",
  hormuz: "chokepoint",
  jkm: "benchmark",
  ttf: "benchmark",
  "asia-crude-demand": "demand-region",
};

const LEGACY_ENTITY_KIND_MAP: Record<PublicEntity["kind"], EnergyLngEntityKind> = {
  producer: "producer",
  facility: "facility",
  carrier: "carrier",
  terminal: "chokepoint",
  market: "market",
  buyer: "buyer",
  supplier: "producer",
  portfolio: "buyer",
  region: "demand-region",
};

const CANONICAL_TO_LEGACY_ENTITY_KIND: Record<EnergyLngEntityKind, PublicEntity["kind"]> = {
  producer: "producer",
  field: "facility",
  "liquefaction-train": "facility",
  "export-terminal": "facility",
  vessel: "carrier",
  carrier: "carrier",
  port: "facility",
  "regas-terminal": "terminal",
  storage: "facility",
  route: "terminal",
  corridor: "terminal",
  chokepoint: "terminal",
  buyer: "buyer",
  market: "market",
  "demand-region": "region",
  contract: "supplier",
  event: "facility",
  benchmark: "market",
  facility: "facility",
};

const STATUS_PRIORITY: Record<EnergyLngRecordStatus, number> = {
  unavailable: 0,
  inferred: 1,
  carried: 2,
  confirmed: 3,
};

const CONFIDENCE_PRIORITY: Record<EnergyLngConfidence, number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function dateToTimestamp(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (value.includes("T")) return value;
  return `${value}T00:00:00Z`;
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function traceObservationId(traceId: string, inputId: string): string {
  return `observation:${traceId}:${inputId}`;
}

function commercialObservationId(inputId: string): string {
  return `commercial-observation:${inputId}`;
}

function legacyObservationId(observationId: string): string {
  if (observationId.startsWith("commercial-observation:")) {
    return observationId.slice("commercial-observation:".length);
  }
  if (observationId.startsWith("observation:")) {
    const traceScopedId = observationId.slice("observation:".length);
    return traceScopedId.slice(traceScopedId.indexOf(":") + 1);
  }
  return observationId;
}

function statusFromLegacy(status: LegacyMetric["status"]): EnergyLngRecordStatus {
  return status === "confirmed" || status === "carried" || status === "unavailable" ? status : "inferred";
}

function confidenceFromStatus(status: EnergyLngRecordStatus): EnergyLngConfidence {
  if (status === "confirmed") return "high";
  if (status === "carried") return "medium";
  if (status === "inferred") return "low";
  return "unknown";
}

function strongerStatus(left: EnergyLngRecordStatus, right: EnergyLngRecordStatus): EnergyLngRecordStatus {
  return STATUS_PRIORITY[left] >= STATUS_PRIORITY[right] ? left : right;
}

function strongerConfidence(left: EnergyLngConfidence, right: EnergyLngConfidence): EnergyLngConfidence {
  return CONFIDENCE_PRIORITY[left] >= CONFIDENCE_PRIORITY[right] ? left : right;
}

function recordMeta(
  asOf: string,
  sourceIds: string[],
  status: EnergyLngRecordStatus,
  confidence: EnergyLngConfidence,
  unit: string | null = null,
  validFrom: string | null = asOf,
): EnergyLngRecordMeta {
  return {
    asOf,
    validFrom,
    validTo: null,
    unit,
    sourceIds: [...new Set(sourceIds)],
    status,
    confidence,
  };
}

function sourceStatusForEvidence(sourceIds: string[], sourcesById: Map<string, EnergyLngSource>): EnergyLngRecordStatus {
  const statuses = sourceIds.map((id) => sourcesById.get(id)?.status).filter(Boolean);
  if (statuses.includes("confirmed")) return "confirmed";
  if (statuses.includes("carried")) return "carried";
  return sourceIds.length > 0 ? "inferred" : "inferred";
}

function sourceConfidenceForEvidence(sourceIds: string[], sourcesById: Map<string, EnergyLngSource>): EnergyLngConfidence {
  const status = sourceStatusForEvidence(sourceIds, sourcesById);
  return confidenceFromStatus(status);
}

function toSource(evidence: EvidenceReference, fallbackAsOf: string): EnergyLngSource {
  return {
    id: evidence.id,
    title: evidence.title,
    publisher: evidence.publisher,
    url: evidence.url,
    publishedAt: evidence.publishedAt,
    retrievedAt: dateToTimestamp(evidence.lastChecked, fallbackAsOf),
    kind: evidence.kind,
    cadence: evidence.cadence,
    maxAgeDays: evidence.maxAgeDays,
    status: evidence.status,
    note: evidence.note,
    provider: evidence.publisher,
  };
}

function canonicalEntityKind(entity: PublicEntity): EnergyLngEntityKind {
  return ENTITY_KIND_OVERRIDES[entity.id] ?? LEGACY_ENTITY_KIND_MAP[entity.kind];
}

function addEntityEvidence(map: Map<string, Set<string>>, entityIds: string[], evidenceIds: string[]) {
  for (const entityId of entityIds) {
    const current = map.get(entityId) ?? new Set<string>();
    evidenceIds.forEach((id) => current.add(id));
    map.set(entityId, current);
  }
}

function traceEvidenceIds(trace: ExposureTrace): string[] {
  return [
    ...trace.hops.flatMap((hop) => hop.evidenceIds),
    ...trace.counterparties.flatMap((counterparty) => counterparty.evidenceIds),
  ];
}

function observationFromMetric(
  id: string,
  metric: LegacyMetric,
  entityIds: string[],
  evidenceIds: string[],
  asOf: string,
): EnergyLngObservation {
  const status = statusFromLegacy(metric.status);
  return {
    id,
    label: metric.label,
    entityIds: [...new Set(entityIds)],
    value: metric.value,
    low: metric.low,
    high: metric.high,
    unit: metric.unit ?? null,
    sourceName: metric.source || undefined,
    sourceDate: metric.sourceDate || undefined,
    observedAt: metric.observedAt,
    cadence: metric.cadence,
    freshnessWindowDays: metric.maxAgeDays,
    carryReason: metric.carryReason,
    missingReason: metric.missingReason,
    evidenceIds: [...new Set(evidenceIds)],
    machineEvidenceIds: [...new Set(metric.machineEvidenceIds ?? [])],
    record: recordMeta(
      asOf,
      evidenceIds,
      status,
      confidenceFromStatus(status),
      metric.unit ?? null,
      metric.sourceDate ? dateToTimestamp(metric.sourceDate, asOf) : asOf,
    ),
  };
}

function mergeObservation(existing: EnergyLngObservation, incoming: EnergyLngObservation): EnergyLngObservation {
  const status = strongerStatus(existing.record.status, incoming.record.status);
  const confidence = strongerConfidence(existing.record.confidence, incoming.record.confidence);
  const evidenceIds = [...new Set([...existing.evidenceIds, ...incoming.evidenceIds])];
  const machineEvidenceIds = [...new Set([
    ...(existing.machineEvidenceIds ?? []),
    ...(incoming.machineEvidenceIds ?? []),
  ])];
  return {
    ...existing,
    entityIds: [...new Set([...existing.entityIds, ...incoming.entityIds])],
    value: existing.value !== undefined ? existing.value : incoming.value,
    low: existing.low ?? incoming.low,
    high: existing.high ?? incoming.high,
    change: existing.change ?? incoming.change,
    changePct: existing.changePct ?? incoming.changePct,
    unit: existing.unit ?? incoming.unit,
    sourceName: existing.sourceName ?? incoming.sourceName,
    sourceDate: existing.sourceDate ?? incoming.sourceDate,
    observedAt: existing.observedAt ?? incoming.observedAt,
    cadence: existing.cadence ?? incoming.cadence,
    freshnessWindowDays: Math.min(existing.freshnessWindowDays, incoming.freshnessWindowDays),
    carryReason: existing.carryReason ?? incoming.carryReason,
    missingReason: existing.missingReason ?? incoming.missingReason,
    evidenceIds,
    machineEvidenceIds,
    record: {
      ...existing.record,
      sourceIds: evidenceIds,
      status,
      confidence,
    },
  };
}

function statusForRecords(records: EnergyLngRecordMeta[], sourceIds: string[]): EnergyLngRecordStatus {
  const statuses = records.map((record) => record.status);
  if (statuses.includes("confirmed")) return "confirmed";
  if (statuses.includes("carried")) return "carried";
  if (statuses.includes("unavailable")) return "unavailable";
  return sourceIds.length > 0 ? "inferred" : "inferred";
}

function confidenceForRecords(records: EnergyLngRecordMeta[], status: EnergyLngRecordStatus): EnergyLngConfidence {
  if (records.length === 0) return confidenceFromStatus(status);
  return records.reduce<EnergyLngConfidence>(
    (confidence, record) => strongerConfidence(confidence, record.confidence),
    confidenceFromStatus(status),
  );
}

function canonicalHop(
  traceId: string,
  hop: TraceHop,
  observationsById: Map<string, EnergyLngObservation>,
  asOf: string,
): EnergyLngHop {
  const observations = hop.metrics
    .map((metric) => observationsById.get(traceObservationId(traceId, metric.inputId)))
    .filter((observation): observation is EnergyLngObservation => Boolean(observation));
  const sourceIds = [...new Set([
    ...hop.evidenceIds,
    ...observations.flatMap((observation) => observation.evidenceIds),
  ])];
  const status = statusForRecords(observations.map((observation) => observation.record), sourceIds);
  return {
    id: hop.id,
    stage: hop.stage,
    label: hop.label,
    summary: hop.summary,
    direction: hop.direction,
    entityIds: hop.entityIds,
    observationIds: hop.metrics.map((metric) => traceObservationId(traceId, metric.inputId)),
    evidenceIds: hop.evidenceIds,
    record: recordMeta(asOf, sourceIds, status, confidenceForRecords(observations.map((observation) => observation.record), status)),
  };
}

function canonicalCounterparty(counterparty: TraceCounterparty, asOf: string, sourcesById: Map<string, EnergyLngSource>) {
  const status = sourceStatusForEvidence(counterparty.evidenceIds, sourcesById);
  return {
    entityId: counterparty.entityId,
    role: counterparty.role,
    relationship: counterparty.relationship,
    exposureDirection: counterparty.exposureDirection,
    summary: counterparty.summary,
    publicObservation: counterparty.publicObservation,
    evidenceIds: counterparty.evidenceIds,
    record: recordMeta(asOf, counterparty.evidenceIds, status, sourceConfidenceForEvidence(counterparty.evidenceIds, sourcesById)),
  };
}

function canonicalCommercialEvaluation(
  evaluation: CommercialEvaluation,
  asOf: string,
): EnergyLngCommercialEvaluation {
  return {
    mode: evaluation.mode,
    observedInputIds: evaluation.observedInputIds,
    requiredInputIds: evaluation.requiredInputIds,
    originInputId: evaluation.originInputId,
    destinationInputId: evaluation.destinationInputId,
    costInputIds: evaluation.costInputIds,
    derivedMetrics: evaluation.derivedMetrics.map((metric) => ({
      id: metric.metricId,
      label: metric.label,
      formulaId: metric.formulaId,
      inputObservationIds: metric.inputIds.map(commercialObservationId),
      unit: metric.unit,
      calculatedAt: metric.calculatedAt,
      status: metric.status,
      unroundedValue: metric.unroundedValue,
      displayValue: metric.displayValue,
      unroundedLow: metric.unroundedLow,
      unroundedHigh: metric.unroundedHigh,
      displayLow: metric.displayLow,
      displayHigh: metric.displayHigh,
      missingInputIds: metric.missingInputIds,
    })),
    dataStatus: evaluation.dataStatus,
    residualStatus: evaluation.residualStatus,
    missingInputIds: evaluation.missingInputIds,
    riskControls: evaluation.riskControls.map<EnergyLngRiskControl>((control) => ({
      id: control.id,
      label: control.label,
      status: control.status,
      summary: control.summary,
      evidenceIds: control.evidenceIds,
    })),
  };
}

function addRelationship(
  relationshipsById: Map<string, EnergyLngRelationship>,
  relationship: EnergyLngRelationship,
) {
  const existing = relationshipsById.get(relationship.id);
  if (!existing) {
    relationshipsById.set(relationship.id, relationship);
    return;
  }

  const sourceIds = [...new Set([...existing.evidenceIds, ...relationship.evidenceIds])];
  const status = strongerStatus(existing.record.status, relationship.record.status);
  relationshipsById.set(relationship.id, {
    ...existing,
    evidenceIds: sourceIds,
    record: {
      ...existing.record,
      sourceIds,
      status,
      confidence: strongerConfidence(existing.record.confidence, relationship.record.confidence),
    },
  });
}

function relationship(
  type: EnergyLngRelationshipType,
  fromEntityId: string,
  toEntityId: string,
  evidenceIds: string[],
  asOf: string,
  sourcesById: Map<string, EnergyLngSource>,
  note?: string,
): EnergyLngRelationship {
  const status = type === "route-segment" || type === "operates"
    ? "inferred"
    : sourceStatusForEvidence(evidenceIds, sourcesById);
  return {
    id: `relationship:${type}:${fromEntityId}:${toEntityId}`,
    type,
    fromEntityId,
    toEntityId,
    evidenceIds: [...new Set(evidenceIds)],
    note,
    record: recordMeta(asOf, evidenceIds, status, status === "inferred" ? "low" : sourceConfidenceForEvidence(evidenceIds, sourcesById)),
  };
}

function relationshipTypeForCounterparty(counterparty: TraceCounterparty): EnergyLngRelationshipType {
  if (counterparty.relationship === "public-contract") return "contracted-supply";
  if (counterparty.relationship === "operational-dependency") return "operational-dependency";
  return "market-sensitivity";
}

function migratedAlternatives(
  trace: ExposureTrace,
  asOf: string,
  sourcesById: Map<string, EnergyLngSource>,
): EnergyAlternative[] {
  const existing = trace.alternatives ?? [];
  if (existing.length > 0) return rankAlternatives(existing);
  if (trace.commodity !== "lng" || !sourcesById.has("e-ttf")) return [];

  return rankAlternatives([{
    id: `alternative:${trace.id}:ttf-market`,
    kind: "market",
    label: "European TTF",
    summary: "Potential destination market for flexible LNG; the reviewed TTF observation confirms market context only.",
    feasibility: "potential",
    rank: null,
    score: null,
    constraintSummary: "Cargo availability, route cost, regasification capacity, sanctions/insurance constraints and contract flexibility are not verified.",
    evidenceIds: ["e-ttf"],
    record: recordMeta(asOf, ["e-ttf"], "inferred", "low"),
  }]);
}

function legacyFormulaId(value: string): DerivedCommercialMetric["formulaId"] {
  if (value === "destination-minus-origin" || value === "sum-transformation-costs" || value === "gross-minus-costs") {
    return value;
  }
  return "gross-minus-costs";
}

function toTraceMetric(observation: EnergyLngObservation, sourcesById: Map<string, EnergyLngSource>): TraceMetric {
  const status: TraceMetric["status"] = observation.record.status === "confirmed"
    ? "confirmed"
    : observation.record.status === "carried"
      ? "carried"
      : "unavailable";
  return {
    inputId: legacyObservationId(observation.id),
    label: observation.label,
    value: observation.value,
    low: observation.low,
    high: observation.high,
    unit: observation.unit ?? undefined,
    status,
    source: observation.sourceName ?? "",
    sourceDate: observation.sourceDate ?? "",
    observedAt: observation.observedAt,
    maxAgeDays: observation.freshnessWindowDays,
    cadence: observation.cadence,
    ...(observation.machineEvidenceIds?.length ? { machineEvidenceIds: observation.machineEvidenceIds } : {}),
    carryReason: observation.carryReason,
    missingReason: observation.missingReason,
  };
}

function toLegacyCommercialInput(
  input: EnergyLngDomain["commercialInputs"][number],
  observationsById: Map<string, EnergyLngObservation>,
  sourcesById: Map<string, EnergyLngSource>,
): ObservedCommercialInput {
  const observation = observationsById.get(input.observationId);
  const metric = observation
    ? toTraceMetric(observation, sourcesById)
    : {
        inputId: input.id,
        label: input.label,
        status: "unavailable" as const,
        source: "",
        sourceDate: "",
        maxAgeDays: 1,
      };
  return {
    ...metric,
    inputId: input.id,
    label: input.label,
    commodity: input.commodity,
    role: input.role,
    evidenceIds: observation?.evidenceIds ?? [],
    requiredForCalculation: input.requiredForCalculation,
  };
}

function toLegacyCommercialEvaluation(evaluation: EnergyLngCommercialEvaluation): CommercialEvaluation {
  return {
    mode: evaluation.mode,
    observedInputIds: evaluation.observedInputIds,
    requiredInputIds: evaluation.requiredInputIds,
    originInputId: evaluation.originInputId,
    destinationInputId: evaluation.destinationInputId,
    costInputIds: evaluation.costInputIds,
    derivedMetrics: evaluation.derivedMetrics.map((metric) => ({
      metricId: metric.id,
      label: metric.label,
      formulaId: legacyFormulaId(metric.formulaId),
      inputIds: metric.inputObservationIds.map(legacyObservationId),
      unit: metric.unit,
      calculatedAt: metric.calculatedAt,
      status: metric.status,
      unroundedValue: metric.unroundedValue,
      displayValue: metric.displayValue,
      unroundedLow: metric.unroundedLow,
      unroundedHigh: metric.unroundedHigh,
      displayLow: metric.displayLow,
      displayHigh: metric.displayHigh,
      missingInputIds: metric.missingInputIds,
    })),
    dataStatus: evaluation.dataStatus,
    residualStatus: evaluation.residualStatus,
    missingInputIds: evaluation.missingInputIds,
    riskControls: evaluation.riskControls,
  };
}

function toLegacySource(source: EnergyLngSource): EvidenceReference {
  return {
    id: source.id,
    title: source.title,
    publisher: source.publisher,
    url: source.url,
    publishedAt: source.publishedAt,
    lastChecked: dateOnly(source.retrievedAt),
    kind: source.kind,
    cadence: source.cadence,
    maxAgeDays: source.maxAgeDays,
    status: source.status,
    note: source.note,
  };
}

export function toEnergyLngDomain(legacy: ExposureTraceData): EnergyLngDomain {
  const sources = legacy.evidence.map((evidence) => toSource(evidence, legacy.asOf));
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const evidenceByEntity = new Map<string, Set<string>>();
  for (const trace of legacy.traces) {
    for (const hop of trace.hops) addEntityEvidence(evidenceByEntity, hop.entityIds, hop.evidenceIds);
    for (const counterparty of trace.counterparties) addEntityEvidence(evidenceByEntity, [counterparty.entityId], counterparty.evidenceIds);
  }

  const entities: EnergyLngEntity[] = legacy.entities.map((entity) => {
    const evidenceIds = [...(evidenceByEntity.get(entity.id) ?? [])];
    const status = sourceStatusForEvidence(evidenceIds, sourcesById);
    return {
      id: entity.id,
      kind: canonicalEntityKind(entity),
      name: entity.name,
      shortName: entity.shortName,
      country: entity.country,
      coordinates: entity.coordinates,
      description: entity.description,
      record: recordMeta(legacy.asOf, evidenceIds, status, sourceConfidenceForEvidence(evidenceIds, sourcesById)),
    };
  });
  const entityKindsById = new Map(entities.map((entity) => [entity.id, entity.kind]));

  const observationsById = new Map<string, EnergyLngObservation>();
  const addMetric = (id: string, metric: LegacyMetric, entityIds: string[], evidenceIds: string[]) => {
    const observation = observationFromMetric(id, metric, entityIds, evidenceIds, legacy.asOf);
    const existing = observationsById.get(observation.id);
    observationsById.set(observation.id, existing ? mergeObservation(existing, observation) : observation);
  };
  for (const trace of legacy.traces) {
    for (const hop of trace.hops) {
      for (const metric of hop.metrics) addMetric(traceObservationId(trace.id, metric.inputId), metric, hop.entityIds, hop.evidenceIds);
    }
  }
  for (const input of legacy.commercialInputs) addMetric(commercialObservationId(input.inputId), input, [], input.evidenceIds);

  const commercialInputs = legacy.commercialInputs.map<EnergyLngDomain["commercialInputs"][number]>((input) => ({
    id: input.inputId,
    label: input.label,
    commodity: input.commodity,
    role: input.role,
      observationId: commercialObservationId(input.inputId),
    requiredForCalculation: input.requiredForCalculation,
  }));

  const relationshipsById = new Map<string, EnergyLngRelationship>();
  for (const trace of legacy.traces) {
    const traceEvidence = traceEvidenceIds(trace);
    for (let index = 0; index < trace.routeEntityIds.length - 1; index += 1) {
      const fromEntityId = trace.routeEntityIds[index];
      const toEntityId = trace.routeEntityIds[index + 1];
      if (!entityKindsById.has(fromEntityId) || !entityKindsById.has(toEntityId)) continue;
      addRelationship(
        relationshipsById,
        relationship(
          "route-segment",
          fromEntityId,
          toEntityId,
          traceEvidence,
          legacy.asOf,
          sourcesById,
          "Scenario route edge migrated from the reviewed trace fixture; replace with a normalised route record when available.",
        ),
      );
    }

    for (const hop of trace.hops) {
      const producer = hop.entityIds.find((entityId) => entityKindsById.get(entityId) === "producer");
      const facility = hop.entityIds.find((entityId) => {
        const kind = entityKindsById.get(entityId);
        return kind === "facility" || kind === "export-terminal";
      });
      if (producer && facility) {
        addRelationship(
          relationshipsById,
          relationship("operates", producer, facility, hop.evidenceIds, legacy.asOf, sourcesById, "Operational relationship inferred from the source-backed trace hop."),
        );
      }
    }

    const buyer = trace.counterparties.find((counterparty) => counterparty.role === "buyer");
    const suppliers = trace.counterparties.filter((counterparty) => counterparty.role === "supplier" || counterparty.role === "carrier");
    if (buyer) {
      for (const supplier of suppliers) {
        addRelationship(
          relationshipsById,
          relationship(
            relationshipTypeForCounterparty(supplier),
            supplier.entityId,
            buyer.entityId,
            [...supplier.evidenceIds, ...buyer.evidenceIds],
            legacy.asOf,
            sourcesById,
            "Relationship type is constrained to the approved public observation; it is not a customer exposure claim.",
          ),
        );
      }
    }
  }

  const assessments: EnergyLngAssessment[] = legacy.traces.map((trace) => {
    const hops = trace.hops.map((hop) => canonicalHop(trace.id, hop, observationsById, legacy.asOf));
    const counterparties = trace.counterparties.map((counterparty) => canonicalCounterparty(counterparty, legacy.asOf, sourcesById));
    const alternatives = migratedAlternatives(trace, legacy.asOf, sourcesById);
    const baseAssessment = {
      id: `assessment:${trace.id}:${legacy.asOf}`,
      traceId: trace.id,
      commodity: trace.commodity,
      title: trace.title,
      kicker: trace.kicker,
      headline: trace.headline,
      routeEntityIds: trace.routeEntityIds,
      hops,
      counterparties,
      commercialEvaluation: canonicalCommercialEvaluation(trace.commercialEvaluation, legacy.asOf),
      alternatives,
      portfolioAction: trace.portfolioAction,
      watchItems: trace.watchItems,
    };
    const flowPressure = calculateFlowPressure(baseAssessment, observationsById, entityKindsById, legacy.asOf);
    const sourceIds = [...new Set([
      ...hops.flatMap((hop) => hop.evidenceIds),
      ...counterparties.flatMap((counterparty) => counterparty.evidenceIds),
      ...flowPressure.evidenceIds,
    ])];
    const status = statusForRecords(
      [...hops, ...counterparties].map((record) => record.record),
      sourceIds,
    );
    return {
      ...baseAssessment,
      flowPressure,
      record: recordMeta(legacy.asOf, sourceIds, status, confidenceForRecords([...hops, ...counterparties].map((record) => record.record), status)),
    };
  });

  return {
    schemaVersion: "energy-lng-domain-v1",
    readModelVersion: "energy-lng-read-model-v1",
    asOf: legacy.asOf,
    day: legacy.day,
    headline: legacy.headline,
    sources,
    machineEvidence: legacy.machineEvidence,
    entities,
    relationships: [...relationshipsById.values()],
    observations: [...observationsById.values()],
    commercialInputs,
    assessments,
  };
}

function candidateTargetMatches(observation: EnergyLngObservation, candidate: EnergyLngNormalizedCandidate): boolean {
  const inputId = legacyObservationId(observation.id);
  return candidate.targetInputIds.includes(inputId) || candidate.targetCommercialInputIds.includes(inputId);
}

function applyCandidateToObservation(
  observation: EnergyLngObservation,
  candidate: EnergyLngNormalizedCandidate,
  asOf: string,
): EnergyLngObservation {
  const next: EnergyLngObservation = {
    ...observation,
    value: candidate.value,
    low: candidate.low,
    high: candidate.high,
    change: candidate.change,
    changePct: candidate.changePct,
    unit: candidate.unit,
    sourceName: candidate.status === "unavailable" ? undefined : candidate.provider,
    sourceDate: candidate.status === "unavailable" ? undefined : candidate.observationDate ?? undefined,
    observedAt: candidate.status === "unavailable" ? undefined : candidate.observedAt ?? undefined,
    cadence: candidate.cadence,
    freshnessWindowDays: candidate.freshnessWindowDays,
    carryReason: candidate.carryReason,
    missingReason: candidate.missingReason,
    evidenceIds: [...new Set(candidate.evidenceIds)],
    machineEvidenceIds: [...new Set(candidate.machineEvidenceIds ?? [])],
    lineage: candidate.lineage,
    record: {
      ...observation.record,
      asOf,
      validFrom: candidate.observationDate ? dateToTimestamp(candidate.observationDate, asOf) : null,
      unit: candidate.unit,
      sourceIds: [...new Set(candidate.evidenceIds)],
      status: candidate.status,
      confidence: candidate.confidence,
    },
  };
  if (candidate.value === undefined) delete next.value;
  if (candidate.low === undefined) delete next.low;
  if (candidate.high === undefined) delete next.high;
  if (candidate.change === undefined) delete next.change;
  if (candidate.changePct === undefined) delete next.changePct;
  if (candidate.carryReason === undefined) delete next.carryReason;
  if (candidate.missingReason === undefined) delete next.missingReason;
  if (candidate.observationDate === null) delete next.sourceDate;
  if (candidate.observedAt === null) delete next.observedAt;
  return next;
}

function recalculateAssessment(
  assessment: EnergyLngAssessment,
  observationsById: Map<string, EnergyLngObservation>,
  entityKindsById: Map<string, EnergyLngEntityKind>,
  asOf: string,
): EnergyLngAssessment {
  const hops = assessment.hops.map((hop) => {
    const observations = hop.observationIds
      .map((id) => observationsById.get(id))
      .filter((observation): observation is EnergyLngObservation => Boolean(observation));
    const sourceIds = [...new Set([
      ...hop.evidenceIds,
      ...observations.flatMap((observation) => observation.evidenceIds),
    ])];
    const status = statusForRecords(observations.map((observation) => observation.record), sourceIds);
    return {
      ...hop,
      record: recordMeta(
        asOf,
        sourceIds,
        status,
        confidenceForRecords(observations.map((observation) => observation.record), status),
      ),
    };
  });
  const alternatives = rankAlternatives(assessment.alternatives);
  const base = { ...assessment, hops, alternatives };
  const flowPressure = calculateFlowPressure(base, observationsById, entityKindsById, asOf);
  const sourceIds = [...new Set([
    ...hops.flatMap((hop) => hop.evidenceIds),
    ...assessment.counterparties.flatMap((counterparty) => counterparty.evidenceIds),
    ...flowPressure.evidenceIds,
  ])];
  const status = statusForRecords(
    [...hops, ...assessment.counterparties].map((record) => record.record),
    sourceIds,
  );
  return {
    ...base,
    flowPressure,
    record: recordMeta(
      asOf,
      sourceIds,
      status,
      confidenceForRecords(
        [...hops, ...assessment.counterparties].map((record) => record.record),
        status,
      ),
    ),
  };
}

/**
 * Apply only validated staged observations and recalculate the assessment
 * through the same Flow Pressure adapter used by the application.
 */
export function applyEnergyLngCandidates(
  domain: EnergyLngDomain,
  candidates: EnergyLngNormalizedCandidate[],
  calculatedAt = domain.asOf,
): EnergyLngDomain {
  const next = structuredClone(domain);
  for (const candidate of candidates) {
    next.observations = next.observations.map((observation) =>
      candidateTargetMatches(observation, candidate)
        ? applyCandidateToObservation(observation, candidate, next.asOf)
        : observation,
    );
  }
  const observationsById = new Map(next.observations.map((observation) => [observation.id, observation]));
  const entityKindsById = new Map(next.entities.map((entity) => [entity.id, entity.kind]));
  return {
    ...next,
    assessments: next.assessments.map((assessment) => recalculateAssessment(assessment, observationsById, entityKindsById, calculatedAt)),
  };
}

export function toExposureTraceReadModel(domain: EnergyLngDomain): ExposureTraceData {
  const sourcesById = new Map(domain.sources.map((source) => [source.id, source]));
  const observationsById = new Map(domain.observations.map((observation) => [observation.id, observation]));
  const entities: PublicEntity[] = domain.entities.map((entity) => ({
    id: entity.id,
    name: entity.name,
    shortName: entity.shortName,
    kind: CANONICAL_TO_LEGACY_ENTITY_KIND[entity.kind],
    country: entity.country,
    coordinates: entity.coordinates,
    description: entity.description,
  }));

  const traces: ExposureTrace[] = domain.assessments.map((assessment) => ({
    id: assessment.traceId,
    commodity: assessment.commodity,
    title: assessment.title,
    kicker: assessment.kicker,
    headline: assessment.headline,
    routeEntityIds: assessment.routeEntityIds,
    hops: assessment.hops.map<TraceHop>((hop) => ({
      id: hop.id,
      stage: hop.stage,
      label: hop.label,
      summary: hop.summary,
      direction: hop.direction,
      entityIds: hop.entityIds,
      metrics: hop.observationIds
        .map((observationId) => observationsById.get(observationId))
        .filter((observation): observation is EnergyLngObservation => Boolean(observation))
        .map((observation) => toTraceMetric(observation, sourcesById)),
      evidenceIds: hop.evidenceIds,
    })),
    counterparties: assessment.counterparties.map<TraceCounterparty>((counterparty) => ({
      entityId: counterparty.entityId,
      role: counterparty.role,
      relationship: counterparty.relationship,
      exposureDirection: counterparty.exposureDirection,
      summary: counterparty.summary,
      publicObservation: counterparty.publicObservation,
      evidenceIds: counterparty.evidenceIds,
    })),
    commercialEvaluation: toLegacyCommercialEvaluation(assessment.commercialEvaluation),
    flowPressure: assessment.flowPressure,
    alternatives: assessment.alternatives,
    portfolioAction: assessment.portfolioAction,
    watchItems: assessment.watchItems,
  }));

  return {
    schemaVersion: 2,
    readModelVersion: domain.readModelVersion,
    canonicalModelVersion: domain.schemaVersion,
    asOf: domain.asOf,
    day: domain.day,
    headline: domain.headline,
    entities,
    evidence: domain.sources.map(toLegacySource),
    machineEvidence: domain.machineEvidence,
    commercialInputs: domain.commercialInputs.map((input) => toLegacyCommercialInput(input, observationsById, sourcesById)),
    traces,
  };
}
