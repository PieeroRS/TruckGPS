import { Injectable, computed, inject, signal } from '@angular/core';

import { ApiService } from '../api/api.service';
import { Vehicle, VehicleStatus } from '../models/vehicle.model';
import { apiErrorMessage } from '../utils/api-error.util';

export interface VehicleUpsert {
  placa: string;
  modelo: string;
  estado: VehicleStatus;
  ruta?: string;
  kilometraje: number;
  prox_mantenimiento: string;
  lat?: number;
  lng?: number;
}

@Injectable({ providedIn: 'root' })
export class FleetService {
  private readonly api = inject(ApiService);

  private readonly _vehicles = signal<readonly Vehicle[]>([]);
  readonly vehicles = this._vehicles.asReadonly();
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly loadError = signal<string | null>(null);

  private loadPromise: Promise<void> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  readonly count = computed(() => this._vehicles().length);

  async load(force = false): Promise<void> {
    if (this.loaded() && !force) return;
    if (this.loadPromise && !force) return this.loadPromise;

    this.loadPromise = this.fetchVehicles(force);
    return this.loadPromise;
  }

  getByPlaca(placa: string): Vehicle | undefined {
    return this._vehicles().find((v) => v.placa === placa);
  }

  filter(estado: VehicleStatus | 'todos', busqueda: string): Vehicle[] {
    const q = busqueda.trim().toLowerCase();
    return this._vehicles().filter((v) => {
      if (estado !== 'todos' && v.estado !== estado) return false;
      if (q) {
        const hay = `${v.placa} ${v.conductor} ${v.modelo} ${v.ruta}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  filterLive(filter: 'all' | 'ok' | 'warn' | 'alert'): Vehicle[] {
    return this._vehicles().filter((v) => {
      if (filter === 'all') return true;
      if (filter === 'ok') return v.estado === 'ok';
      if (filter === 'warn') return v.estado === 'warn' || v.estado === 'offline';
      if (filter === 'alert') return v.estado === 'alert';
      return true;
    });
  }

  startPolling(intervalMs = 8_000): () => void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      void this.load(true);
    }, intervalMs);
    return () => this.stopPolling();
  }

  stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async create(input: VehicleUpsert): Promise<void> {
    try {
      await this.api.post('/vehicles', {
        placa: input.placa.trim().toUpperCase(),
        modelo: input.modelo.trim(),
        estado: input.estado,
        ruta: input.ruta?.trim() || null,
        kilometraje: input.kilometraje,
        prox_mantenimiento: input.prox_mantenimiento,
        lat: input.lat ?? -12.0464,
        lng: input.lng ?? -77.0428
      });
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo crear el vehículo'));
    }
    await this.load(true);
  }

  async update(id: string, input: VehicleUpsert): Promise<void> {
    try {
      await this.api.patch(`/vehicles/${id}`, {
        placa: input.placa.trim().toUpperCase(),
        modelo: input.modelo.trim(),
        estado: input.estado,
        ruta: input.ruta?.trim() || null,
        kilometraje: input.kilometraje,
        prox_mantenimiento: input.prox_mantenimiento,
        lat: input.lat,
        lng: input.lng
      });
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo actualizar'));
    }
    await this.load(true);
  }

  async delete(id: string): Promise<void> {
    try {
      await this.api.delete(`/vehicles/${id}`);
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo eliminar'));
    }
    await this.load(true);
  }

  subscribeToPositions(onUpdate: () => void): (() => void) | null {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      void this.load(true).then(onUpdate);
    }, 4_000);
    return () => this.stopPolling();
  }

  private async fetchVehicles(force: boolean): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);

    try {
      const rows = await this.api.get<Vehicle[]>('/vehicles');
      this._vehicles.set(rows);
      this.loaded.set(true);
    } catch (e) {
      this.loadError.set(apiErrorMessage(e, 'Error al cargar flota'));
      this._vehicles.set([]);
    } finally {
      this.loading.set(false);
      if (force) this.loadPromise = null;
    }
  }
}
