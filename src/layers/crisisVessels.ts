import { ScatterplotLayer, LineLayer } from "deck.gl";
import type { CrisisVessel, VesselType } from "../types";

const VESSEL_COLORS: Record<VesselType, [number, number, number, number]> = {
  tanker:       [251, 146,  60, 220],
  lng:          [ 34, 211, 238, 220],
  navy:         [ 96, 165, 250, 230],
  "dark-fleet": [160, 160, 180, 130],
  irgcn:        [239,  68,  68, 220],
  cargo:        [167, 243, 208, 200],
};

interface TrailSegment {
  from: [number, number];
  to: [number, number];
  color: [number, number, number, number];
}

function buildTrailSegments(vessels: CrisisVessel[]): TrailSegment[] {
  const segments: TrailSegment[] = [];
  for (const v of vessels) {
    if (!v.trail || v.trail.length === 0 || v.speed === 0) continue;
    const pts: [number, number][] = [...v.trail, v.coordinates];
    const [r, g, b] = VESSEL_COLORS[v.type];
    for (let i = 0; i < pts.length - 1; i++) {
      // fade from nearly invisible (oldest) to ~70% opacity (newest segment)
      const frac = (i + 1) / pts.length;
      segments.push({
        from: pts[i],
        to: pts[i + 1],
        color: [r, g, b, Math.round(160 * frac)],
      });
    }
  }
  return segments;
}

export function createCrisisVesselsLayer(vessels: CrisisVessel[]) {
  const normal = vessels.filter((v) => v.type !== "dark-fleet");
  const dark = vessels.filter((v) => v.type === "dark-fleet");
  const trailSegments = buildTrailSegments(vessels);

  return [
    // Fading trail lines
    new LineLayer<TrailSegment>({
      id: "crisis-vessel-trails",
      data: trailSegments,
      getSourcePosition: (d) => d.from,
      getTargetPosition: (d) => d.to,
      getColor: (d) => d.color,
      getWidth: 1.5,
      widthMinPixels: 1,
      widthMaxPixels: 2,
      pickable: false,
    }),
    // Ghost rings for dark-fleet / AIS-off vessels
    new ScatterplotLayer<CrisisVessel>({
      id: "crisis-vessels-dark",
      data: dark,
      getPosition: (d) => d.coordinates,
      getRadius: 9000,
      getFillColor: [160, 160, 180, 30],
      getLineColor: [160, 160, 180, 110],
      stroked: true,
      lineWidthMinPixels: 1,
      radiusMinPixels: 5,
      pickable: true,
    }),
    // Normal vessels — color by type, size by class
    new ScatterplotLayer<CrisisVessel>({
      id: "crisis-vessels",
      data: normal,
      getPosition: (d) => d.coordinates,
      getRadius: (d) => (d.type === "navy" && d.name.includes("CVN")) ? 18000 : 6000,
      getFillColor: (d) => VESSEL_COLORS[d.type],
      radiusMinPixels: 3,
      pickable: true,
    }),
  ];
}
