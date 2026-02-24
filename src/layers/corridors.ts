import { GeoJsonLayer } from "@deck.gl/layers";
import { densifyPath } from "../utils/interpolate";
import type { Corridor } from "../types";

export function createCorridorLayers(data: Corridor[]) {
  const features = data.map(c => ({
    type: "Feature" as const,
    geometry: { type: "LineString" as const, coordinates: densifyPath(c.path, 2) },
    properties: c,
  }));

  return [
    new GeoJsonLayer({
      id: "corridors-glow",
      data: features,
      filled: false,
      stroked: true,
      getLineColor: (f: any) => [...f.properties.color, 35],
      getLineWidth: (f: any) => f.properties.volume * 0.8,
      lineWidthUnits: "pixels",
      lineWidthMinPixels: 6,
      lineWidthMaxPixels: 32,
      lineCapRounded: true,
      lineJointRounded: true,
      pickable: true,
    }),
    new GeoJsonLayer({
      id: "corridors-core",
      data: features,
      filled: false,
      stroked: true,
      getLineColor: (f: any) => [...f.properties.color, 210],
      getLineWidth: (f: any) => f.properties.volume * 0.3,
      lineWidthUnits: "pixels",
      lineWidthMinPixels: 2,
      lineWidthMaxPixels: 9,
      lineCapRounded: true,
      lineJointRounded: true,
      pickable: true,
    }),
  ];
}
