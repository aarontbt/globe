/**
 * Contracts for the staged Energy/LNG refresh pipeline.
 *
 * These records are deliberately separate from the UI read model. A refresh
 * can therefore be fetched and reviewed without changing the assessment that
 * is currently served to the application.
 */

export type EnergyLngRefreshTrigger = "daily" | "event";
export type EnergyLngSourceCategory =
  | "physical-flow"
  | "route-context"
  | "market-context"
  | "asset-registry"
  | "trade-demand"
  | "reviewed-event";
export type EnergyLngSourceAutomation = "automated" | "manual-only";
export type EnergyLngSnapshotStatus = "fetched" | "failed" | "skipped";
export type EnergyLngCandidateStatus = "confirmed" | "carried" | "unavailable";
export type EnergyLngPromotionStatus = "not-run" | "validated" | "blocked" | "promoted";
export type EnergyLngCadence = "daily" | "weekly" | "monthly" | "annual" | "event-driven" | "contract-driven";
export type EnergyLngObservationKind = "flow" | "capacity" | "asset-status" | "transit" | "trade-demand";
export type EnergyLngCoverageStatus = "direct-observation" | "public-proxy" | "partial-coverage" | "unavailable";
export type EnergyLngSourceSelectorType =
  | "eia-series"
  | "portwatch-route"
  | "comtrade-trade"
  | "asset-registry"
  | "yahoo-symbol"
  | "reviewed-event";

export interface EnergyLngSourceSelection {
  type: EnergyLngSourceSelectorType;
  seriesId?: string;
  seriesIdEnv?: string;
  routeId?: string;
  routeIdEnv?: string;
  endpointEnv?: string;
  symbol?: string;
  entityId?: string;
  metric?: string;
  metricId?: string;
  dataset?: string;
  assetNamespace?: "UN/LOCODE" | "GEM" | string;
  assetCode?: string;
  assetCodeEnv?: string;
  assetField?: "status" | "capacity" | "identity" | string;
  reporterCode?: string;
  partnerCode?: string;
  flowCode?: "M" | "X" | string;
  commodityCode?: string;
  classificationCode?: string;
  periodField?: string;
  includeHistory?: boolean;
}

export interface EnergyLngTargetPolicy {
  cadence: EnergyLngCadence;
  maxAgeDays: number;
  allowedUnits: string[];
  entityIds: string[];
  observationKind?: EnergyLngObservationKind;
  coverageStatus?: EnergyLngCoverageStatus;
}

export interface EnergyLngSourceDefinition {
  id: string;
  provider: string;
  title: string;
  url: string;
  category: EnergyLngSourceCategory;
  automation: EnergyLngSourceAutomation;
  cadence: EnergyLngCadence;
  maxAgeDays: number;
  allowedUnits: string[];
  entityIds: string[];
  targetInputIds: string[];
  targetCommercialInputIds: string[];
  evidenceIds: string[];
  fallback: "carry" | "unavailable" | "preserve-reviewed";
  parserVersion: string;
  enabled: boolean;
  selection?: EnergyLngSourceSelection;
  targetPolicies?: Record<string, EnergyLngTargetPolicy>;
  observationKind?: EnergyLngObservationKind;
  coverageStatus?: EnergyLngCoverageStatus;
  reconciliationPriority?: number;
  approvedEndpointEnv?: string;
  note?: string;
}

export interface EnergyLngPeriod {
  start: string;
  end: string;
}

export interface EnergyLngCoverageMetadata {
  status: EnergyLngCoverageStatus;
  sourcePeriod: EnergyLngPeriod | null;
  expectedCadence: EnergyLngCadence;
  observedPeriod: EnergyLngPeriod | null;
  missingPeriods: string[];
  sourceStatus: EnergyLngSnapshotStatus;
  note?: string;
}

