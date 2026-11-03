import { Injectable, inject } from '@angular/core';

import { ApiService } from '../api/api.service';
import { GeoPlace, RoutePlan, TrafficStatus } from '../models/route.model';

type PlanResponse = {
  rutas: {
    distance_km: number;
    duration_min: number;
    duration_traffic_min: number;
    traffic_level: 'fluido' | 'moderado' | 'congestionado';
    franja: string;
    eventos: { id: string; descripcion: string; nivel: string; demora_min: number }[];
    recomendada: boolean;
    geometry: [number, number][];
  }[];
  franja: string;
};

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
};

type OsrmRoute = {
  routes: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }[];
};

@Injectable({ providedIn: 'root' })
export class RoutingService {
  private readonly api = inject(ApiService);

  /** Hasta 3 rutas con tiempo estimado con tráfico, la recomendada primero. */
  async planAlternatives(origin: GeoPlace, destination: GeoPlace): Promise<RoutePlan[]> {
    const originShort = origin.name.split(',')[0];
    const destShort = destination.name.split(',')[0];
    try {
      const res = await this.api.post<PlanResponse>('/nav-routes/plan', {
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        dest_lat: destination.lat,
        dest_lng: destination.lng
      });
      if (res.rutas?.length) {
        return res.rutas.map((r, i) => ({
          origin,
          destination,
          label: i === 0 ? `${originShort} → ${destShort}` : `${originShort} → ${destShort} (alterna ${i})`,
          distanceKm: Math.round(r.distance_km * 10) / 10,
          durationMin: Math.round(r.duration_min),
          durationTrafficMin: Math.round(r.duration_traffic_min),
          trafficLevel: r.traffic_level,
          franja: r.franja,
          eventos: r.eventos,
          recomendada: r.recomendada,
          coordinates: r.geometry
        }));
      }
    } catch {
      // Sin backend de rutas: se usa OSRM directo desde el navegador (sin estimación de tráfico).
    }
    return [await this.planRoute(origin, destination)];
  }

  async trafficStatus(): Promise<TrafficStatus | null> {
    try {
      return await this.api.get<TrafficStatus>('/traffic');
    } catch {
      return null;
    }
  }
  async searchPlaces(query: string): Promise<GeoPlace[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '6');
    url.searchParams.set('countrycodes', 'pe');

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': 'TruckGPS/1.0' }
    });
    if (!res.ok) throw new Error('No se pudo buscar la dirección');

    const data = (await res.json()) as NominatimResult[];
    return data.map((r) => ({
      name: r.display_name.split(',').slice(0, 3).join(',').trim(),
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon)
    }));
  }

  /** Nombre corto de un punto (calle y distrito) para mostrarlo en el campo. */
  async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lng));
      url.searchParams.set('format', 'json');
      url.searchParams.set('zoom', '18');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('accept-language', 'es');
      const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error();
      const d = (await res.json()) as { address?: Record<string, string>; display_name?: string };
      const a = d.address ?? {};
      const calle = [a['road'] ?? a['pedestrian'] ?? a['neighbourhood'], a['house_number']].filter(Boolean).join(' ');
      const zona = a['suburb'] ?? a['city_district'] ?? a['quarter'] ?? a['town'] ?? a['city'] ?? '';
      const nombre = [calle, zona].filter(Boolean).join(', ');
      return nombre || d.display_name?.split(',').slice(0, 2).join(',') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }

  /** Posición actual del equipo, siempre fresca y con la mayor precisión disponible. */
  currentPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Este dispositivo no permite obtener la ubicación.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
        (err) =>
          reject(
            new Error(
              err.code === err.PERMISSION_DENIED
                ? 'Permiso de ubicación denegado. Actívalo en el navegador o escribe la dirección.'
                : 'No se pudo obtener tu ubicación. Escribe la dirección o elígela en el mapa.'
            )
          ),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }
      );
    });
  }

  async planRoute(origin: GeoPlace, destination: GeoPlace): Promise<RoutePlan> {
    const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('No se pudo calcular la ruta');

    const data = (await res.json()) as OsrmRoute;
    const route = data.routes?.[0];
    if (!route) throw new Error('No hay ruta disponible entre esos puntos');

    const coordinates = route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng] as [number, number]
    );

    const originShort = origin.name.split(',')[0];
    const destShort = destination.name.split(',')[0];

    return {
      origin,
      destination,
      label: `${originShort} → ${destShort}`,
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMin: Math.round(route.duration / 60),
      coordinates
    };
  }
}
