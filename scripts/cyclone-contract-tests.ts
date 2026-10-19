import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cycloneFreshness, cycloneMarker, probabilityCircle, validateCycloneManifest } from "../src/domain/cyclone";
import { createCycloneForecastLayers } from "../src/layers/cycloneForecasts";

const fixture = JSON.parse(execFileSync("python3", ["-c", `
import importlib.util,json,tempfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('tests', 'scripts/cyclone-tests.py')
t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
with tempfile.TemporaryDirectory() as d:
 print(json.dumps(t.c.refresh(Path(d),t.NOW,t.source_map().__getitem__)))
`], { encoding: "utf8" }));
const now = Date.parse("2026-10-19T00:15:00Z");
const manifest = validateCycloneManifest(fixture, now);
const jma = manifest.storms.find(s => s.agency === "JMA")!;
const nhc = manifest.storms.find(s => s.agency === "NHC")!;
assert.equal(cycloneFreshness(jma, now), "fresh");
assert.equal(cycloneFreshness(jma, now + 13 * 3600_000), "stale");
assert.equal(cycloneFreshness(jma, now + 8 * 86400_000), "expired");
assert.equal(cycloneMarker(jma.points[0], "JMA"), "TY");
assert.equal(cycloneMarker(jma.points[1], "JMA"), "F");
assert.equal(cycloneMarker(nhc.points[0], "NHC"), "2");
for (const [wind, expected] of [[64, "1"], [83, "2"], [96, "3"], [113, "4"], [137, "5"]] as const) {
  assert.equal(cycloneMarker({ ...nhc.points[0], windKnots: wind }, "NHC"), expected);
  assert.equal(cycloneMarker({ ...jma.points[0], windKnots: wind }, "JMA"), "TY");
}
for (const mutate of [
  (m: any) => { m.storms[0].points[0].position = [13, 140]; },
  (m: any) => { m.storms[0].points[1].validAt = m.storms[0].points[0].validAt; },
  (m: any) => { m.storms[0].points[1].windKnots = -5; },
  (m: any) => { m.storms[0].points[1].probabilityRadiusKm = 5000; },
  (m: any) => { m.storms[0].windAveragingMinutes = 1; },
  (m: any) => { m.storms[0].issuedAt = "2026-10-22T00:00:00Z"; },
  (m: any) => { m.storms[0].sourceUrl = "javascript:alert(1)"; },
  (m: any) => { m.storms[0].dataUrls[0] = "https://example.com"; },
  (m: any) => { m.storms[0].snapshotHashes = ["missing"]; },
  (m: any) => { m.storms[0].points[0].classification = "Category 9"; },
  (m: any) => { m.storms.push(m.storms[0]); },
  (m: any) => { m.sources[0].stormCount = 999; },
  (m: any) => { m.sources[0].checkedAt = "2026-10-22T00:00:00Z"; },
  (m: any) => { m.sources.pop(); },
  (m: any) => { m.storms[1].cone.coordinates[0][0].pop(); },
  (m: any) => { m.storms[1].cone = null; },
]) {
  const broken = structuredClone(fixture);
  mutate(broken);
  assert.throws(() => validateCycloneManifest(broken, now));
}
const circle = probabilityCircle([179.8, 10], 100);
assert.equal(circle.length, 97);
assert.deepEqual(circle[0], circle[circle.length - 1]);
assert(circle.some(p => p[0] < -179) && circle.some(p => p[0] > 179), "probability circle wraps at the dateline");
assert(circle.every(p => Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90));
const distance = ([lon1, lat1]: number[], [lon2, lat2]: number[]) => {
  const r = Math.PI / 180;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2));
};
for (const p of circle) assert(Math.abs(distance([179.8, 10], p) - 100) < 0.001);
const layers = createCycloneForecastLayers(manifest.storms, jma, true, { lon: 140, lat: 14 });
assert.equal((layers[0].props as any).data.features.length, jma.points.length - 1, "source radii render as individual probability circles");
assert.equal((createCycloneForecastLayers(manifest.storms, jma, false, { lon: 140, lat: 14 })[0].props as any).data.features.length, 0);
const far = createCycloneForecastLayers([jma], jma, true, { lon: -40, lat: -14 });
assert.equal((far[4].props as any).data.length, 0, "far hemisphere labels are suppressed");
const nhcLayers = createCycloneForecastLayers(manifest.storms, nhc, true, { lon: -107, lat: 20 });
assert.deepEqual((nhcLayers[0].props as any).data.features[0].geometry, nhc.cone, "NHC source geometry is unchanged");
console.log("Cyclone contracts, source provenance, intensity semantics, expiry, dateline and layer geometry passed");
