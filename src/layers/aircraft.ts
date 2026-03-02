import { IconLayer } from "deck.gl";
import type { Aircraft } from "../types";

// Airplane silhouette pointing "up" (north) so rotation by heading works correctly
const PLANE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <g transform="translate(32,32)">
    <ellipse cx="0" cy="0" rx="4.5" ry="20" fill="white"/>
    <path d="M-4,-1 L-24,16 L-24,20 L4,8 Z" fill="white"/>
    <path d="M4,-1 L24,16 L24,20 L-4,8 Z" fill="white"/>
    <path d="M-3,13 L-12,22 L-12,25 L3,18 Z" fill="rgba(255,255,255,0.75)"/>
    <path d="M3,13 L12,22 L12,25 L-3,18 Z" fill="rgba(255,255,255,0.75)"/>
  </g>
</svg>`;

const PLANE_ATLAS = `data:image/svg+xml,${encodeURIComponent(PLANE_SVG)}`;

const ICON_MAPPING = {
  plane: { x: 0, y: 0, width: 64, height: 64, mask: false },
};

export function createAircraftLayer(aircraft: Aircraft[]) {
  return new IconLayer<Aircraft>({
    id: "aircraft-dots",
    data: aircraft,
    iconAtlas: PLANE_ATLAS,
    iconMapping: ICON_MAPPING,
    getIcon: () => "plane",
    getPosition: (d) => [d.lon, d.lat, d.altitudeM],
    getSize: 18,
    // deck.gl rotates CCW; aircraft heading is CW from north, so negate
    getAngle: (d) => -d.heading,
    sizeUnits: "pixels",
    pickable: true,
    updateTriggers: {
      getPosition: aircraft,
      getAngle: aircraft,
    },
  });
}
