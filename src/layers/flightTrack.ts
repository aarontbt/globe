import { PathLayer } from "@deck.gl/layers";
import type { FlightTrack } from "../types";

export function createFlightTrackLayer(track: FlightTrack): PathLayer<unknown> {
  return new PathLayer({
    id: "flight-track",
    data: [{ path: track.path }],
    getPath: (d: unknown) => (d as { path: [number, number, number][] }).path,
    getColor: [168, 85, 247, 220],
    getWidth: 2,
    widthUnits: "pixels",
    pickable: false,
  });
}
