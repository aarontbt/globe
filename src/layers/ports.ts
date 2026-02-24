import { ScatterplotLayer } from "deck.gl";
import type { Port } from "../types";

export function createPortsLayer(data: Port[]) {
  return new ScatterplotLayer<Port>({
    id: "ports",
    data,
    getPosition: (d) => d.coordinates,
    getRadius: (d) => Math.sqrt(d.teu) * 50,
    getFillColor: (d) =>
      d.type === "asean" ? [0, 255, 200, 220] : [255, 200, 0, 200],
    getLineColor: [255, 255, 255, 80],
    stroked: true,
    lineWidthMinPixels: 1,
    radiusMinPixels: 3,
    radiusMaxPixels: 25,
    pickable: true,
    autoHighlight: true,
  });
}
