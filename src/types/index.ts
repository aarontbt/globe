import type { EnergyAlternative, FlowPressureAssessment } from "./energyLng";
import type { EnergyLngMachineEvidence } from "./energyLngPipeline";

export interface Port {
  id: string;
  name: string;
  country: string;
  coordinates: [number, number];
  teu: number; // TEU throughput in thousands
  type: "asean" | "partner" | "global";
  rank: number; // world rank by container throughput
  operator: string; // main terminal operator(s)
  depth: number; // berth/channel depth in metres
}

export interface TradeArc {
  id: string;
  from: string;
  to: string;
  fromCoords: [number, number];
  toCoords: [number, number];
  valueBn: number; // USD billions
  commodity: string;
  color: [number, number, number];
}

export interface Corridor {
  id: string;
  name: string;
  fromPort: string;
  toPort: string;
  path: [number, number][];
  volume: number;
  commodity: string;
  narrative: string;
  color: [number, number, number];
}

export interface AnimatedVessel {
  id: number;
  laneIndex: number;
  offset: number;
  speed: number;
  position: [number, number];
}

export type EventCategory =
  | "security"
  | "political"
  | "economic"
  | "climate"
  | "election"
  | "diplomatic"
  | "social";

export type SocialPlatform = "gdelt" | "acled" | "bluesky";

export interface SocialSignal {
  platform: SocialPlatform;
  url: string;
  engagement: number;       // upvotes, article count, incident count, or reposts
  engagementLabel: string;  // "upvotes", "articles", "incidents", "reposts"
}

export type EventImpact = "high" | "medium" | "low";

export interface PolymarketData {
  volume: string;       // e.g. "$9.1M"
  liquidity: string;    // e.g. "$1.2M"
  comments: number;     // commentCount from Gamma API
  slug: string;         // polymarket.com/event/{slug}
}

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  currency: string;
  unit: string;
  lastUpdated: string;
  history?: number[];
}

export interface NewsArticle {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: "CNA" | "BBC" | "Reuters" | "CNBC" | "Al Jazeera";
  category?: string;
}


export interface Satellite {
  name: string;
  lat: number;
  lon: number;
  altitudeKm: number;
  periodMin: number;
}

export interface CountryLabel {
  name: string;
  coordinates: [number, number];
}

export type OilNodeType = "production" | "refinery" | "storage" | "consumption";

export interface OilNode {
  id: string;
  name: string;
  type: OilNodeType;
  country: string;
  coordinates: [number, number];
  capacityMbpd: number;
  capacityMb?: number;
  operator?: string;
  notes?: string;
}

export interface OilRoute {
  id: string;
  from: string;
  to: string;
  fromCoords: [number, number];
  toCoords: [number, number];
  type: "crude" | "product";
  volumeMbpd: number;
  vesselClass?: string;
  chokepoints?: string[];
  commodity: string;
}

export type VesselType = "tanker" | "lng" | "navy" | "dark-fleet" | "irgcn" | "cargo";
export type VesselStatus = "underway" | "anchored" | "moored" | "ais-off" | "unknown";

export interface CrisisVessel {
  mmsi: string;
  name: string;
  flag: string;
  type: VesselType;
  coordinates: [number, number];
  heading: number;
  speed: number;
  status: VesselStatus;
  destination: string;
  narrative: string;
  photoUrl?: string;
  photoCredit?: string;
  trail: [number, number][]; // last 5 positions, oldest first; empty for AIS-off vessels
}

export interface CommodityAsset {
  id: string;
  name: string;
  current: number;
  unit: string;
  change1d: string;
  baseline30d: number;
  baseline90d: number;
  zscore: number;
  signal: "green" | "amber" | "red";
  narrative: string;
}

export interface CommodityCategory {
  id: string;
  label: string;
  supplyChainImpact: string;
  assets: CommodityAsset[];
}

export interface CommoditiesImpactData {
  asOf: string;
  day: string;
  scenario: string;
  marketContext: string;
  categories: CommodityCategory[];
}

export type TraceStage =
  | "signal"
  | "supply"
  | "transport"
  | "demand"
  | "counterparty";

export type TraceMetricStatus = "confirmed" | "carried" | "unavailable";
export type TraceRelationship =
  | "public-contract"
  | "operational-dependency"
  | "market-sensitivity";
export type CommodityId = "lng" | "crude-oil";
export type CommercialInputRole =
  | "origin-value"
  | "destination-value"
  | "freight"
  | "insurance"
  | "financing"
  | "fx"
  | "route"
  | "other-cost";
export type CommercialDataStatus = "complete" | "partial" | "unavailable";
export type ResidualStatus =
  | "positive-residual"
  | "crosses-zero"
  | "negative-residual"
  | "insufficient-verified-data";
export type RiskControlStatus = "verified" | "unavailable" | "not-assessed";

