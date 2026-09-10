import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '../api/api.service';
import { AuthService } from '../../auth/auth.service';
import { CreateNavRouteInput, estimateFare, NavRoute, NavRouteStatus } from '../models/route.model';
import { decimateCoordinates } from '../utils/geometry.util';
import { apiErrorMessage } from '../utils/api-error.util';

@Injectable({ providedIn: 'root' })
export class NavRoutesService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly routes = signal<NavRoute[]>([]);
  readonly loading = signal(false);
  readonly tableMissing = signal(false);

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.api.get<NavRoute[]>('/nav-routes');
      this.tableMissing.set(false);
      this.routes.set(data);
    } catch {
      this.routes.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async create(input: CreateNavRouteInput): Promise<NavRoute> {
    await this.auth.refreshProfile();
    const fare = estimateFare(input.plan.distanceKm);
    const geometry = decimateCoordinates(input.plan.coordinates);

    try {
      const route = await this.api.post<NavRoute>('/nav-routes', {
        vehicle_id: input.vehicleId || null,
        driver_id: input.driverId ?? null,
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
        fare_estimate: fare,
        notes: input.notes ?? null
      });
      this.routes.update((list) => [route, ...list]);
      return route;
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo crear la ruta'));
    }
  }

  async updateStatus(id: string, status: NavRouteStatus, progressPct?: number): Promise<void> {
    try {
      await this.api.patch(`/nav-routes/${id}`, {
        status,
        progress_pct: progressPct ?? null
      });
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo actualizar'));
    }
    await this.load();
  }

  async cancel(id: string): Promise<void> {
    await this.updateStatus(id, 'cancelada');
  }

  async delete(id: string): Promise<void> {
    try {
      await this.api.delete(`/nav-routes/${id}`);
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo eliminar la ruta'));
    }
    await this.load();
  }
}
