import { Injectable, inject, signal } from '@angular/core';

import { AuthService } from '../../auth/auth.service';
import { isSupabaseConfigured } from '../supabase/supabase.config';
import { SupabaseService } from '../supabase/supabase.service';

export interface VehicleOption {
  id: string;
  placa: string;
  modelo: string;
  ruta: string;
  conductorNombre: string | null;
  ocupado: boolean;
  esMio: boolean;
}

const STORAGE_KEY = 'truckgps_location_tracking';
const MIN_SEND_MS = 12_000;
const MIN_MOVE_M = 40;

interface PersistedState {
  vehicleId: string;
  placa: string;
}

@Injectable({ providedIn: 'root' })
export class LocationTrackingService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  readonly active = signal(false);
  readonly vehicleId = signal<string | null>(null);
  readonly vehiclePlaca = signal<string | null>(null);
  readonly lat = signal<number | null>(null);
  readonly lng = signal<number | null>(null);
  readonly speedKmh = signal(0);
  readonly lastSync = signal<Date | null>(null);
  readonly error = signal<string | null>(null);
  readonly syncing = signal(false);

  private watchId: number | null = null;
  private lastSentAt = 0;
  private lastSentLat: number | null = null;
  private lastSentLng: number | null = null;

  async loadVehicleOptions(): Promise<VehicleOption[]> {
    const userId = this.auth.profile()?.id;
    if (!this.supabase.client || !userId) return [];

    const { data, error } = await this.supabase.client
      .from('vehicles')
      .select('id, placa, modelo, ruta, conductor_id, profiles:conductor_id ( full_name )')
      .order('placa');

    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => {
      const conductorId = row.conductor_id as string | null;
      const rawProfile = row.profiles as { full_name: string } | { full_name: string }[] | null;
      const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
      const esMio = conductorId === userId;
      return {
        id: row.id as string,
        placa: row.placa as string,
        modelo: row.modelo as string,
        ruta: (row.ruta as string | null) ?? '—',
        conductorNombre: profile?.full_name ?? null,
        ocupado: !!conductorId && !esMio,
        esMio
      };
    });
  }

  async start(vehicleId: string, placa: string): Promise<{ ok: boolean; error?: string }> {
    this.error.set(null);

    if (!isSupabaseConfigured() || !this.supabase.client) {
      return { ok: false, error: 'Supabase no configurado. Conecta el proyecto para compartir ubicación.' };
    }

    const userId = this.auth.profile()?.id;
    if (!userId) {
      return { ok: false, error: 'Debes iniciar sesión para activar el GPS.' };
    }

    if (!('geolocation' in navigator)) {
      return { ok: false, error: 'Este dispositivo no soporta geolocalización.' };
    }

    const { error: claimErr } = await this.supabase.client
      .from('vehicles')
      .update({ conductor_id: userId, estado: 'ok' })
      .eq('id', vehicleId);

    if (claimErr) {
      return {
        ok: false,
        error: claimErr.message.includes('policy')
          ? 'Este vehículo ya está asignado a otro conductor.'
          : claimErr.message
      };
    }

    this.vehicleId.set(vehicleId);
    this.vehiclePlaca.set(placa);
    this.persist({ vehicleId, placa });

    return new Promise((resolve) => {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          void this.onPosition(pos);
          if (!this.active()) {
            this.active.set(true);
            resolve({ ok: true });
          }
        },
        (err) => {
          const msg =
            err.code === err.PERMISSION_DENIED
              ? 'Permiso de ubicación denegado. Actívalo en el navegador.'
              : err.message || 'No se pudo obtener la ubicación.';
          this.error.set(msg);
          void this.stop(false);
          resolve({ ok: false, error: msg });
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
      );
    });
  }

  async stop(releaseVehicle = true): Promise<void> {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    const vid = this.vehicleId();
    const userId = this.auth.profile()?.id;

    if (releaseVehicle && vid && userId && this.supabase.client) {
      await this.supabase.client
        .from('vehicles')
        .update({ conductor_id: null, velocidad: 0 })
        .eq('id', vid)
        .eq('conductor_id', userId);
    }

    this.active.set(false);
    this.vehicleId.set(null);
    this.vehiclePlaca.set(null);
    this.lat.set(null);
    this.lng.set(null);
    this.speedKmh.set(0);
    this.lastSync.set(null);
    this.lastSentAt = 0;
    this.lastSentLat = null;
    this.lastSentLng = null;
    localStorage.removeItem(STORAGE_KEY);
  }

  async resumeIfNeeded(): Promise<void> {
    if (!isSupabaseConfigured() || this.active()) return;

    let saved: PersistedState | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw) as PersistedState;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }

    if (!saved?.vehicleId || !saved.placa) return;

    const result = await this.start(saved.vehicleId, saved.placa);
    if (!result.ok) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private async onPosition(pos: GeolocationPosition): Promise<void> {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const speed = Math.max(0, Math.round((pos.coords.speed ?? 0) * 3.6));

    this.lat.set(lat);
    this.lng.set(lng);
    this.speedKmh.set(speed);

    const now = Date.now();
    const isFirst = this.lastSentAt === 0;
    const moved =
      this.lastSentLat === null ||
      this.lastSentLng === null ||
      haversineM(this.lastSentLat, this.lastSentLng, lat, lng) >= MIN_MOVE_M;

    if (!isFirst && now - this.lastSentAt < MIN_SEND_MS && !moved) return;

    const vid = this.vehicleId();
    if (!vid || !this.supabase.client) return;

    this.syncing.set(true);
    try {
      const { error: posErr } = await this.supabase.client.from('vehicle_positions').insert({
        vehicle_id: vid,
        lat,
        lng,
        velocidad: speed
      });

      if (posErr) {
        this.error.set(posErr.message);
        return;
      }

      // Respaldo: actualizar vehículo directamente (el trigger también lo hace)
      await this.supabase.client
        .from('vehicles')
        .update({ lat, lng, velocidad: speed, estado: 'ok' })
        .eq('id', vid);

      this.error.set(null);
      this.lastSentAt = now;
      this.lastSentLat = lat;
      this.lastSentLng = lng;
      this.lastSync.set(new Date());
    } finally {
      this.syncing.set(false);
    }
  }

  private persist(state: PersistedState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
