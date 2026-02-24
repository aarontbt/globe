/**
 * Densifies a path by inserting intermediate points every `maxDeg` degrees.
 * This ensures lines follow the globe surface rather than cutting through it.
 */
export function densifyPath(
  path: [number, number][],
  maxDeg = 5
): [number, number][] {
  if (path.length < 2) return path;
  const result: [number, number][] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const [lon0, lat0] = path[i - 1];
    const [lon1, lat1] = path[i];
    const dist = Math.sqrt((lon1 - lon0) ** 2 + (lat1 - lat0) ** 2);
    const steps = Math.ceil(dist / maxDeg);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      result.push([lon0 + t * (lon1 - lon0), lat0 + t * (lat1 - lat0)]);
    }
  }
  return result;
}

/**
 * Interpolates a position along a polyline path at a given offset (0-1).
 * Uses simple Euclidean distance between coordinate pairs.
 */
export function interpolateAlongPath(
  path: [number, number][],
  offset: number
): [number, number] {
  if (path.length === 0) {
    return [0, 0];
  }

  if (offset <= 0 || path.length === 1) {
    return path[0];
  }

  if (offset >= 1) {
    return path[path.length - 1];
  }

  // Calculate cumulative distances along each segment
  const distances: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    const dx = path[i][0] - path[i - 1][0];
    const dy = path[i][1] - path[i - 1][1];
    distances.push(distances[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }

  const totalLength = distances[distances.length - 1];
  const targetDistance = offset * totalLength;

  // Find the segment that contains the target distance
  for (let i = 1; i < distances.length; i++) {
    if (distances[i] >= targetDistance) {
      const segmentStart = distances[i - 1];
      const segmentLength = distances[i] - segmentStart;
      const t = segmentLength === 0 ? 0 : (targetDistance - segmentStart) / segmentLength;

      const lon = path[i - 1][0] + t * (path[i][0] - path[i - 1][0]);
      const lat = path[i - 1][1] + t * (path[i][1] - path[i - 1][1]);
      return [lon, lat];
    }
  }

  // Fallback (should not reach here)
  return path[path.length - 1];
}
