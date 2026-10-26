import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '../api/api.service';
import { FuelLog, FuelLogCreate, FuelSummary } from '../models/fuel.model';

@Injectable({ providedIn: 'root' })
export class FuelService {
  private readonly api = inject(ApiService);

  readonly summary = signal<FuelSummary | null>(null);
  readonly logs = signal<FuelLog[]>([]);
  readonly loading = signal(false);

  async load(days: number, precioGalon?: number | null): Promise<void> {
    this.loading.set(true);
    try {
      const precio = precioGalon && precioGalon > 0 ? `&precio_galon=${precioGalon}` : '';
      const [summary, logs] = await Promise.all([
        this.api.get<FuelSummary>(`/fuel/summary?days=${days}${precio}`),
        this.api.get<FuelLog[]>(`/fuel/logs?days=${Math.max(days, 30)}`)
      ]);
      this.summary.set(summary);
      this.logs.set(logs);
    } finally {
      this.loading.set(false);
    }
  }

  createLog(body: FuelLogCreate): Promise<FuelLog> {
    return this.api.post<FuelLog>('/fuel/logs', body);
  }

  deleteLog(id: string): Promise<{ ok: boolean }> {
    return this.api.delete<{ ok: boolean }>(`/fuel/logs/${id}`);
  }

  updateEfficiency(vehicleId: string, rendimientoKmGal: number | null, tanqueGal: number | null): Promise<unknown> {
    return this.api.patch(`/fuel/vehicles/${vehicleId}`, {
      rendimiento_km_gal: rendimientoKmGal,
      tanque_gal: tanqueGal
    });
  }
}
