import { ArcLayer } from "deck.gl";
import type { TradeArc } from "../types";

export function createTradeArcsLayer(data: TradeArc[]) {
  return new ArcLayer<TradeArc>({
    id: "trade-arcs",
    data,
    getSourcePosition: (d) => d.fromCoords,
    getTargetPosition: (d) => d.toCoords,
    getSourceColor: (d) => [...d.color, 180],
    getTargetColor: (d) => [...d.color, 180],
    getWidth: (d) => Math.max(1, d.valueBn / 5),
    greatCircle: true,
    pickable: true,
    autoHighlight: true,
    widthMinPixels: 1,
    widthMaxPixels: 6,
  });
}
