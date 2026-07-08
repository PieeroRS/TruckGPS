export type NavRouteStatus = 'solicitada' | 'asignada' | 'en-curso' | 'completada' | 'cancelada';

export interface GeoPlace {
  name: string;
  lat: number;
  lng: number;
}

export interface RoutePlan {
  origin: GeoPlace;
  destination: GeoPlace;
  label: string;
  distanceKm: number;
  durationMin: number;
  coordinates: [number, number][];
}

export interface NavRoute {
  id: string;
  vehicleId: string | null;
  driverId: string | null;
  createdBy: string | null;
  originName: string;
  originLat: number;
  originLng: number;
  destName: string;
  destLat: number;
  destLng: number;
  routeLabel: string;
  distanceKm: number | null;
  durationMin: number | null;
  geometry: [number, number][] | null;
  status: NavRouteStatus;
  progressPct: number;
  fareEstimate: number | null;
  notes: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  vehiclePlaca?: string | null;
  driverName?: string | null;
}

export interface CreateNavRouteInput {
  origin: GeoPlace;
  destination: GeoPlace;
  plan: RoutePlan;
  vehicleId?: string | null;
  driverId?: string | null;
  notes?: string;
}

export const PERU_CITIES: GeoPlace[] = [
  { name: 'Lima, Perú', lat: -12.0464, lng: -77.0428 },
  { name: 'Trujillo, Perú', lat: -8.1116, lng: -79.0288 },
  { name: 'Arequipa, Perú', lat: -16.409, lng: -71.5375 },
  { name: 'Cusco, Perú', lat: -13.5319, lng: -71.9675 },
  { name: 'Chiclayo, Perú', lat: -6.7714, lng: -79.8409 },
  { name: 'Piura, Perú', lat: -5.1945, lng: -80.6328 },
  { name: 'Huancayo, Perú', lat: -12.0675, lng: -75.2083 },
  { name: 'Ica, Perú', lat: -14.0678, lng: -75.7286 },
  { name: 'Pisco, Perú', lat: -13.7099, lng: -76.2054 },
  { name: 'Tacna, Perú', lat: -18.0066, lng: -70.2463 }
];

export const FARE_PER_KM = 2.8;

export function estimateFare(distanceKm: number): number {
  return Math.round(distanceKm * FARE_PER_KM * 100) / 100;
}

export function statusLabel(status: NavRouteStatus): string {
  const map: Record<NavRouteStatus, string> = {
    solicitada: 'Solicitada',
    asignada: 'Asignada',
    'en-curso': 'En curso',
    completada: 'Completada',
    cancelada: 'Cancelada'
  };
  return map[status];
}

export function statusBadge(status: NavRouteStatus): string {
  const map: Record<NavRouteStatus, string> = {
    solicitada: 'badge-warning',
    asignada: 'badge-neutral',
    'en-curso': 'badge-success',
    completada: 'badge-neutral',
    cancelada: 'badge-danger'
  };
  return map[status];
}
