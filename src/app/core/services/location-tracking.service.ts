import { Injectable, inject, signal } from '@angular/core';

import { AuthService } from '../../auth/auth.service';
import { ApiService } from '../api/api.service';
import { apiErrorMessage } from '../utils/api-error.util';

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
  private readonly api = inject(ApiService);
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
    if (!userId) return [];
    try {
      return await this.api.get<VehicleOption[]>('/vehicles/options');
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo cargar la flota'));
    }
  }

  async start(vehicleId: string, placa: string): Promise<{ ok: boolean; error?: string }> {
    this.error.set(null);

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
      const prev = this.vehicleId();
      if (prev && prev !== vehicleId && this.active()) {
        await this.releaseVehicle(prev);
        this.clearWatchOnly();
      }

      try {
        await this.api.post(`/vehicles/${vehicleId}/claim`);
      } catch (e) {
        return {
          ok: false,
          error: apiErrorMessage(e, 'No se pudo asignar el vehículo. ¿Ya está en uso por otro conductor?')
        };
      }

      this.vehicleId.set(vehicleId);
      this.vehiclePlaca.set(placa);
      this.persist({ vehicleId, placa, userId });

      const geoOk = await this.startWatch();
      if (!geoOk.ok) {
        await this.releaseVehicle(vehicleId);
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
      await this.releaseVehicle(vid);
    }

    this.clearLocalState(releaseVehicle);
  }

  async resumeIfNeeded(): Promise<void> {
    if (this.active() || this.starting) return;

    let saved: PersistedState | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw) as PersistedState;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }

    if (!saved?.vehicleId || !saved.placa) return;

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

      setTimeout(() => {
        if (!resolved && this.watchId !== null) {
          finish({ ok: true });
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
    if (!vid) return;

    this.syncing.set(true);
    try {
      await this.api.post(`/vehicles/${vid}/position`, { lat, lng, velocidad: speed });
      this.error.set(null);
      this.lastSentAt = Date.now();
      this.lastSentLat = lat;
      this.lastSentLng = lng;
      this.lastSync.set(new Date());
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'Error al enviar ubicación'));
    } finally {
      this.syncing.set(false);
    }
  }

  private async releaseVehicle(vehicleId: string): Promise<void> {
    try {
      await this.api.post(`/vehicles/${vehicleId}/release`);
    } catch {
      /* ignore */
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
    if (this.active() && this.watchId === null) {
      await this.startWatch();
    }
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
