import { ScatterplotLayer } from "deck.gl";
import type { AnimatedVessel } from "../types";

export function createAnimatedVesselsLayer(vessels: AnimatedVessel[]) {
  return new ScatterplotLayer<AnimatedVessel>({
    id: "animated-vessels",
    data: vessels,
    getPosition: (d) => d.position,
    getRadius: 200,
    getFillColor: [255, 255, 255, 200],
    radiusMinPixels: 2,
    radiusMaxPixels: 4,
    pickable: false,
  });
}
