/** Dense geographic rings keep bitmap interpolation away from giant polar fans. */
export function createPolarBitmapMesh(bounds: [number, number, number, number], step = 0.5) {
  const [west, south, east, north] = bounds;
  const cols = Math.ceil((east - west) / step), rows = Math.ceil((north - south) / step);
  const positions = new Float64Array((cols + 1) * (rows + 1) * 3);
  const texCoords = new Float32Array((cols + 1) * (rows + 1) * 2);
  const indices = new Uint32Array(cols * rows * 6);
  let cursor = 0;
  for (let x = 0; x <= cols; x++) for (let y = 0; y <= rows; y++) {
    const i = x * (rows + 1) + y;
    positions.set([west + x / cols * (east - west), south + y / rows * (north - south), 0], i * 3);
    texCoords.set([x / cols, 1 - y / rows], i * 2);
    if (x && y) {
      const left = i - rows - 1;
      indices.set([left, left - 1, i - 1, left, i - 1, i], cursor);
      cursor += 6;
    }
  }
  return { positions, texCoords, indices, vertexCount: indices.length };
}
