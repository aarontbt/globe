/**
 * Contracts for the staged Energy/LNG refresh pipeline.
 *
 * These records are deliberately separate from the UI read model. A refresh
 * can therefore be fetched and reviewed without changing the assessment that
 * is currently served to the application.
 */

export type EnergyLngRefreshTrigger = "daily" | "event";
export type EnergyLngSourceCategory = "physical-flow" | "route-context" | "market-context" | "reviewed-event";
export type EnergyLngSourceAutomation = "automated" | "manual-only";
export type EnergyLngSnapshotStatus = "fetched" | "failed" | "skipped";
export type EnergyLngCandidateStatus = "confirmed" | "carried" | "unavailable";
export type EnergyLngPromotionStatus = "not-run" | "validated" | "blocked" | "promoted";
export type EnergyLngSourceSelectorType = "eia-series" | "portwatch-route" | "yahoo-symbol" | "reviewed-event";

export interface EnergyLngSourceSelection {
  type: EnergyLngSourceSelectorType;
  seriesId?: string;
  seriesIdEnv?: string;
  routeId?: string;
  routeIdEnv?: string;
  symbol?: string;
  entityId?: string;
  metric?: string;
}

export interface EnergyLngTargetPolicy {
  cadence: "daily" | "event-driven" | "contract-driven";
  maxAgeDays: number;
  allowedUnits: string[];
  entityIds: string[];
}

export interface EnergyLngSourceDefinition {
  id: string;
  provider: string;
  title: string;
  url: string;
  category: EnergyLngSourceCategory;
  automation: EnergyLngSourceAutomation;
  cadence: "daily" | "event-driven" | "contract-driven";
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
  value?: number | string;
  low?: number;
  high?: number;
  unit: string | null;
  observationDate: string | null;
  observedAt: string | null;
  retrievedAt: string;
  cadence: "daily" | "event-driven" | "contract-driven";
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
  lineage: EnergyLngRecordLineage;
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
  validation: EnergyLngValidationResult;
  promotion: EnergyLngPromotionResult;
}
