/** Geometría para la navegación guiada: proyección sobre la ruta y distancias. */
export type LatLng = [number, number];

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Metros acumulados desde el inicio hasta cada punto de la ruta. */
export function cumulative(path: LatLng[]): number[] {
  const out = [0];
  for (let i = 1; i < path.length; i++) out.push(out[i - 1] + haversineM(path[i - 1], path[i]));
  return out;
}

export interface PathProjection {
  /** Distancia del punto a la ruta (m). */
  distanceM: number;
  /** Metros recorridos desde el inicio hasta el punto proyectado. */
  alongM: number;
  point: LatLng;
  /** Rumbo del tramo (grados desde el norte). */
  bearing: number;
}

export function bearingDeg(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Punto de la ruta más cercano a una posición. `fromM` evita «saltar hacia atrás»
 * cuando la ruta pasa dos veces por la misma vía: se prefiere el tramo que sigue al avance actual.
 */
export function projectOnPath(path: LatLng[], cum: number[], pos: LatLng, fromM = 0): PathProjection | null {
  if (path.length < 2) return null;
  const lat0 = rad(pos[0]);
  const kx = R * Math.cos(lat0);
  const toXY = (p: LatLng): [number, number] => [rad(p[1] - pos[1]) * kx, rad(p[0] - pos[0]) * R];
  let best: PathProjection | null = null;
  let bestCost = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = toXY(path[i]);
    const [bx, by] = toXY(path[i + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const px = ax + dx * t;
    const py = ay + dy * t;
    const d = Math.hypot(px, py);
    const along = cum[i] + (cum[i + 1] - cum[i]) * t;
    // Un tramo ya recorrido (más de 60 m atrás) se penaliza para no retroceder en la guía.
    const cost = d + (along < fromM - 60 ? 80 : 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = {
        distanceM: d,
        alongM: along,
        point: [path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t],
        bearing: bearingDeg(path[i], path[i + 1])
      };
    }
  }
  return best;
}

/** Punto de la ruta a cierta distancia desde el inicio. */
export function pointAt(path: LatLng[], cum: number[], alongM: number): LatLng {
  const total = cum[cum.length - 1];
  const a = Math.max(0, Math.min(total, alongM));
  for (let i = 1; i < path.length; i++) {
    if (cum[i] >= a) {
      const seg = cum[i] - cum[i - 1];
      const t = seg === 0 ? 0 : (a - cum[i - 1]) / seg;
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t];
    }
  }
  return path[path.length - 1];
}

/** «300 metros», «1.2 kilómetros» para la voz. */
export function spokenDistance(m: number): string {
  if (m >= 950) {
    const km = Math.round(m / 100) / 10;
    return `${String(km).replace('.', ',')} ${km === 1 ? 'kilómetro' : 'kilómetros'}`;
  }
  const r = m >= 100 ? Math.round(m / 50) * 50 : Math.max(10, Math.round(m / 10) * 10);
  return `${r} metros`;
}

export function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}
