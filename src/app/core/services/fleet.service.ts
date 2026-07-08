import { Injectable, computed, inject, signal } from '@angular/core';

import { SEED_VEHICLES } from '../data/seed.data';
import { Vehicle, VehicleStatus } from '../models/vehicle.model';
import { mapVehicleRow, VehicleLiveRow } from '../supabase/supabase.mappers';
import { isSupabaseConfigured } from '../supabase/supabase.config';
import { supabaseErrorMessage } from '../utils/supabase-error.util';
import { SupabaseService } from '../supabase/supabase.service';

type PositionPayload = {
  vehicle_id: string;
  lat: number;
  lng: number;
  velocidad: number;
};

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
  private readonly supabase = inject(SupabaseService);

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
    if (!this.supabase.client) throw new Error('Supabase no configurado');
    const { error } = await this.supabase.client.from('vehicles').insert({
      placa: input.placa.trim().toUpperCase(),
      modelo: input.modelo.trim(),
      estado: input.estado,
      ruta: input.ruta?.trim() || null,
      kilometraje: input.kilometraje,
      prox_mantenimiento: input.prox_mantenimiento,
      lat: input.lat ?? -12.0464,
      lng: input.lng ?? -77.0428,
      velocidad: 0
    });
    if (error) throw new Error(supabaseErrorMessage(error, 'No se pudo crear el vehículo'));
    await this.load(true);
  }

  async update(id: string, input: VehicleUpsert): Promise<void> {
    if (!this.supabase.client) throw new Error('Supabase no configurado');
    const { error } = await this.supabase.client
      .from('vehicles')
      .update({
        placa: input.placa.trim().toUpperCase(),
        modelo: input.modelo.trim(),
        estado: input.estado,
        ruta: input.ruta?.trim() || null,
        kilometraje: input.kilometraje,
        prox_mantenimiento: input.prox_mantenimiento,
        lat: input.lat,
        lng: input.lng
      })
      .eq('id', id);
    if (error) throw new Error(supabaseErrorMessage(error, 'No se pudo actualizar'));
    await this.load(true);
  }

  async delete(id: string): Promise<void> {
    if (!this.supabase.client) throw new Error('Supabase no configurado');
    const { error } = await this.supabase.client.from('vehicles').delete().eq('id', id);
    if (error) throw new Error(supabaseErrorMessage(error, 'No se pudo eliminar'));
    await this.load(true);
  }

  subscribeToPositions(onUpdate: () => void): (() => void) | null {
    if (!this.supabase.client) return null;

    const channel = this.supabase.client
      .channel('fleet-positions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vehicle_positions' },
        (payload) => {
          const row = payload.new as PositionPayload;
          if (row?.vehicle_id) {
            this.applyPosition(row);
          }
          void this.load(true).then(onUpdate);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'vehicles' },
        (payload) => {
          const row = payload.new as {
            id: string;
            lat: number | null;
            lng: number | null;
            velocidad: number;
            estado: VehicleStatus;
          };
          if (row?.id) {
            this.applyVehicleUpdate(row);
          }
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      void this.supabase.client?.removeChannel(channel);
    };
  }

  private applyPosition(row: PositionPayload): void {
    this._vehicles.update((list) =>
      list.map((v) =>
        v.id === row.vehicle_id
          ? { ...v, lat: row.lat, lng: row.lng, velocidad: row.velocidad, estado: 'ok' as const }
          : v
      )
    );
  }

  private applyVehicleUpdate(row: {
    id: string;
    lat: number | null;
    lng: number | null;
    velocidad: number;
    estado: VehicleStatus;
  }): void {
    if (row.lat == null || row.lng == null) return;
    this._vehicles.update((list) =>
      list.map((v) =>
        v.id === row.id
          ? { ...v, lat: row.lat!, lng: row.lng!, velocidad: row.velocidad, estado: row.estado }
          : v
      )
    );
  }

  private async fetchVehicles(force: boolean): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);

    try {
      if (!this.supabase.client) {
        this._vehicles.set(SEED_VEHICLES);
        this.loaded.set(true);
        return;
      }

      const { data, error } = await this.supabase.client
        .from('vehicles_live')
        .select('*')
        .order('placa');

      if (error) throw error;

      const rows = (data ?? []) as VehicleLiveRow[];
      this._vehicles.set(rows.map(mapVehicleRow));
      this.loaded.set(true);
    } catch (e) {
      this.loadError.set(e instanceof Error ? e.message : 'Error al cargar flota');
      if (!isSupabaseConfigured()) {
        this._vehicles.set(SEED_VEHICLES);
      } else {
        this._vehicles.set([]);
      }
    } finally {
      this.loading.set(false);
      if (force) this.loadPromise = null;
    }
  }
}
