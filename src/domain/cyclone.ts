import type { CycloneManifest, CyclonePoint, CyclonePosition, CycloneStorm } from "../types/cyclone";

const HOUR = 3600_000;
const AGENCIES = ["JMA", "NHC"];
const CLASSIFICATIONS = ["TD", "TS", "STS", "TY", "HU", "EX", "LO", "PTC", "SD", "SS"];
function position(value: unknown): value is CyclonePosition {
  return Array.isArray(value) && value.length === 2 && value.every(v => typeof v === "number" && Number.isFinite(v)) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}
function timestamp(value: unknown): number {
  if (typeof value !== "string" || !/(Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error("Invalid cyclone timestamp");
  return Date.parse(value);
}
function sourceUrl(value: unknown, agency: string) {
  if (typeof value !== "string") throw new Error("Missing cyclone source");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hostname !== (agency === "JMA" ? "www.jma.go.jp" : "www.nhc.noaa.gov")) throw new Error("Unapproved cyclone source");
}
export function validateCycloneManifest(value: unknown, now = Date.now()): CycloneManifest {
  if (!value || typeof value !== "object") throw new Error("Missing cyclone forecast");
  const m = value as CycloneManifest;
  if (m.schemaVersion !== "cyclone-forecast-v1" || (m.deliveryMode !== undefined && m.deliveryMode !== "daily")
    || !Array.isArray(m.storms) || m.storms.length > 60 || !Array.isArray(m.sources) || m.sources.length !== 2 || timestamp(m.generatedAt) > now + 600_000) throw new Error("Invalid cyclone manifest");
  const agencies = new Set<string>();
  for (const s of m.sources) {
    if (!AGENCIES.includes(s.agency) || agencies.has(s.agency) || !["ok", "error"].includes(s.status) || typeof s.coverage !== "string" || s.coverage.length > 200 || !Number.isInteger(s.stormCount) || s.stormCount < 0 || s.stormCount > 30 || timestamp(s.checkedAt) > now + 600_000 || timestamp(s.checkedAt) > timestamp(m.generatedAt)) throw new Error("Invalid cyclone source status");
    sourceUrl(s.url, s.agency);
    if (s.lastSuccessfulAt && timestamp(s.lastSuccessfulAt) > timestamp(s.checkedAt)) throw new Error("Future cyclone success");
    if (s.status === "ok" && !s.lastSuccessfulAt) throw new Error("Missing cyclone successful check");
    agencies.add(s.agency);
  }
  if (!Array.isArray(m.snapshots) || m.snapshots.length > 200) throw new Error("Invalid cyclone provenance");
  const hashes = new Set<string>();
  for (const snapshot of m.snapshots) {
    const url = new URL(snapshot.url);
    if (url.protocol !== "https:" || !["www.jma.go.jp", "www.nhc.noaa.gov"].includes(url.hostname) || !/^[a-f0-9]{64}$/.test(snapshot.sha256) || snapshot.artifact !== `snapshots/${snapshot.sha256}.bin` || timestamp(snapshot.retrievedAt) > now + 600_000) throw new Error("Invalid cyclone snapshot");
    hashes.add(snapshot.sha256);
  }
  const ids = new Set<string>();
  for (const s of m.storms) {
    if (!AGENCIES.includes(s.agency) || typeof s.id !== "string" || !/^(jma-TC\d{4}|nhc-(al|ep|cp)\d{6})$/.test(s.id) || ids.has(s.id) || !s.id.startsWith(s.agency.toLowerCase() + "-") || typeof s.name !== "string" || !s.name || s.name.length > 100 || typeof s.advisory !== "string" || s.advisory.length > 40 || typeof s.basin !== "string" || typeof s.uncertaintyNote !== "string" || !["cone", "probability-circles", "unavailable"].includes(s.uncertaintyKind) || s.windAveragingMinutes !== (s.agency === "JMA" ? 10 : 1)) throw new Error("Invalid cyclone identity");
    const issued = timestamp(s.issuedAt);
    if (issued > now + 600_000 || issued < Date.UTC(2020, 0, 1)) throw new Error("Invalid advisory time");
    sourceUrl(s.sourceUrl, s.agency);
    if (!Array.isArray(s.dataUrls) || !s.dataUrls.length || s.dataUrls.length > 5) throw new Error("Missing cyclone data provenance");
    s.dataUrls.forEach(url => sourceUrl(url, s.agency));
    if (!Array.isArray(s.snapshotHashes) || s.snapshotHashes.length < 2 || s.snapshotHashes.some(hash => !hashes.has(hash))) throw new Error("Missing cyclone source snapshots");
    if (!Array.isArray(s.points) || s.points.length < 2 || s.points.length > 40 || s.points[0].leadHours !== 0) throw new Error("Missing cyclone forecast points");
    let previous = -Infinity;
    let previousLead = -1;
    for (const p of s.points) {
      const time = timestamp(p.validAt);
      if (!position(p.position) || time <= previous || time > issued + 8 * 24 * HOUR || !Number.isFinite(p.leadHours) || p.leadHours <= previousLead || p.leadHours > 168 || (p.leadHours === 0 && time > issued + 600_000)) throw new Error("Invalid cyclone forecast point");
      for (const [n, max] of [[p.windKnots, 250], [p.pressureHpa, 1100], [p.probabilityRadiusKm, 3000]]) {
        if (n !== null && (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > max!)) throw new Error("Invalid cyclone intensity/uncertainty");
      }
      if (p.classification !== null && !CLASSIFICATIONS.includes(p.classification)) throw new Error("Invalid cyclone classification");
      previous = time;
      previousLead = p.leadHours;
    }
    if (!Array.isArray(s.pastTrack) || s.pastTrack.length > 10 || s.pastTrack.some(line => !Array.isArray(line) || line.length > 3000 || line.some(p => !position(p)))) throw new Error("Invalid cyclone past track");
    if (s.cone !== null) {
      if (s.agency !== "NHC" || s.uncertaintyKind !== "cone" || s.cone.type !== "MultiPolygon" || !Array.isArray(s.cone.coordinates) || s.cone.coordinates.length > 10) throw new Error("Invalid uncertainty cone");
      for (const poly of s.cone.coordinates) {
        if (!Array.isArray(poly) || !poly.length || poly.length > 10) throw new Error("Invalid cone polygon");
        for (const ring of poly) {
          if (!Array.isArray(ring) || ring.length < 4 || ring.length > 30000 || ring.some(p => !position(p)) || ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) throw new Error("Invalid cone ring");
        }
      }
    } else if (s.uncertaintyKind === "cone") throw new Error("Missing source cone");
    ids.add(s.id);
  }
  for (const source of m.sources) if (source.stormCount !== m.storms.filter(s => s.agency === source.agency).length) throw new Error("Cyclone source coverage mismatch");
  return m;
}
export function cycloneFreshness(storm: CycloneStorm, now = Date.now(), staleAfterHours = 12): "fresh" | "stale" | "expired" {
  if (Date.parse(storm.points[storm.points.length - 1].validAt) <= now) return "expired";
  return now - Date.parse(storm.issuedAt) > staleAfterHours * HOUR ? "stale" : "fresh";
}
export function cycloneMarker(point: CyclonePoint, agency: string): string {
  // Saffir–Simpson categories use NHC 1-minute winds only; JMA's native TY is distinct.
  if (agency === "NHC" && point.classification === "HU" && point.windKnots !== null) {
    const wind = point.windKnots;
    return wind >= 137 ? "5" : wind >= 113 ? "4" : wind >= 96 ? "3" : wind >= 83 ? "2" : wind >= 64 ? "1" : "HU";
  }
  return point.classification ?? "F";
}
export function cycloneColor(point: CyclonePoint, agency: string): [number, number, number, number] {
  const label = cycloneMarker(point, agency);
  return ["3", "4", "5"].includes(label) ? [239, 68, 68, 255] : ["1", "2", "TY", "HU"].includes(label) ? [251, 146, 60, 255] : label === "F" ? [203, 213, 225, 255] : [34, 211, 238, 255];
}
export function utcLabel(value: string) {
  return new Date(value).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}
// Great-circle sampling preserves the provider's centre and radius in kilometres.
export function probabilityCircle(center: CyclonePosition, radiusKm: number): CyclonePosition[] {
  const [lon, lat] = center.map(v => v * Math.PI / 180);
  const angle = radiusKm / 6371.0088;
  return Array.from({ length: 97 }, (_, i) => {
    const bearing = (i % 96) * 2 * Math.PI / 96;
    const phi = Math.asin(Math.sin(lat) * Math.cos(angle) + Math.cos(lat) * Math.sin(angle) * Math.cos(bearing));
    const lambda = lon + Math.atan2(Math.sin(bearing) * Math.sin(angle) * Math.cos(lat), Math.cos(angle) - Math.sin(lat) * Math.sin(phi));
    return [((lambda * 180 / Math.PI + 540) % 360) - 180, phi * 180 / Math.PI];
  });
}
