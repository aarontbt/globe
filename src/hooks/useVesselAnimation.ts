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

// Budget: 3 vessels per major lane, 1 per middle lane (capped at 200 total)
const VESSEL_BUDGET = 200;

function initializeVessels(): VesselState[] {
  const vessels: VesselState[] = [];
  let id = 0;

  // 3 evenly-spaced vessels per major lane
  for (let i = 0; i < majorPaths.length && id < VESSEL_BUDGET; i++) {
    for (let j = 0; j < 3 && id < VESSEL_BUDGET; j++) {
      vessels.push({
        id: id++,
        pathIndex: i,
        offset: j / 3 + (Math.random() - 0.5) * 0.05,
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

  useEffect(() => {
    const animate = () => {
      const vessels = vesselsRef.current;
      for (let i = 0; i < vessels.length; i++) {
        vessels[i].offset += vessels[i].speed;
        if (vessels[i].offset >= 1.0) vessels[i].offset -= 1.0;
      }
      setPositions(computePositions(vessels));
      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, []);

  return positions;
}
