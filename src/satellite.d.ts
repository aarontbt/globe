declare module "satellite.js" {
  export interface SatRec {
    satnum: string;
    epochyr: number;
    epochdays: number;
    error: number;
  }
  export interface EciVec3<T> { x: T; y: T; z: T; }
  export interface PositionAndVelocity {
    position: EciVec3<number> | boolean;
    velocity: EciVec3<number> | boolean;
  }
  export interface GeodeticLocation { longitude: number; latitude: number; height: number; }
  export function twoline2satrec(tleLine1: string, tleLine2: string): SatRec;
  export function propagate(satrec: SatRec, date: Date): PositionAndVelocity;
  export function eciToGeodetic(positionEci: EciVec3<number>, gmst: number): GeodeticLocation;
  export function gstime(date: Date): number;
  export function degreesLat(radians: number): number;
  export function degreesLong(radians: number): number;
}
