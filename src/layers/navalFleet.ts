import { ScatterplotLayer } from "deck.gl";
import type { FleetUnit, FleetUnitType } from "../types";

// Radius in metres by unit type
const TYPE_RADII: Record<FleetUnitType, number> = {
  "carrier-strike-group":    28000,
  "amphibious-ready-group":  20000,
  cruiser:                   14000,
  destroyer:                 12000,
  submarine:                 10000,
  supply:                     8000,
};

const NAVY_BLUE:  [number, number, number, number] = [ 30,  80, 200, 185];
const RING_COLOR: [number, number, number, number] = [ 60, 120, 230, 200];

export function createNavalFleetLayer(units: FleetUnit[]) {
  return [
    // Outer ring — stroke only
    new ScatterplotLayer<FleetUnit>({
      id: "naval-fleet-ring",
      data: units,
      getPosition: (d) => d.coordinates,
      getRadius: (d) => TYPE_RADII[d.type],
      getFillColor: [0, 0, 0, 0],
      getLineColor: RING_COLOR,
      stroked: true,
      filled: false,
      lineWidthMinPixels: 1.5,
      radiusMinPixels: 5,
      pickable: false,
    }),
    // Inner fill — pickable for tooltips
    new ScatterplotLayer<FleetUnit>({
      id: "naval-fleet",
      data: units,
      getPosition: (d) => d.coordinates,
      getRadius: (d) => TYPE_RADII[d.type] * 0.55,
      getFillColor: NAVY_BLUE,
      radiusMinPixels: 3,
      pickable: true,
    }),
  ];
}
