/** Reduce puntos de una polyline para guardar en JSONB sin exceder límites. */
export function decimateCoordinates(
  coords: [number, number][],
  maxPoints = 400
): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const out: [number, number][] = [];
  for (let i = 0; i < coords.length; i += step) {
    out.push(coords[i]);
  }
  const last = coords[coords.length - 1];
  const tail = out[out.length - 1];
  if (tail[0] !== last[0] || tail[1] !== last[1]) {
    out.push(last);
  }
  return out;
}
