import { IconLayer } from "deck.gl";
import type { Satellite } from "../types";

// Satellite icon: body + solar panels + antenna, in cyan
const SAT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="24" y="24" width="16" height="16" rx="2" fill="#00ffdc"/>
  <rect x="4" y="27" width="18" height="10" rx="1" fill="#00ccaa"/>
  <line x1="5" y1="30" x2="22" y2="30" stroke="#004433" stroke-width="1.5"/>
  <line x1="5" y1="34" x2="22" y2="34" stroke="#004433" stroke-width="1.5"/>
  <rect x="42" y="27" width="18" height="10" rx="1" fill="#00ccaa"/>
  <line x1="42" y1="30" x2="59" y2="30" stroke="#004433" stroke-width="1.5"/>
  <line x1="42" y1="34" x2="59" y2="34" stroke="#004433" stroke-width="1.5"/>
  <line x1="32" y1="13" x2="32" y2="24" stroke="#00ffdc" stroke-width="2"/>
  <circle cx="32" cy="11" r="4" fill="none" stroke="#00ffdc" stroke-width="2"/>
  <circle cx="32" cy="11" r="1.5" fill="#00ffdc"/>
</svg>`;

const SAT_ATLAS = `data:image/svg+xml,${encodeURIComponent(SAT_SVG)}`;

const ICON_MAPPING = {
  satellite: { x: 0, y: 0, width: 64, height: 64, mask: false },
};

export function createSatellitesLayer(satellites: Satellite[]) {
  return new IconLayer<Satellite>({
    id: "satellites",
    data: satellites,
    iconAtlas: SAT_ATLAS,
    iconMapping: ICON_MAPPING,
    getIcon: () => "satellite",
    getPosition: (d) => [d.lon, d.lat, d.altitudeKm * 1000],
    getSize: 20,
    sizeUnits: "pixels",
    pickable: true,
    updateTriggers: {
      getPosition: satellites,
    },
  });
}
