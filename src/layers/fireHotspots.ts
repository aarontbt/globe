import { ScatterplotLayer } from "deck.gl";
import type { FireHotspot } from "../types";

function frpColor(frp: number): [number, number, number, number] {
  // Interpolate yellow → orange → red based on FRP (0–200 MW scale)
  const t = Math.min(1, frp / 150);
  const r = 255;
  const g = Math.round(200 * (1 - t));   // 200 → 0
  const b = Math.round(50  * (1 - t));   // 50  → 0
  const a = Math.round(160 + 60 * t);    // 160 → 220
  return [r, g, b, a];
}

function frpRadius(frp: number): number {
  return Math.max(3000, Math.min(22000, frp * 180));
}

export function createFireHotspotsLayer(hotspots: FireHotspot[]) {
  return new ScatterplotLayer<FireHotspot>({
    id: "fire-hotspots",
    data: hotspots,
    getPosition: (d) => [d.longitude, d.latitude],
    getRadius: (d) => frpRadius(d.frp),
    getFillColor: (d) => frpColor(d.frp),
    radiusMinPixels: 3,
    pickable: true,
  });
}
