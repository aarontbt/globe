import { PathLayer } from "@deck.gl/layers";
import type { FlightTrack } from "../types";

type PathData = { path: [number, number, number][] };

export function createFlightTrackLayer(track: FlightTrack): PathLayer<PathData> {
  return new PathLayer<PathData>({
    id: "flight-track",
    data: [{ path: track.path }],
    getPath: (d: PathData) => d.path,
    getColor: [168, 85, 247, 220],
    getWidth: 2,
    widthUnits: "pixels",
    pickable: false,
  });
}
