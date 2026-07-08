import { Injectable, inject, signal } from '@angular/core';

import { AuthService } from '../../auth/auth.service';
import { isSupabaseConfigured } from '../supabase/supabase.config';
import { SupabaseService } from '../supabase/supabase.service';
import { supabaseErrorMessage } from '../utils/supabase-error.util';

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
const MIN_SEND_MS = 10_000;
const MIN_MOVE_M = 25;
const HEARTBEAT_MS = 20_000;

interface PersistedState {
  vehicleId: string;
  placa: string;
  userId?: string;
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
  readonly background = signal(false);
  readonly wakeLockHeld = signal(false);

  private watchId: number | null = null;
  private lastSentAt = 0;
  private lastSentLat: number | null = null;
  private lastSentLng: number | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private pageHideHandler: (() => void) | null = null;
  private starting = false;

  async loadVehicleOptions(): Promise<VehicleOption[]> {
    const userId = this.auth.profile()?.id;
    if (!this.supabase.client || !userId) return [];

    const { data, error } = await this.supabase.client
      .from('vehicles')
      .select('id, placa, modelo, ruta, conductor_id, profiles:conductor_id ( full_name )')
      .order('placa');

    if (error) throw new Error(supabaseErrorMessage(error, 'No se pudo cargar la flota'));

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

    await this.auth.refreshProfile();
    const userId = this.auth.profile()?.id;
    if (!userId) {
      return { ok: false, error: 'Debes iniciar sesión para activar el GPS.' };
    }

    if (!('geolocation' in navigator)) {
      return { ok: false, error: 'Este dispositivo no soporta geolocalización.' };
    }

    if (this.starting) {
      return { ok: false, error: 'Ya se está activando el GPS...' };
    }
    this.starting = true;

    try {
      // Si ya hay otro vehículo activo, liberarlo primero
      const prev = this.vehicleId();
      if (prev && prev !== vehicleId && this.active()) {
        await this.releaseVehicleRpc(prev);
        this.clearWatchOnly();
      }

      const { data: claimed, error: claimErr } = await this.supabase.client.rpc('claim_vehicle', {
        p_vehicle_id: vehicleId
      });

      if (claimErr) {
        return {
          ok: false,
          error: supabaseErrorMessage(
            claimErr,
            'No se pudo asignar el vehículo. ¿Ya está en uso por otro conductor?'
          )
        };
      }

      if (!claimed) {
        return { ok: false, error: 'No se pudo reclamar el vehículo (sin respuesta del servidor).' };
      }

      this.vehicleId.set(vehicleId);
      this.vehiclePlaca.set(placa);
      this.persist({ vehicleId, placa, userId });

      const geoOk = await this.startWatch();
      if (!geoOk.ok) {
        await this.releaseVehicleRpc(vehicleId);
        this.clearLocalState(false);
        return geoOk;
      }

      this.bindLifecycle();
      void this.requestWakeLock();
      this.startHeartbeat();
      this.active.set(true);
      return { ok: true };
    } finally {
      this.starting = false;
    }
  }

  async stop(releaseVehicle = true): Promise<void> {
    this.unbindLifecycle();
    this.stopHeartbeat();
    await this.releaseWakeLock();
    this.clearWatchOnly();

    const vid = this.vehicleId();
    if (releaseVehicle && vid) {
      await this.releaseVehicleRpc(vid);
    }

    this.clearLocalState(releaseVehicle);
  }

