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
