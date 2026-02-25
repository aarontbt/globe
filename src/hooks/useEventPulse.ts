import { useEffect, useRef, useState } from "react";

const TARGET_FPS = 30;
const FRAME_MS = 1000 / TARGET_FPS;

/**
 * Returns a pulse value cycling from 0 → 1 at `speed` cycles/second.
 * Used to animate ripple rings on globe event markers.
 */
export function useEventPulse(speed = 0.6): number {
  const [pulse, setPulse] = useState(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const animate = (time: number) => {
      if (lastTimeRef.current !== 0) {
        const elapsed = time - lastTimeRef.current;
        if (elapsed >= FRAME_MS) {
          const delta = elapsed / 1000;
          setPulse(p => (p + delta * speed) % 1);
          lastTimeRef.current = time;
        }
      } else {
        lastTimeRef.current = time;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [speed]);

  return pulse;
}
