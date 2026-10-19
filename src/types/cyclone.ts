export type CycloneAgency = "JMA" | "NHC";
export type CyclonePosition = [number, number];
export interface CyclonePoint {
  position: CyclonePosition;
  validAt: string;
  leadHours: number;
  windKnots: number | null;
  pressureHpa: number | null;
  classification: string | null;
  probabilityRadiusKm: number | null;
}
export interface CycloneStorm {
  id: string;
  agency: CycloneAgency;
  basin: string;
  name: string;
  advisory: string;
  issuedAt: string;
  sourceUrl: string;
  dataUrls: string[];
  snapshotHashes: string[];
  windAveragingMinutes: 1 | 10;
  uncertaintyKind: "cone" | "probability-circles" | "unavailable";
  uncertaintyNote: string;
  pastTrack: CyclonePosition[][];
  points: CyclonePoint[];
  cone: { type: "MultiPolygon"; coordinates: CyclonePosition[][][] } | null;
}
export interface CycloneSource {
  agency: CycloneAgency;
  coverage: string;
  url: string;
  checkedAt: string;
  lastSuccessfulAt: string | null;
  status: "ok" | "error";
  stormCount: number;
  error: string | null;
}
export interface CycloneManifest {
  schemaVersion: "cyclone-forecast-v1";
  deliveryMode?: "daily";
  generatedAt: string;
  sources: CycloneSource[];
  storms: CycloneStorm[];
  snapshots: { url: string; retrievedAt: string; sha256: string; artifact: string }[];
}
