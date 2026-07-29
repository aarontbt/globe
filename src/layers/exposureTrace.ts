import { ArcLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { ExposureTraceData, PublicEntity } from "../types";

interface TraceRoute {
  id: string;
  traceTitle: string;
  from: PublicEntity;
  to: PublicEntity;
}

export function createExposureTraceLayers(data: ExposureTraceData, activeTraceId: string) {
  const trace = data.traces.find((item) => item.id === activeTraceId) ?? data.traces[0];
  if (!trace) return [];

  const entities = new Map(data.entities.map((entity) => [entity.id, entity]));
  const routeEntities = trace.routeEntityIds
    .map((id) => entities.get(id))
    .filter((entity): entity is PublicEntity => Boolean(entity?.coordinates));

  const routes: TraceRoute[] = routeEntities.slice(0, -1).map((from, index) => ({
    id: `${trace.id}-${from.id}-${routeEntities[index + 1].id}`,
    traceTitle: trace.title,
    from,
    to: routeEntities[index + 1],
  }));

  return [
    new ArcLayer<TraceRoute>({
      id: "exposure-trace-arcs",
      data: routes,
      getSourcePosition: (route) => route.from.coordinates!,
      getTargetPosition: (route) => route.to.coordinates!,
      getSourceColor: [56, 189, 248, 235],
      getTargetColor: [167, 139, 250, 235],
      getWidth: 3,
      widthUnits: "pixels",
      greatCircle: true,
      pickable: true,
    }),
    new ScatterplotLayer<PublicEntity>({
      id: "exposure-trace-nodes",
      data: routeEntities,
      getPosition: (entity) => entity.coordinates!,
      getRadius: 65000,
      radiusMinPixels: 5,
      radiusMaxPixels: 12,
      getFillColor: [56, 189, 248, 225],
      getLineColor: [224, 242, 254, 255],
      lineWidthMinPixels: 1.2,
      stroked: true,
      pickable: true,
    }),
    new TextLayer<PublicEntity>({
      id: "exposure-trace-labels",
      data: routeEntities,
      getPosition: (entity) => entity.coordinates!,
      getText: (entity) => entity.shortName,
      getSize: 11,
      sizeUnits: "pixels",
      getColor: [224, 242, 254, 220],
      getPixelOffset: [0, -13],
      getTextAnchor: "middle",
      getAlignmentBaseline: "bottom",
      billboard: true,
      pickable: false,
    }),
  ];
}
