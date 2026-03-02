import { ScatterplotLayer } from "@deck.gl/layers";
import type { GlobeEvent, EventCategory } from "../types";
import type { ImpactState } from "../hooks/useAsteroidImpacts";

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
    parameters: { depthTest: true, depthMask: false } as object,
    updateTriggers: {
      getRadius: pulse,
      getFillColor: pulse,
    },
  });
}

/**
 * Asteroid impact animation layers for newly-arrived events.
 *
 * Each impact runs a 2.2s sequence:
 *   - Bright yellow-white flash: expands to ~50px then vanishes by progress 0.4
 *   - 3 shockwave rings: fast-expanding, each offset by 0.2 in phase, fade by progress 0.8
 */
export function createAsteroidImpactLayers(impacts: ImpactState[]) {
  if (impacts.length === 0) return [];

  // Build ring data: 3 rings per impact at staggered phases
  const ringData = impacts.flatMap(imp =>
    [0, 1, 2].map(r => ({ ...imp, ringIdx: r }))
  );

  const shockwaveLayer = new ScatterplotLayer<typeof ringData[0]>({
    id: "asteroid-shockwave",
    data: ringData,
    getPosition: d => d.coordinates,
    getRadius: d => {
      const phase = (d.progress * 1.6 + d.ringIdx * 0.22) % 1;
      return 5 + phase * 42;
    },
    getFillColor: d => {
      const phase = (d.progress * 1.6 + d.ringIdx * 0.22) % 1;
      const alpha = Math.round(Math.max(0, 1 - phase) * 140);
      return [...d.color, alpha] as [number, number, number, number];
    },
    radiusUnits: "pixels",
    stroked: false,
    pickable: false,
    parameters: { depthTest: true, depthMask: false } as object,
  });

  // Flash burst: peaks fast, gone by progress 0.45
  const flashLayer = new ScatterplotLayer<ImpactState>({
    id: "asteroid-flash",
    data: impacts,
    getPosition: d => d.coordinates,
    getRadius: d => {
      const t = Math.max(0, 1 - d.progress / 0.35);
      return t * t * 52;
    },
    getFillColor: d => {
      const alpha = Math.round(Math.max(0, 1 - d.progress / 0.45) * 255);
      return [255, 220, 90, alpha];
    },
    radiusUnits: "pixels",
    stroked: false,
    pickable: false,
    parameters: { depthTest: true, depthMask: false } as object,
  });

  return [shockwaveLayer, flashLayer];
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
    parameters: { depthTest: true, depthMask: false } as object,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 60],
    updateTriggers: {
      getRadius: selectedId,
      getFillColor: selectedId,
    },
  });
}