export interface EnergyLngSnapshotMetadata {
  id: string;
  sourceId: string;
  provider: string;
  url: string;
  retrievedAt: string;
  observedAt: string | null;
  httpStatus: number | null;
  contentType: string | null;
  contentHash: string | null;
  parserVersion: string;
  status: EnergyLngSnapshotStatus;
  canonicalUrl: string;
  evidenceId: string;
  recordKeys: string[];
  rawSnapshotRef?: string;
  artifactPath?: string;
  sourcePeriod?: EnergyLngPeriod | null;
  expectedCadence?: EnergyLngCadence;
  observedPeriod?: EnergyLngPeriod | null;
  missingPeriods?: string[];
  sourceStatus?: EnergyLngSnapshotStatus;
  error?: string;
  lineageRef: string;
}

export interface EnergyLngMachineEvidence {
  id: string;
  sourceId: string;
  provider: string;
  url: string;
  snapshotRef: string;
  retrievedAt: string;
  observedAt: string | null;
  contentHash: string;
  parserVersion: string;
  recordKeys: string[];
  targetInputIds: string[];
  targetCommercialInputIds: string[];
  observationKind?: EnergyLngObservationKind;
  coverage?: EnergyLngCoverageMetadata;
  status: "validated";
}

export interface EnergyLngRecordLineage {
  sourceId: string;
  sourceUrl: string;
  provider: string;
  observationAt: string | null;
  retrievedAt: string;
  snapshotHash: string | null;
  snapshotRef: string;
  parserVersion: string;
  recordKey: string;
  derivedFrom: string[];
}

export interface EnergyLngNormalizedCandidate {
  id: string;
  recordKey: string;
  label: string;
  entityIds: string[];
  targetInputIds: string[];
  targetCommercialInputIds: string[];
  observationKind: EnergyLngObservationKind;
  periodStart: string | null;
  periodEnd: string | null;
  aliases?: string[];
  coverage: EnergyLngCoverageMetadata;
  value?: number | string;
  low?: number;
  high?: number;
  unit: string | null;
  observationDate: string | null;
  observedAt: string | null;
  retrievedAt: string;
  cadence: EnergyLngCadence;
  freshnessWindowDays: number;
  provider: string;
  sourceId: string;
  sourceUrl: string;
  change?: number;
  changePct?: number;
  confidence: "high" | "medium" | "low" | "unknown";
  status: EnergyLngCandidateStatus;
  evidenceIds: string[];
  machineEvidenceIds: string[];
  missingReason?: string;
  carryReason?: string;
  reconciliationId?: string;
  selectedForAssessment?: boolean;
  lineage: EnergyLngRecordLineage;
}

export interface EnergyLngReconciliation {
  id: string;
  targetKey: string;
  candidateRecordKeys: string[];
  sourceIds: string[];
  selectedRecordKey: string | null;
  status: "resolved" | "unresolved";
  basis: "highest-priority-confirmed" | "latest-confirmed" | "preserved-unavailable";
  note: string;
}

export interface EnergyLngValidationResult {
  errors: string[];
  warnings: string[];
}

export interface EnergyLngPromotionResult {
  status: EnergyLngPromotionStatus;
  eligibleRecordIds: string[];
  rejectedRecordIds: string[];
  assessmentVersion: string | null;
  calculatedAt: string | null;
  errors: string[];
}

export interface EnergyLngRefreshReport {
  schemaVersion: "energy-lng-refresh-v1";
  runId: string;
  trigger: EnergyLngRefreshTrigger;
  asOf: string;
  startedAt: string;
  completedAt: string;
  baseFingerprint: string;
  sourceDefinitions: EnergyLngSourceDefinition[];
  snapshots: EnergyLngSnapshotMetadata[];
  machineEvidence: EnergyLngMachineEvidence[];
  observations: EnergyLngNormalizedCandidate[];
  reconciliations?: EnergyLngReconciliation[];
  coverage?: Record<string, EnergyLngCoverageMetadata>;
  sourceFilter?: string | null;
  requestedPeriod?: EnergyLngPeriod | null;
  validation: EnergyLngValidationResult;
  promotion: EnergyLngPromotionResult;
}
