import { Injectable, inject, signal } from '@angular/core';

import { AuthService } from '../../auth/auth.service';
import {
  CreateNavRouteInput,
  estimateFare,
  NavRoute,
  NavRouteStatus
} from '../models/route.model';
import { decimateCoordinates } from '../utils/geometry.util';
import { supabaseErrorMessage } from '../utils/supabase-error.util';
import { SupabaseService } from '../supabase/supabase.service';

type NavRouteRow = {
  id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  created_by: string | null;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  dest_name: string;
  dest_lat: number;
  dest_lng: number;
  route_label: string;
  distance_km: number | null;
  duration_min: number | null;
  geometry: [number, number][] | null;
  status: NavRouteStatus;
  progress_pct: number;
  fare_estimate: number | null;
  notes: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  vehicles?: { placa: string } | { placa: string }[] | null;
  profiles?: { full_name: string } | { full_name: string }[] | null;
};

@Injectable({ providedIn: 'root' })
export class NavRoutesService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  readonly routes = signal<NavRoute[]>([]);
  readonly loading = signal(false);
  readonly tableMissing = signal(false);

  async load(): Promise<void> {
    if (!this.supabase.client) return;

    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('nav_routes')
        .select('*')
        .neq('status', 'cancelada')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('nav_routes')) {
          this.tableMissing.set(true);
          this.routes.set([]);
          return;
        }
        throw error;
      }

      this.tableMissing.set(false);
      this.routes.set((data ?? []).map((row) => this.mapRow(row as NavRouteRow)));
    } finally {
      this.loading.set(false);
    }
  }

  async create(input: CreateNavRouteInput): Promise<NavRoute> {
    if (!this.supabase.client) throw new Error('Supabase no configurado');

    await this.auth.refreshProfile();

    const { data: userData, error: userErr } = await this.supabase.client.auth.getUser();
    if (userErr || !userData.user) {
      throw new Error('Sin sesión. Cierra sesión e ingresa de nuevo.');
    }
    const userId = userData.user.id;

    const fare = estimateFare(input.plan.distanceKm);
    const status: NavRouteStatus = input.vehicleId ? 'asignada' : 'solicitada';
    const geometry = decimateCoordinates(input.plan.coordinates);

    const row = {
      vehicle_id: input.vehicleId || null,
      driver_id: input.driverId ?? null,
      created_by: userId,
      origin_name: input.origin.name,
      origin_lat: input.origin.lat,
      origin_lng: input.origin.lng,
      dest_name: input.destination.name,
      dest_lat: input.destination.lat,
      dest_lng: input.destination.lng,
      route_label: input.plan.label,
      distance_km: input.plan.distanceKm,
      duration_min: input.plan.durationMin,
      geometry,
      status,
      fare_estimate: fare,
      notes: input.notes ?? null
    };

    const { data, error } = await this.supabase.client
      .from('nav_routes')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      // Si insertó pero falló el RETURNING por caché RLS, recargar lista
      if (error.code === 'PGRST116') {
        await this.load();
        const created = this.routes().find(
          (r) =>
            r.routeLabel === input.plan.label &&
            r.originLat === input.origin.lat &&
            r.destLat === input.destination.lat
        );
        if (created) return created;
      }
      throw new Error(supabaseErrorMessage(error, 'No se pudo crear la ruta'));
    }

    const route = this.mapRow(data as NavRouteRow);
    this.tableMissing.set(false);
    this.routes.update((list) => [route, ...list]);
    return route;
  }

  async updateStatus(id: string, status: NavRouteStatus, progressPct?: number): Promise<void> {
    if (!this.supabase.client) return;

    const patch: Record<string, unknown> = { status };
    if (progressPct !== undefined) patch['progress_pct'] = progressPct;
    if (status === 'en-curso') patch['started_at'] = new Date().toISOString();
    if (status === 'completada') {
      patch['completed_at'] = new Date().toISOString();
      patch['progress_pct'] = 100;
    }

    const { error } = await this.supabase.client.from('nav_routes').update(patch).eq('id', id);
    if (error) throw new Error(supabaseErrorMessage(error, 'No se pudo actualizar'));
    await this.load();
  }

  async cancel(id: string): Promise<void> {
    await this.updateStatus(id, 'cancelada');
  }

  async delete(id: string): Promise<void> {
    if (!this.supabase.client) throw new Error('Supabase no configurado');
    const { error } = await this.supabase.client.from('nav_routes').delete().eq('id', id);
    if (error) throw new Error(supabaseErrorMessage(error, 'No se pudo eliminar la ruta'));
    await this.load();
  }

  private mapRow(row: NavRouteRow): NavRoute {
    const rawVehicle = row.vehicles;
    const rawProfile = row.profiles;
    const vehicle = Array.isArray(rawVehicle) ? rawVehicle[0] : rawVehicle;
    const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;

    return {
      id: row.id,
      vehicleId: row.vehicle_id,
      driverId: row.driver_id,
      createdBy: row.created_by,
      originName: row.origin_name,
      originLat: row.origin_lat,
      originLng: row.origin_lng,
      destName: row.dest_name,
      destLat: row.dest_lat,
      destLng: row.dest_lng,
      routeLabel: row.route_label,
      distanceKm: row.distance_km != null ? Number(row.distance_km) : null,
      durationMin: row.duration_min,
      geometry: row.geometry,
      status: row.status,
      progressPct: row.progress_pct,
      fareEstimate: row.fare_estimate != null ? Number(row.fare_estimate) : null,
      notes: row.notes,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      vehiclePlaca: vehicle?.placa ?? null,
      driverName: profile?.full_name ?? null
    };
  }
}
