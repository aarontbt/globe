import { useRef, useState, useEffect } from "react";
import type { AnimatedVessel } from "../types";
import { interpolateAlongPath } from "../utils/interpolate";
import globalLanePaths from "../data/global-lane-paths.json";

interface VesselState {
  id: number;
  pathIndex: number; // index into allPaths
  offset: number;
  speed: number;
}

const majorPaths = globalLanePaths.major as [number, number][][];
const middlePaths = globalLanePaths.middle as [number, number][][];
const allPaths: [number, number][][] = [...majorPaths, ...middlePaths];

// Budget: 2 vessels per major lane, 1 per middle lane (capped at 130 total)
const VESSEL_BUDGET = 130;
const TARGET_FPS = 30;
const FRAME_MS = 1000 / TARGET_FPS;
const NOMINAL_FRAME_MS = 1000 / 60; // speeds were originally tuned for 60fps

function initializeVessels(): VesselState[] {
  const vessels: VesselState[] = [];
  let id = 0;

  // 2 evenly-spaced vessels per major lane — covers all 52 major lanes within budget
  for (let i = 0; i < majorPaths.length && id < VESSEL_BUDGET; i++) {
    for (let j = 0; j < 2 && id < VESSEL_BUDGET; j++) {
      vessels.push({
        id: id++,
        pathIndex: i,
        offset: j / 2 + (Math.random() - 0.5) * 0.05,
        speed: 0.00025 + Math.random() * 0.00035,
      });
    }
  }

  // 1 vessel per middle lane
  for (let i = 0; i < middlePaths.length && id < VESSEL_BUDGET; i++) {
    vessels.push({
      id: id++,
      pathIndex: majorPaths.length + i,
      offset: Math.random(),
      speed: 0.0002 + Math.random() * 0.0003,
    });
  }

  return vessels;
}

export function useVesselAnimation(): AnimatedVessel[] {
  const vesselsRef = useRef<VesselState[]>(initializeVessels());
  const rafIdRef = useRef<number>(0);

  const computePositions = (states: VesselState[]): AnimatedVessel[] =>
    states.map((v) => ({
      id: v.id,
      laneIndex: v.pathIndex,
      offset: v.offset,
      speed: v.speed,
      position: interpolateAlongPath(allPaths[v.pathIndex], v.offset),
    }));

  const [positions, setPositions] = useState<AnimatedVessel[]>(() =>
    computePositions(vesselsRef.current)
  );

  const lastFrameTimeRef = useRef<number>(0);

  useEffect(() => {
    const animate = (time: number) => {
      if (lastFrameTimeRef.current > 0) {
        const elapsed = time - lastFrameTimeRef.current;
        if (elapsed >= FRAME_MS) {
          const scale = elapsed / NOMINAL_FRAME_MS;
          const vessels = vesselsRef.current;
          for (let i = 0; i < vessels.length; i++) {
            vessels[i].offset = (vessels[i].offset + vessels[i].speed * scale) % 1.0;
          }
          setPositions(computePositions(vessels));
          lastFrameTimeRef.current = time;
        }
      } else {
        lastFrameTimeRef.current = time;
      }
      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, []);

  return positions;
}
