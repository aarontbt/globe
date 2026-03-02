import { ArcLayer, ScatterplotLayer } from "deck.gl";
import type { OilNode, OilRoute } from "../types";

const COLORS = {
  crudeArcSource: [255, 176, 46] as [number, number, number],
  crudeArcTarget: [204, 120, 20] as [number, number, number],
  productArcSource: [70, 140, 220] as [number, number, number],
  productArcTarget: [40, 100, 180] as [number, number, number],
  production: [255, 160, 30] as [number, number, number],
  refinery: [220, 80, 40] as [number, number, number],
  storage: [160, 160, 180] as [number, number, number],
  consumption: [100, 200, 255] as [number, number, number],
};

function nodeRadius(d: OilNode): number {
  const cap = d.type === "storage" ? (d.capacityMb ?? 1) / 10 : d.capacityMbpd;
  return Math.sqrt(Math.max(cap, 0.05)) * 40000;
}

export function createOilSupplyChainLayers(
  nodes: OilNode[],
  routes: OilRoute[],
) {
  const crudeRoutes = routes.filter((r) => r.type === "crude");
  const productRoutes = routes.filter((r) => r.type === "product");

  const production = nodes.filter((n) => n.type === "production");
  const refineries = nodes.filter((n) => n.type === "refinery");
  const storage = nodes.filter((n) => n.type === "storage");
  const consumption = nodes.filter((n) => n.type === "consumption");

  return [
    // Arcs first (render underneath)
    new ArcLayer<OilRoute>({
      id: "oil-crude-routes",
      data: crudeRoutes,
      getSourcePosition: (d) => d.fromCoords,
      getTargetPosition: (d) => d.toCoords,
      getSourceColor: [...COLORS.crudeArcSource, 180],
      getTargetColor: [...COLORS.crudeArcTarget, 180],
      getWidth: (d) => Math.max(1, Math.sqrt(d.volumeMbpd) * 3),
      greatCircle: true,
      pickable: true,
      autoHighlight: true,
      widthMinPixels: 1,
      widthMaxPixels: 5,
    }),
    new ArcLayer<OilRoute>({
      id: "oil-product-routes",
      data: productRoutes,
      getSourcePosition: (d) => d.fromCoords,
      getTargetPosition: (d) => d.toCoords,
      getSourceColor: [...COLORS.productArcSource, 180],
      getTargetColor: [...COLORS.productArcTarget, 180],
      getWidth: (d) => Math.max(1, Math.sqrt(d.volumeMbpd) * 3),
      greatCircle: true,
      pickable: true,
      autoHighlight: true,
      widthMinPixels: 1,
      widthMaxPixels: 4,
    }),
    // Nodes on top
    new ScatterplotLayer<OilNode>({
      id: "oil-production",
      data: production,
      getPosition: (d) => d.coordinates,
      getRadius: nodeRadius,
      getFillColor: [...COLORS.production, 210],
      radiusUnits: "meters",
      pickable: true,
      autoHighlight: true,
      stroked: true,
      getLineColor: [255, 255, 255, 80],
      lineWidthMinPixels: 1,
    }),
    new ScatterplotLayer<OilNode>({
      id: "oil-refineries",
      data: refineries,
      getPosition: (d) => d.coordinates,
      getRadius: nodeRadius,
      getFillColor: [...COLORS.refinery, 210],
      radiusUnits: "meters",
      pickable: true,
      autoHighlight: true,
      stroked: true,
      getLineColor: [255, 255, 255, 80],
      lineWidthMinPixels: 1,
    }),
    new ScatterplotLayer<OilNode>({
      id: "oil-storage",
      data: storage,
      getPosition: (d) => d.coordinates,
      getRadius: nodeRadius,
      getFillColor: [...COLORS.storage, 210],
      radiusUnits: "meters",
      pickable: true,
      autoHighlight: true,
      stroked: true,
      getLineColor: [255, 255, 255, 80],
      lineWidthMinPixels: 1,
    }),
    new ScatterplotLayer<OilNode>({
      id: "oil-consumption",
      data: consumption,
      getPosition: (d) => d.coordinates,
      getRadius: nodeRadius,
      getFillColor: [...COLORS.consumption, 210],
      radiusUnits: "meters",
      pickable: true,
      autoHighlight: true,
      stroked: true,
      getLineColor: [255, 255, 255, 80],
      lineWidthMinPixels: 1,
    }),
  ];
}
