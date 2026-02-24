import { GeoJsonLayer } from "@deck.gl/layers";
import { densifyPath } from "../utils/interpolate";

function densifyGeoJson(data: any) {
  if (!data?.features) return data;
  return {
    ...data,
    features: data.features.map((f: any) => {
      const geom = f.geometry;
      if (geom.type === "LineString") {
        return { ...f, geometry: { ...geom, coordinates: densifyPath(geom.coordinates, 2) } };
      }
      if (geom.type === "MultiLineString") {
        return { ...f, geometry: { ...geom, coordinates: geom.coordinates.map((line: [number,number][]) => densifyPath(line, 2)) } };
      }
      return f;
    }),
  };
}

// Global shipping lanes from real-world GeoJSON data (Major / Middle / Minor tiers)
export function createGlobalShippingLanesLayer() {
  return new GeoJsonLayer({
    id: "global-shipping-lanes",
    data: "/shipping_lanes.json",
    dataTransform: densifyGeoJson,
    stroked: false,
    filled: false,
    lineWidthUnits: "pixels",
    getLineColor: (f: any) => {
      const type: string = f.properties?.Type ?? "";
      if (type === "Major") return [0, 210, 255, 160];
      if (type === "Middle") return [0, 180, 230, 100];
      return [0, 150, 200, 55]; // Minor
    },
    getLineWidth: (f: any) => {
      const type: string = f.properties?.Type ?? "";
      if (type === "Major") return 2.5;
      if (type === "Middle") return 1.5;
      return 0.8; // Minor
    },
    pickable: false,
  });
}

