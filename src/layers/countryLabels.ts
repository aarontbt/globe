import { TextLayer } from "deck.gl";
import type { CountryLabel } from "../types";

export function createCountryLabelsLayer(labels: CountryLabel[]) {
  return new TextLayer<CountryLabel>({
    id: "country-labels",
    data: labels,
    getText: (d) => d.name,
    getPosition: (d) => [d.coordinates[0], d.coordinates[1], 0],
    // Muted light blue so labels read as background, behind active data layers
    getColor: [100, 160, 215, 160],
    getSize: 11,
    // _GlobeView's projection matrix inverts both axes of the local surface frame,
    // which is a net 180° rotation of any billboard:false geometry. Counteract it here.
    getAngle: 180,
    getTextAnchor: "middle",
    getAlignmentBaseline: "center",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontWeight: "600",
    fontSettings: { sdf: true, fontSize: 32, buffer: 4 },
    outlineWidth: 1.5,
    outlineColor: [5, 10, 25, 180],
    billboard: false,
    pickable: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parameters: { depthTest: true } as any,
  });
}
