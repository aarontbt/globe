import { GeoJsonLayer, PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { cycloneColor, cycloneMarker, probabilityCircle, utcLabel } from "../domain/cyclone";
import type { CyclonePoint, CycloneStorm, CyclonePosition } from "../types/cyclone";
import { FONT_SANS } from "../styles/fonts";

export interface CycloneMapPoint { storm: CycloneStorm; point: CyclonePoint; current: boolean }
const parameters = { depthCompare: "less-equal", depthWriteEnabled: false, cullMode: "none" } as const;
function nearCamera(position: number[], camera: { lon: number; lat: number }) {
  const rad = Math.PI / 180;
  const dot = Math.sin(position[1] * rad) * Math.sin(camera.lat * rad) + Math.cos(position[1] * rad) * Math.cos(camera.lat * rad) * Math.cos((position[0] - camera.lon) * rad);
  return dot > Math.cos(72 * rad);
}
export function createCycloneForecastLayers(storms: CycloneStorm[], selected: CycloneStorm | null, showUncertainty: boolean, camera: { lon: number; lat: number; zoom?: number }) {
  if (!selected) return [];
  const points: CycloneMapPoint[] = [
    ...storms.filter(s => s.id !== selected.id).map(storm => ({ storm, point: storm.points[0], current: true })),
    ...selected.points.map((point, index) => ({ storm: selected, point, current: index === 0 })),
  ];
  const uncertainty = showUncertainty ? selected.uncertaintyKind === "cone" && selected.cone ? [
    { type: "Feature" as const, properties: {}, geometry: selected.cone },
  ] : selected.uncertaintyKind === "probability-circles" ? selected.points.filter(p => p.probabilityRadiusKm !== null).map(p => ({
    type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [probabilityCircle(p.position, p.probabilityRadiusKm!)] },
  })) : [] : [];
  // Keep dated labels legible at overview scale. All source points remain pickable.
  const labelBoxes: { x: number; y: number }[] = [];
  const candidates = points.filter(p => p.storm.id === selected.id && nearCamera(p.point.position, camera));
  const priority = candidates.length > 1 ? [candidates[0], candidates[candidates.length - 1], ...candidates.slice(1, -1)] : candidates;
  const labels = priority.filter(({ point }) => {
    const rad = Math.PI / 180, radius = 64 * 2 ** (camera.zoom ?? 3);
    const [lon, lat] = point.position.map(v => v * rad);
    const delta = lon - camera.lon * rad, phi = camera.lat * rad;
    const box = { x: radius * Math.cos(lat) * Math.sin(delta), y: radius * (Math.cos(phi) * Math.sin(lat) - Math.sin(phi) * Math.cos(lat) * Math.cos(delta)) };
    if (labelBoxes.some(other => Math.abs(box.x - other.x) < 130 && Math.abs(box.y - other.y) < 18)) return false;
    labelBoxes.push(box);
    return true;
  });
  return [
    new GeoJsonLayer({ id: "cyclone-uncertainty", data: { type: "FeatureCollection", features: uncertainty },
      filled: true, stroked: true, getFillColor: [186, 230, 253, 32], getLineColor: [224, 242, 254, 150],
      getLineWidth: 1, lineWidthUnits: "pixels", wrapLongitude: true, pickable: false, parameters }),
    new PathLayer<CyclonePosition[]>({ id: "cyclone-past-track", data: selected.pastTrack,
      getPath: p => p.map(v => [v[0], v[1], 1500] as [number, number, number]), getColor: [148, 163, 184, 170],
      getWidth: 1.5, widthUnits: "pixels", wrapLongitude: true, pickable: false, parameters }),
    new PathLayer<CycloneStorm>({ id: "cyclone-forecast-track", data: [selected],
      getPath: s => s.points.map(p => [p.position[0], p.position[1], 1500] as [number, number, number]), getColor: [251, 113, 133, 245],
      getWidth: 2.5, widthUnits: "pixels", wrapLongitude: true, pickable: false, parameters }),
    new ScatterplotLayer<CycloneMapPoint>({ id: "cyclone-forecast-points", data: points,
      getPosition: d => [d.point.position[0], d.point.position[1], 2000], getRadius: d => d.current ? 10 : 7,
      radiusUnits: "pixels", getFillColor: d => cycloneColor(d.point, d.storm.agency),
      stroked: true, getLineColor: [255, 255, 255, 220], lineWidthUnits: "pixels", getLineWidth: d => d.current ? 2 : 1,
      pickable: true, parameters }),
    new TextLayer<CycloneMapPoint>({ id: "cyclone-intensity-labels", data: points.filter(p => nearCamera(p.point.position, camera)),
      getPosition: d => [d.point.position[0], d.point.position[1], 3000], getText: d => cycloneMarker(d.point, d.storm.agency),
      getSize: 10, getColor: [8, 12, 22, 255], fontFamily: FONT_SANS, fontWeight: 800,
      getTextAnchor: "middle", getAlignmentBaseline: "center", billboard: true, parameters, pickable: false }),
    new TextLayer<CycloneMapPoint>({ id: "cyclone-time-labels", data: labels,
      getPosition: d => [d.point.position[0], d.point.position[1], 3000],
      getText: d => d.current ? `${d.storm.name} · analysis` : utcLabel(d.point.validAt),
      getPixelOffset: [18, 0], getTextAnchor: "start", getAlignmentBaseline: "center", getSize: 10,
      getColor: [241, 245, 249, 255], background: true, getBackgroundColor: [8, 12, 22, 215], backgroundPadding: [4, 3],
      fontFamily: FONT_SANS, fontWeight: 600, billboard: true, parameters, pickable: false }),
  ];
}
