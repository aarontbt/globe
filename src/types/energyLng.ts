/**
 * Canonical Energy/LNG types.
 *
 * These types deliberately do not mirror the ExposureTrace UI shape. The
 * trace is a read model generated from this domain contract so that source
 * records can later be replaced by normalised files or an API without
 * changing the experience layer.
 */

export type EnergyLngEntityKind =
  | "producer"
  | "field"
  | "liquefaction-train"
  | "export-terminal"
  | "vessel"
  | "carrier"
  | "port"
  | "regas-terminal"
  | "storage"
  | "route"
  | "corridor"
  | "chokepoint"
  | "buyer"
  | "market"
  | "demand-region"
  | "contract"
  | "event"
  | "benchmark"
  | "facility";

export type EnergyLngRelationshipType =
  | "operates"
  | "liquefies-at"
  | "exports-from"
  | "loads"
  | "carried-by"
  | "route-segment"
  | "passes-through"
  | "regasifies-at"
  | "delivers-to"
  | "contracted-supply"
  | "operational-dependency"
  | "market-sensitivity";

export type EnergyLngRecordStatus = "confirmed" | "carried" | "unavailable" | "inferred";
export type EnergyLngConfidence = "high" | "medium" | "low" | "unknown";
export type EnergyLngCadence = "daily" | "event-driven" | "contract-driven";

/** Required provenance and validity fields for every canonical record. */
export interface EnergyLngRecordMeta {
  asOf: string;
  validFrom: string | null;
  validTo: string | null;
  unit: string | null;
  sourceIds: string[];
  status: EnergyLngRecordStatus;
  confidence: EnergyLngConfidence;
}

export interface EnergyLngSource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  retrievedAt: string;
  kind: "event" | "market-observation" | "contract" | "official-statistics";
  cadence: EnergyLngCadence;
  maxAgeDays: number;
  status: "confirmed" | "carried";
  note?: string;
}

export interface EnergyLngEntity {
  id: string;
  kind: EnergyLngEntityKind;
  name: string;
  shortName: string;
  country: string;
  coordinates?: [number, number];
  description: string;
  record: EnergyLngRecordMeta;
}

export interface EnergyLngRelationship {
  id: string;
  type: EnergyLngRelationshipType;
  fromEntityId: string;
  toEntityId: string;
  evidenceIds: string[];
  note?: string;
  record: EnergyLngRecordMeta;
}

export interface EnergyLngObservation {
  id: string;
  label: string;
  entityIds: string[];
  value?: number | string;
  low?: number;
  high?: number;
  unit: string | null;
  sourceName?: string;
  sourceDate?: string;
  observedAt?: string;
  cadence?: EnergyLngCadence;
  freshnessWindowDays: number;
  carryReason?: string;
  missingReason?: string;
  evidenceIds: string[];
  record: EnergyLngRecordMeta;
}

export type EnergyLngTraceStage = "signal" | "supply" | "transport" | "demand" | "counterparty";
export type EnergyLngDirection = "positive" | "negative" | "mixed";

export interface EnergyLngHop {
  id: string;
  stage: EnergyLngTraceStage;
  label: string;
  summary: string;
  direction: EnergyLngDirection;
  entityIds: string[];
  observationIds: string[];
  evidenceIds: string[];
  record: EnergyLngRecordMeta;
}

export interface EnergyLngCounterpartyClaim {
  entityId: string;
  role: "supplier" | "carrier" | "buyer" | "portfolio";
  relationship: "public-contract" | "operational-dependency" | "market-sensitivity";
  exposureDirection: EnergyLngDirection;
  summary: string;
  publicObservation: string;
  evidenceIds: string[];
  record: EnergyLngRecordMeta;
}

export interface EnergyLngCommercialInput {
  id: string;
  label: string;
  commodity: "lng" | "crude-oil";
  role:
    | "origin-value"
    | "destination-value"
    | "freight"
    | "insurance"
    | "financing"
    | "fx"
    | "route"
    | "other-cost";
  observationId: string;
  requiredForCalculation: boolean;
}

export interface EnergyLngDerivedMetric {
  id: string;
  label: string;
  formulaId: string;
  inputObservationIds: string[];
  unit: string;
  calculatedAt: string;
  status: "derived" | "unavailable";
  unroundedValue?: number;
  displayValue?: number;
  unroundedLow?: number;
  unroundedHigh?: number;
  displayLow?: number;
  displayHigh?: number;
  missingInputIds?: string[];
}

export interface EnergyLngRiskControl {
  id: string;
  label: string;
  status: "verified" | "unavailable" | "not-assessed";
  summary: string;
  evidenceIds: string[];
}

export interface EnergyLngCommercialEvaluation {
  mode: "market-pull" | "landed-substitution";
  observedInputIds: string[];
  requiredInputIds: string[];
  originInputId: string;
  destinationInputId: string;
  costInputIds: string[];
  derivedMetrics: EnergyLngDerivedMetric[];
  dataStatus: "complete" | "partial" | "unavailable";
  residualStatus: "positive-residual" | "crosses-zero" | "negative-residual" | "insufficient-verified-data";
  missingInputIds: string[];
  riskControls: EnergyLngRiskControl[];
}

export type FlowPressureComponentId =
  | "supply-interruption"
  | "route-chokepoint-pressure"
  | "vessel-port-disruption"
  | "destination-dependency"
  | "price-basis-movement"
  | "alternative-availability";

export interface FlowPressureComponent {
  id: FlowPressureComponentId;
  label: string;
  weight: number;
  score: number;
  status: "observed" | "partially-observed" | "unresolved";
  confidence: EnergyLngConfidence;
  rationale: string;
  observationIds: string[];
  evidenceIds: string[];
}

export interface FlowPressureAssessment {
  modelVersion: "flow-pressure-v1";
  score: number;
  status: "provisional" | "assessed" | "insufficient-verified-data";
  confidence: EnergyLngConfidence;
  calculatedAt: string;
  components: FlowPressureComponent[];
  evidenceIds: string[];
  note: string;
}

export type EnergyAlternativeKind = "source" | "market" | "route-or-terminal";
export type EnergyAlternativeFeasibility =
  | "potential"
  | "physically-feasible"
  | "commercially-executable"
  | "insufficient-verified-data";

export interface EnergyAlternative {
  id: string;
  kind: EnergyAlternativeKind;
  label: string;
  summary: string;
  feasibility: EnergyAlternativeFeasibility;
  rank: number | null;
  score: number | null;
  constraintSummary: string;
  evidenceIds: string[];
  record: EnergyLngRecordMeta;
}

export interface EnergyLngAssessment {
  id: string;
  traceId: string;
  commodity: "lng" | "crude-oil";
  title: string;
  kicker: string;
  headline: string;
  routeEntityIds: string[];
  hops: EnergyLngHop[];
  counterparties: EnergyLngCounterpartyClaim[];
  commercialEvaluation: EnergyLngCommercialEvaluation;
  flowPressure: FlowPressureAssessment;
  alternatives: EnergyAlternative[];
  portfolioAction: string;
  watchItems: string[];
  record: EnergyLngRecordMeta;
}

export interface EnergyLngDomain {
  schemaVersion: "energy-lng-domain-v1";
  readModelVersion: "energy-lng-read-model-v1";
  asOf: string;
  day: string;
  headline: string;
  sources: EnergyLngSource[];
  entities: EnergyLngEntity[];
  relationships: EnergyLngRelationship[];
  observations: EnergyLngObservation[];
  commercialInputs: EnergyLngCommercialInput[];
  assessments: EnergyLngAssessment[];
}
