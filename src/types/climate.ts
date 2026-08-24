export type ClimateHazardType = "tropical-cyclone" | "flood";
export type ClimateAlertLevel = "green" | "orange" | "red" | "unknown";
export type ClimateSourceFreshness = "fresh" | "stale" | "unavailable" | "not-run";
export type ClimateTargetType = "port" | "corridor" | "energy-entity" | "exposure-trace";
export type ClimateImpactRelationship = "inside-footprint" | "intersects-footprint";

export type ClimatePosition = [number, number];

export type ClimateGeometry =
  | { type: "Point"; coordinates: ClimatePosition }
  | { type: "MultiPoint"; coordinates: ClimatePosition[] }
  | { type: "LineString"; coordinates: ClimatePosition[] }
  | { type: "MultiLineString"; coordinates: ClimatePosition[][] }
  | { type: "Polygon"; coordinates: ClimatePosition[][] }
  | { type: "MultiPolygon"; coordinates: ClimatePosition[][][] };

export interface ClimateHazard {
  id: string;
  sourceId: "gdacs-event-list";
  sourceEventId: string;
  sourceEpisodeId: string | null;
  type: ClimateHazardType;
  title: string;
  description: string;
  alertLevel: ClimateAlertLevel;
  countries: string[];
  geometry: ClimateGeometry;
  centroid: ClimatePosition;
  observedAt: string;
  updatedAt: string;
  validFrom: string | null;
  validTo: string | null;
  sourceUrl: string;
  impactAssessment: "available" | "unavailable";
  lineage: {
    snapshotId: string;
    contentHash: string;
  };
}

export interface ClimateImpact {
  id: string;
  hazardId: string;
  targetType: ClimateTargetType;
  targetId: string;
  targetName: string;
  targetCoordinates?: ClimatePosition;
  relationship: ClimateImpactRelationship;
  status: "derived";
  confidence: "high";
  derivedFrom: {
    hazardId: string;
    sourceId: "gdacs-event-list";
    method: "point-in-polygon" | "geometry-intersection";
  };
}

export interface ClimateSourceStatus {
  sourceId: "gdacs-event-list";
  name: "GDACS";
  sourceUrl: string;
  status: ClimateSourceFreshness;
  checkedAt: string | null;
  lastSuccessfulAt: string | null;
  freshnessHours: 6;
  contentHash: string | null;
  error: string | null;
}

export interface ClimateReadModel {
  schemaVersion: "climate-read-model-v1";
  asOf: string;
  generatedAt: string;
  areaOfInterest: {
    west: 40;
    south: -20;
    east: 155;
    north: 45;
  };
  sourceStatus: ClimateSourceStatus;
  hazards: ClimateHazard[];
  impacts: ClimateImpact[];
}
