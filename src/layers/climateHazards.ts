import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { CLIMATE_ALERT_COLORS, isClimateHazardActive } from "../domain/climate";
import type { ClimateAlertLevel, ClimateHazard, ClimateImpact, ClimateReadModel } from "../types/climate";

function color(level: ClimateAlertLevel, alpha: number): [number, number, number, number] {
  return [...CLIMATE_ALERT_COLORS[level], alpha];
}

export function createClimateHazardLayers(
  data: ClimateReadModel,
  activeAlerts: Set<ClimateAlertLevel>,
  selectedHazardId: string | null,
) {
  const hazards = data.hazards.filter((hazard) => isClimateHazardActive(hazard) && activeAlerts.has(hazard.alertLevel));
  const footprints = hazards
    .filter((hazard) => hazard.geometry.type !== "Point")
    .map((hazard) => ({ type: "Feature" as const, geometry: hazard.geometry, properties: { hazard } }));
  const selectedImpacts = selectedHazardId
    ? data.impacts.filter((impact) => impact.hazardId === selectedHazardId && impact.targetCoordinates)
    : [];

  return [
    new GeoJsonLayer({
      id: "climate-hazard-footprints",
      data: { type: "FeatureCollection", features: footprints },
      filled: true,
      stroked: true,
      getFillColor: (feature: any) => color(feature.properties.hazard.alertLevel, feature.properties.hazard.id === selectedHazardId ? 95 : 42),
      getLineColor: (feature: any) => color(feature.properties.hazard.alertLevel, 235),
      getLineWidth: (feature: any) => feature.properties.hazard.id === selectedHazardId ? 3 : 1.5,
      lineWidthUnits: "pixels",
      lineWidthMinPixels: 1,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 45],
      parameters: { depthTest: true, depthMask: false } as object,
      updateTriggers: { getFillColor: selectedHazardId, getLineWidth: selectedHazardId },
    }),
    new ScatterplotLayer<ClimateHazard>({
      id: "climate-hazard-centroids",
      data: hazards,
      getPosition: (hazard) => hazard.centroid,
      getRadius: (hazard) => hazard.id === selectedHazardId ? 9 : 6,
      getFillColor: (hazard) => hazard.id === selectedHazardId ? [255, 255, 255, 250] : color(hazard.alertLevel, 235),
      getLineColor: (hazard) => color(hazard.alertLevel, 255),
      radiusUnits: "pixels",
      lineWidthMinPixels: 2,
      stroked: true,
      pickable: true,
      autoHighlight: true,
      parameters: { depthTest: true, depthMask: false } as object,
      updateTriggers: { getRadius: selectedHazardId, getFillColor: selectedHazardId },
    }),
    new ScatterplotLayer<ClimateImpact>({
      id: "climate-impact-targets",
      data: selectedImpacts,
      getPosition: (impact) => impact.targetCoordinates!,
      getRadius: 7,
      getFillColor: [255, 255, 255, 245],
      getLineColor: [34, 211, 238, 255],
      radiusUnits: "pixels",
      lineWidthMinPixels: 2,
      stroked: true,
      pickable: true,
      parameters: { depthTest: true, depthMask: false } as object,
    }),
  ];
}