  async resumeIfNeeded(): Promise<void> {
    if (!isSupabaseConfigured() || this.active() || this.starting) return;

    let saved: PersistedState | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw) as PersistedState;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }

    if (!saved?.vehicleId || !saved.placa) return;

    // Si hay usuario en la persistencia y no coincide, no reanudar
    const currentUser = this.auth.profile()?.id;
    if (saved.userId && currentUser && saved.userId !== currentUser) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const result = await this.start(saved.vehicleId, saved.placa);
    if (!result.ok) {
      localStorage.removeItem(STORAGE_KEY);
      if (result.error) this.error.set(result.error);
    }
  }

  private async startWatch(): Promise<{ ok: boolean; error?: string }> {
    this.clearWatchOnly();

    return new Promise((resolve) => {
      let resolved = false;
      const finish = (r: { ok: boolean; error?: string }) => {
        if (resolved) return;
        resolved = true;
        resolve(r);
      };

      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          void this.onPosition(pos, false);
          finish({ ok: true });
        },
        (err) => {
          const msg =
            err.code === err.PERMISSION_DENIED
              ? 'Permiso de ubicación denegado. Actívalo en el navegador (permite “Mientras se usa la app”).'
              : err.message || 'No se pudo obtener la ubicación.';
          this.error.set(msg);
          finish({ ok: false, error: msg });
        },
        { enableHighAccuracy: true, maximumAge: 8_000, timeout: 25_000 }
      );

      // Timeout de seguridad si nunca llega posición
      setTimeout(() => {
        if (!resolved && this.watchId !== null) {
          finish({ ok: true }); // watch ya está activo; GPS puede tardar
        }
      }, 12_000);
    });
  }

  private async onPosition(pos: GeolocationPosition, force: boolean): Promise<void> {
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

    if (!force && !isFirst && now - this.lastSentAt < MIN_SEND_MS && !moved) return;

    await this.sendPosition(lat, lng, speed);
  }

  private async sendPosition(lat: number, lng: number, speed: number): Promise<void> {
    const vid = this.vehicleId();
    if (!vid || !this.supabase.client) return;

    this.syncing.set(true);
    try {
      const { error } = await this.supabase.client.rpc('report_vehicle_position', {
        p_vehicle_id: vid,
        p_lat: lat,
        p_lng: lng,
        p_velocidad: speed
      });

      if (error) {
        // Fallback: insert + update directo (si la RPC aún no está migrada)
        const msg = error.message ?? '';
        if (msg.includes('report_vehicle_position') || msg.includes('Could not find')) {
          await this.sendPositionFallback(vid, lat, lng, speed);
          return;
        }
        this.error.set(supabaseErrorMessage(error, 'Error al enviar ubicación'));
        return;
      }

      this.error.set(null);
      this.lastSentAt = Date.now();
      this.lastSentLat = lat;
      this.lastSentLng = lng;
      this.lastSync.set(new Date());
    } finally {
      this.syncing.set(false);
    }
  }

  private async sendPositionFallback(vid: string, lat: number, lng: number, speed: number): Promise<void> {
    if (!this.supabase.client) return;

    const { error: posErr } = await this.supabase.client.from('vehicle_positions').insert({
      vehicle_id: vid,
      lat,
      lng,
      velocidad: speed
    });

    if (posErr) {
      this.error.set(supabaseErrorMessage(posErr, 'Error al enviar ubicación'));
      return;
    }

    const { data, error: updErr } = await this.supabase.client
      .from('vehicles')
      .update({ lat, lng, velocidad: speed, estado: 'ok' })
      .eq('id', vid)
      .select('id');

    if (updErr) {
      this.error.set(supabaseErrorMessage(updErr, 'Error al actualizar vehículo'));
      return;
    }
    if (!data?.length) {
      this.error.set('No se pudo actualizar el vehículo (permisos RLS). Ejecuta la migración 008.');
      return;
    }

    this.error.set(null);
    this.lastSentAt = Date.now();
    this.lastSentLat = lat;
    this.lastSentLng = lng;
    this.lastSync.set(new Date());
  }

  private async releaseVehicleRpc(vehicleId: string): Promise<void> {
    if (!this.supabase.client) return;
    const { error } = await this.supabase.client.rpc('release_vehicle', { p_vehicle_id: vehicleId });
    if (error) {
      // Fallback
      const userId = this.auth.profile()?.id;
      if (userId) {
        await this.supabase.client
          .from('vehicles')
          .update({ conductor_id: null, velocidad: 0 })
          .eq('id', vehicleId)
          .eq('conductor_id', userId);
      }
    }
  }

  private clearWatchOnly(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  private clearLocalState(clearStorage: boolean): void {
    this.active.set(false);
    this.vehicleId.set(null);
    this.vehiclePlaca.set(null);
    this.lat.set(null);
    this.lng.set(null);
    this.speedKmh.set(0);
    this.lastSync.set(null);
    this.background.set(false);
    this.lastSentAt = 0;
    this.lastSentLat = null;
    this.lastSentLng = null;
    if (clearStorage) localStorage.removeItem(STORAGE_KEY);
  }

  private persist(state: PersistedState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // --- Segundo plano / ciclo de vida ---

  private bindLifecycle(): void {
    this.unbindLifecycle();

    this.visibilityHandler = () => {
      const hidden = document.visibilityState === 'hidden';
      this.background.set(hidden);
      if (!hidden && this.active()) {
        void this.onForeground();
      }
    };

    this.pageHideHandler = () => {
      this.background.set(true);
      // Intentar un último envío antes de suspender
      const lat = this.lat();
      const lng = this.lng();
      if (lat != null && lng != null) {
        void this.sendPosition(lat, lng, this.speedKmh());
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('pagehide', this.pageHideHandler);
    window.addEventListener('pageshow', this.visibilityHandler);
  }

  private unbindLifecycle(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      window.removeEventListener('pageshow', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.pageHideHandler) {
      window.removeEventListener('pagehide', this.pageHideHandler);
      this.pageHideHandler = null;
    }
  }

  private async onForeground(): Promise<void> {
    void this.requestWakeLock();
    // Re-asegurar watch (iOS/Android a veces lo pausan)
    if (this.active() && this.watchId === null) {
      await this.startWatch();
    }
    // Forzar sync inmediato
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => void this.onPosition(pos, true),
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 }
      );
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.active()) return;
      const lat = this.lat();
      const lng = this.lng();
      if (lat != null && lng != null) {
        void this.sendPosition(lat, lng, this.speedKmh());
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => void this.onPosition(pos, true),
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 15_000, timeout: 12_000 }
      );
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async requestWakeLock(): Promise<void> {
    try {
      if (!('wakeLock' in navigator)) {
        this.wakeLockHeld.set(false);
        return;
      }
      await this.releaseWakeLock();
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLockHeld.set(true);
      this.wakeLock.addEventListener('release', () => {
        this.wakeLockHeld.set(false);
        this.wakeLock = null;
        // Reintentar si el tracking sigue activo y la pestaña visible
        if (this.active() && document.visibilityState === 'visible') {
          void this.requestWakeLock();
        }
      });
    } catch {
      this.wakeLockHeld.set(false);
    }
  }

  private async releaseWakeLock(): Promise<void> {
    try {
      await this.wakeLock?.release();
    } catch {
      /* ignore */
    }
    this.wakeLock = null;
    this.wakeLockHeld.set(false);
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