export interface TraceMetric {
  inputId: string;
  label: string;
  value?: number | string;
  low?: number;
  high?: number;
  unit?: string;
  status: TraceMetricStatus;
  source: string;
  sourceDate: string;
  observedAt?: string;
  maxAgeDays: number;
  cadence?: "daily" | "event-driven" | "contract-driven";
  machineEvidenceIds?: string[];
  carryReason?: string;
  missingReason?: string;
}

export interface TraceHop {
  id: string;
  stage: TraceStage;
  label: string;
  summary: string;
  direction: "positive" | "negative" | "mixed";
  entityIds: string[];
  metrics: TraceMetric[];
  evidenceIds: string[];
}

export interface PublicEntity {
  id: string;
  name: string;
  shortName: string;
  kind:
    | "producer"
    | "facility"
    | "carrier"
    | "terminal"
    | "market"
    | "buyer"
    | "supplier"
    | "portfolio"
    | "region";
  country: string;
  coordinates?: [number, number];
  description: string;
}

export interface EvidenceReference {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  lastChecked: string;
  kind: "event" | "market-observation" | "contract" | "official-statistics";
  cadence: "daily" | "event-driven" | "contract-driven";
  maxAgeDays: number;
  status: "confirmed" | "carried";
  note?: string;
}

export interface EvidenceObservation {
  inputId: string;
  value: string | number;
  unit: string;
  sourceDate: string;
  observedAt?: string;
  instrument: string;
  provider: string;
}

export interface EvidenceAuditEntry {
  evidenceId: string;
  url: string;
  canonicalUrl: string;
  httpStatus: number;
  pageType: "article" | "release" | "pdf" | "market-data" | "official-data" | "landing-page";
  contentStatus: "verified" | "unsupported" | "stale" | "unreachable" | "manual-review";
  reviewStatus: "approved" | "pending" | "rejected";
  title: string;
  publisher: string;
  publishedAt: string;
  checkedAt: string;
  claimSummary: string;
  extractedFacts: string[];
  supportedHopIds: string[];
  supportedMetricIds: string[];
  supportedCommercialInputIds: string[];
  supportedDerivedMetricIds: string[];
  supportedRelationshipIds: string[];
  observations?: EvidenceObservation[];
  carryReason?: string;
  note?: string;
}

export interface EvidenceAudit {
  schemaVersion: 2;
  asOf: string;
  reviewedAt: string;
  reviewer: string;
  entries: EvidenceAuditEntry[];
}

export interface ObservedCommercialInput extends TraceMetric {
  commodity: CommodityId;
  role: CommercialInputRole;
  evidenceIds: string[];
  requiredForCalculation: boolean;
}

export interface DerivedCommercialMetric {
  metricId: string;
  label: string;
  formulaId: "destination-minus-origin" | "sum-transformation-costs" | "gross-minus-costs";
  inputIds: string[];
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

export interface RiskControl {
  id: string;
  label: string;
  status: RiskControlStatus;
  summary: string;
  evidenceIds: string[];
}

export interface TraceCounterparty {
  entityId: string;
  role: "supplier" | "carrier" | "buyer" | "portfolio";
  relationship: TraceRelationship;
  exposureDirection: "positive" | "negative" | "mixed";
  summary: string;
  publicObservation: string;
  evidenceIds: string[];
}

export interface CommercialEvaluation {
  mode: "market-pull" | "landed-substitution";
  observedInputIds: string[];
  requiredInputIds: string[];
  originInputId: string;
  destinationInputId: string;
  costInputIds: string[];
  derivedMetrics: DerivedCommercialMetric[];
  dataStatus: CommercialDataStatus;
  residualStatus: ResidualStatus;
  missingInputIds: string[];
  riskControls: RiskControl[];
}

export interface ExposureTrace {
  id: string;
  commodity: CommodityId;
  title: string;
  kicker: string;
  headline: string;
  routeEntityIds: string[];
  hops: TraceHop[];
  counterparties: TraceCounterparty[];
  commercialEvaluation: CommercialEvaluation;
  flowPressure?: FlowPressureAssessment;
  alternatives?: EnergyAlternative[];
  portfolioAction: string;
  watchItems: string[];
}

export interface ExposureTraceData {
  schemaVersion: 2;
  readModelVersion?: "energy-lng-read-model-v1";
  canonicalModelVersion?: "energy-lng-domain-v1";
  asOf: string;
  day: string;
  headline: string;
  entities: PublicEntity[];
  evidence: EvidenceReference[];
  machineEvidence?: EnergyLngMachineEvidence[];
  commercialInputs: ObservedCommercialInput[];
  traces: ExposureTrace[];
}

export interface GlobeEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  country: string;
  region: string;
  coordinates: [number, number];
  probability?: number; // 0-100, undefined for non-probability sources (social media)
  impact: EventImpact;
  date: string;
  tags: string[];
  polymarket?: PolymarketData;
  social?: SocialSignal;
}
