import { ScatterplotLayer } from "@deck.gl/layers";
import type { GlobeEvent, EventCategory } from "../types";

export const CATEGORY_COLORS: Record<EventCategory, [number, number, number]> = {
  security:   [239,  68,  68],
  political:  [168,  85, 247],
  economic:   [ 34, 211, 238],
  climate:    [ 74, 222, 128],
  election:   [251, 146,  60],
  diplomatic: [250, 204,  21],
};

interface RingDatum {
  id: string;
  coordinates: [number, number];
  phase: number; // 0–1
  color: [number, number, number];
}

/**
 * Create three animated ripple rings per event at staggered phases.
 */
export function createEventRingsLayer(
  events: GlobeEvent[],
  pulse: number,
  activeCategories: Set<EventCategory>
) {
  const rings: RingDatum[] = [];
  for (const evt of events) {
    if (!activeCategories.has(evt.category)) continue;
    const color = CATEGORY_COLORS[evt.category];
    for (let i = 0; i < 3; i++) {
      rings.push({
        id: `${evt.id}-ring-${i}`,
        coordinates: evt.coordinates,
        phase: (pulse + i / 3) % 1,
        color,
      });
    }
  }

  return new ScatterplotLayer<RingDatum>({
    id: "event-rings",
    data: rings,
    getPosition: d => d.coordinates,
    getRadius: d => 4 + d.phase * 12,
    getFillColor: d => [...d.color, Math.max(0, Math.round((1 - d.phase) * 60))] as [number,number,number,number],
    radiusUnits: "pixels",
    stroked: false,
    pickable: false,
    parameters: { depthTest: true, depthMask: false },
    updateTriggers: {
      getRadius: pulse,
      getFillColor: pulse,
    },
  });
}

/**
 * Core dot layer — always rendered on top of rings, pickable.
 */
export function createEventDotsLayer(
  events: GlobeEvent[],
  activeCategories: Set<EventCategory>,
  selectedId: string | null
) {
  const visible = events.filter(e => activeCategories.has(e.category));

  return new ScatterplotLayer<GlobeEvent>({
    id: "event-dots",
    data: visible,
    getPosition: d => d.coordinates,
    getRadius: d => (d.id === selectedId ? 8 : 5),
    getFillColor: d => {
      const c = CATEGORY_COLORS[d.category];
      return d.id === selectedId
        ? [255, 255, 255, 255]
        : [...c, 230] as [number, number, number, number];
    },
    getLineColor: d => {
      const c = CATEGORY_COLORS[d.category];
      return [...c, 255] as [number, number, number, number];
    },
    lineWidthMinPixels: 1.5,
    stroked: true,
    filled: true,
    radiusUnits: "pixels",
    pickable: true,
    parameters: { depthTest: true, depthMask: false },
    autoHighlight: true,
    highlightColor: [255, 255, 255, 60],
    updateTriggers: {
      getRadius: selectedId,
      getFillColor: selectedId,
    },
  });
}
