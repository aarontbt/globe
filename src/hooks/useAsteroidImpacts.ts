import { useState, useEffect, useRef } from "react";
import type { GlobeEvent } from "../types";
import { CATEGORY_COLORS } from "../layers/globeEvents";

export interface ImpactState {
  id: string;
  coordinates: [number, number];
  color: [number, number, number];
  progress: number; // 0 → 1 over DURATION_S seconds
}

const DURATION_S = 2.2;
const MAX_IMPACTS = 8;

/**
 * Tracks "asteroid" impact animations for newly-arrived events.
 * On initial load newEvents is [] so nothing animates.
 * On subsequent polls, each genuinely new event gets a 2.2s impact sequence.
 */
export function useAsteroidImpacts(newEvents: GlobeEvent[]): ImpactState[] {
  const [impacts, setImpacts] = useState<ImpactState[]>([]);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const hasImpacts = impacts.length > 0;

  // Enqueue new impacts when fresh events arrive
  useEffect(() => {
    if (newEvents.length === 0) return;
    const stamp = Date.now();
    const fresh: ImpactState[] = newEvents.slice(0, MAX_IMPACTS).map(e => ({
      id: `${e.id}-${stamp}`,
      coordinates: e.coordinates,
      color: CATEGORY_COLORS[e.category],
      progress: 0,
    }));
    setImpacts(prev => [...prev, ...fresh].slice(0, MAX_IMPACTS));
  }, [newEvents]);

  // Drive animation — starts when impacts appear, stops when they all complete
  useEffect(() => {
    if (!hasImpacts) return;
    lastTimeRef.current = 0;

    const tick = (time: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      setImpacts(prev => {
        const next = prev
          .map(imp => ({ ...imp, progress: imp.progress + delta / DURATION_S }))
          .filter(imp => imp.progress < 1);
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [hasImpacts]);

  return impacts;
}
