import assert from "node:assert/strict";
import { validatePolarManifest, validateWeatherManifest, weatherFreshness } from "../src/domain/weather";
import { createPolarBitmapMesh } from "../src/layers/polarBitmapMesh";

const now = Date.parse("2026-10-18T05:00:00Z");
const fixture = () => ({
  schemaVersion: "weather-imagery-v1", sourceId: "noaa-gmgsi-lw", frameId: "test-frame",
  sourceUrl: "https://noaa-gmgsi-pds.s3.amazonaws.com/GMGSI_LW/test.nc", sourceSha256: "a".repeat(64),
  observedAt: "2026-10-18T04:00:00Z", observationEnd: "2026-10-18T04:09:59Z", generatedAt: "2026-10-18T04:40:00Z",
  channel: "longwave-infrared", projection: "EPSG:4326", bounds: [-180, -70, 180, 70],
  resolutionKm: 8, staleAfterMinutes: 120, attribution: "NOAA", valueDescription: "Infrared brightness",
  patches: Array.from({ length: 8 }, (_, i) => {
    const row = Math.floor(i / 4), col = i % 4;
    return { id: `${row}-${col}`, url: `frames/test-frame/${row}-${col}.png`,
      bounds: [-180 + col * 90, 70 - (row + 1) * 70, -180 + (col + 1) * 90, 70 - row * 70],
      width: 512, height: 400, bytes: 1000, sha256: "b".repeat(64) };
  }),
});
const base = "https://weather.example/weather/manifest.json";
const valid = validateWeatherManifest(fixture(), base, now);
assert.equal(valid.patches[0].url, "https://weather.example/weather/frames/test-frame/0-0.png");
assert.equal(weatherFreshness(valid, now), "fresh");
assert.equal(weatherFreshness(valid, now + 2 * 3600_000), "stale");
const withHistory = () => ({ ...fixture(), history: [
  { frameId: "older-frame", observedAt: "2026-10-18T03:00:00Z", url: "frames/older-frame/manifest.json" },
  { frameId: "test-frame", observedAt: "2026-10-18T04:00:00Z", url: "frames/test-frame/manifest.json" },
] });
assert.equal(validateWeatherManifest(withHistory(), base, now).history?.length, 2);
for (const mutate of [
  (m: any) => { m.history.reverse(); },
  (m: any) => { m.history.pop(); },
  (m: any) => { m.history[0].observedAt = "2026-10-14T00:00:00Z"; },
  (m: any) => { m.history[0].url = "https://other.example/frame.json"; },
  (m: any) => { m.history[0].frameId = m.history[1].frameId; },
]) {
  const m = withHistory(); mutate(m);
  assert.throws(() => validateWeatherManifest(m, base, now));
}
for (const mutate of [
  (m: any) => { m.patches.pop(); },
  (m: any) => { m.patches[0].id = m.patches[1].id; },
  (m: any) => { m.patches[0].bounds[0] = 0; },
  (m: any) => { m.patches[0].url = "https://other.example/a.png"; },
  (m: any) => { m.patches[0].sha256 = "incorrect"; },
  (m: any) => { m.patches[0].width = 100000; },
  (m: any) => { m.patches[0].bytes = 11 * 1024 * 1024; },
  (m: any) => { m.observedAt = "2026-10-20T00:00:00Z"; },
  (m: any) => { m.staleAfterMinutes = 100000; },
  (m: any) => { m.bounds[0] = NaN; },
  (m: any) => { m.projection = "unknown"; },
]) {
  const m = fixture(); mutate(m);
  assert.throws(() => validateWeatherManifest(m, base, now));
}
console.log("Weather manifest validation and freshness tests passed");

const longHistory = { ...fixture(), history: Array.from({ length: 49 }, (_, i) => ({
  frameId: i === 48 ? "test-frame" : `history-${i}`,
  observedAt: new Date(Date.parse(fixture().observedAt) - (48 - i) * 3600_000).toISOString(),
  url: `frames/history-${i}/manifest.json`,
})) };
longHistory.history[48].observedAt = fixture().observedAt;
assert.equal(validateWeatherManifest(longHistory, base, now).history?.length, 49);
const polar = {
  schemaVersion: "polar-clouds-v1", sourceId: "nasa-modis-cloud-fraction", observedDate: "2026-10-17",
  generatedAt: "2026-10-18T04:40:00Z", attribution: "NASA MODIS", sourceUrls: [
    "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?TIME=2026-10-17&north",
    "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?TIME=2026-10-17&south"],
  sourceHashes: ["a".repeat(64), "b".repeat(64)],
  colormapUrl: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_Cloud_Fraction.xml", colormapSha256: "a".repeat(64),
  patches: Array.from({length:8},(_,i)=>({id: `${i < 4 ? "north" : "south"}-${i % 4}`, url: `${i}.png`,
    bounds: [-180 + i % 4 * 90, i < 4 ? 68 : -90, -90 + i % 4 * 90, i < 4 ? 90 : -68],
    width:256, height:128, bytes:1000, sha256:"c".repeat(64)})),
};
assert.equal(validatePolarManifest(polar, base, fixture().observedAt).patches.length, 8);
const infraredPolar = { ...polar, sourceId: "nasa-modis-infrared",
  colormapUrl: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_Brightness_Temp_Band31.xml" };
assert.equal(validatePolarManifest(infraredPolar, base, fixture().observedAt).patches.length, 8);
assert.throws(() => validatePolarManifest({ ...infraredPolar, colormapUrl: polar.colormapUrl }, base, fixture().observedAt));
for (const mutate of [
  (m:any)=>{m.observedDate="2026-10-18";},
  (m:any)=>{m.patches[0].bounds[3]=73;},
  (m:any)=>{m.patches[0].url="https://other.example/p.png";},
  (m:any)=>{m.patches[7].id=m.patches[0].id;},
  (m:any)=>{m.sourceUrls[0]="https://other.example/imagery";},
]) {
  const m=structuredClone(polar);mutate(m);
  assert.throws(()=>validatePolarManifest(m,base,fixture().observedAt));
}
console.log("48-hour history and polar source/coverage validation passed");

for (const bounds of [[-180, 68, -90, 90], [-180, -90, -90, -68]] as [number, number, number, number][]) {
  const mesh = createPolarBitmapMesh(bounds);
  assert.equal(mesh.vertexCount, 180 * 44 * 6);
  assert.equal(mesh.texCoords.length / 2, mesh.positions.length / 3);
  assert.ok(mesh.indices.every(index => index < mesh.positions.length / 3));
  for (let ring = 1; ring <= 44; ring++) {
    assert.ok(Math.abs(mesh.positions[ring * 3 + 1] - mesh.positions[(ring - 1) * 3 + 1]) <= 0.5);
  }
  assert.equal(mesh.positions[1], bounds[1]);
  assert.equal(mesh.positions[44 * 3 + 1], bounds[3]);
}
console.log("Dense north/south bitmap meshes avoid large pole triangles");
