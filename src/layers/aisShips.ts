import { ScatterplotLayer } from "deck.gl";
import type { AISShip } from "../types";

export function createAISShipsLayer(ships: AISShip[]) {
  return new ScatterplotLayer<AISShip>({
    id: "ais-ships",
    data: ships,
    getPosition: (d) => d.coordinates,
    getFillColor: [255, 160, 50, 220],
    getRadius: 4000,
    radiusUnits: "meters",
    pickable: true,
    updateTriggers: {
      getPosition: ships,
    },
  });
}
