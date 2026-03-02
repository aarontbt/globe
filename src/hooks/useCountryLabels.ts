import { useState, useEffect } from "react";
import type { CountryLabel } from "../types";
export type { CountryLabel };

const COUNTRIES_URL =
  "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson";

// Module-level cache so the 180KB GeoJSON is fetched at most once per page load
let cachedLabels: CountryLabel[] | null = null;
let fetchPromise: Promise<CountryLabel[]> | null = null;

function bboxCenter(ring: number[][]): [number, number] {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

function bboxArea(ring: number[][]): number {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return (maxLon - minLon) * (maxLat - minLat);
}

function computeCentroid(geometry: any): [number, number] | null {
  if (geometry.type === "Polygon") {
    return bboxCenter(geometry.coordinates[0]);
  }
  if (geometry.type === "MultiPolygon") {
    // Use the polygon with the largest bounding-box area (handles Russia, USA, etc.)
    let bestRing: number[][] = geometry.coordinates[0][0];
    let bestArea = 0;
    for (const poly of geometry.coordinates) {
      const ring: number[][] = poly[0];
      const area = bboxArea(ring);
      if (area > bestArea) { bestArea = area; bestRing = ring; }
    }
    return bboxCenter(bestRing);
  }
  return null;
}

function parseLabels(geojson: any): CountryLabel[] {
  const result: CountryLabel[] = [];
  for (const feature of geojson.features) {
    const name: string =
      feature.properties?.ADMIN ||
      feature.properties?.NAME ||
      feature.properties?.name;
    if (!name) continue;
    const centroid = computeCentroid(feature.geometry);
    if (centroid) result.push({ name, coordinates: centroid });
  }
  return result;
}

function getLabels(): Promise<CountryLabel[]> {
  if (cachedLabels) return Promise.resolve(cachedLabels);
  if (!fetchPromise) {
    fetchPromise = fetch(COUNTRIES_URL)
      .then((r) => r.json())
      .then((geojson) => {
        cachedLabels = parseLabels(geojson);
        return cachedLabels;
      });
  }
  return fetchPromise;
}

export function useCountryLabels(): CountryLabel[] {
  const [labels, setLabels] = useState<CountryLabel[]>(() => cachedLabels ?? []);

  useEffect(() => {
    if (cachedLabels) return;
    getLabels().then(setLabels).catch(() => {});
  }, []);

  return labels;
}
