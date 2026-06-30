import { useMemo, useRef, useState, useEffect } from "react";
import type { AnimatedVessel } from "../types";
import { interpolateAlongPath } from "../utils/interpolate";
import { useStaticJson } from "./useStaticJson";

interface VesselState {
  id: number;
  pathIndex: number; // index into allPaths
  offset: number;
  speed: number;
}

interface GlobalLanePaths {
  major: [number, number][][];
  middle: [number, number][][];
}

const EMPTY_LANE_PATHS: GlobalLanePaths = { major: [], middle: [] };

// Budget: 2 vessels per major lane, 1 per middle lane (capped at 130 total)
const VESSEL_BUDGET = 130;
const TARGET_FPS = 30;
const FRAME_MS = 1000 / TARGET_FPS;
const NOMINAL_FRAME_MS = 1000 / 60; // speeds were originally tuned for 60fps

function initializeVessels(majorPaths: [number, number][][], middlePaths: [number, number][][]): VesselState[] {
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
  const { data: globalLanePaths } = useStaticJson<GlobalLanePaths>("/data/global-lane-paths.json", EMPTY_LANE_PATHS);
  const majorPaths = globalLanePaths.major;
  const middlePaths = globalLanePaths.middle;
  const allPaths = useMemo(() => [...majorPaths, ...middlePaths], [majorPaths, middlePaths]);
  const vesselsRef = useRef<VesselState[]>([]);
  const rafIdRef = useRef<number>(0);

  const computePositions = (states: VesselState[]): AnimatedVessel[] =>
    states
      .filter((v) => allPaths[v.pathIndex]?.length > 0)
      .map((v) => ({
        id: v.id,
        laneIndex: v.pathIndex,
        offset: v.offset,
        speed: v.speed,
        position: interpolateAlongPath(allPaths[v.pathIndex], v.offset),
      }));

  const [positions, setPositions] = useState<AnimatedVessel[]>([]);

  const lastFrameTimeRef = useRef<number>(0);

  useEffect(() => {
    if (allPaths.length === 0) {
      vesselsRef.current = [];
      setPositions([]);
      return;
    }

    vesselsRef.current = initializeVessels(majorPaths, middlePaths);
    setPositions(computePositions(vesselsRef.current));
    lastFrameTimeRef.current = 0;

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
  }, [allPaths, majorPaths, middlePaths]);

  return positions;
}
