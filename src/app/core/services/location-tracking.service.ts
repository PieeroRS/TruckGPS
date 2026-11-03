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
/** Envío mínimo entre reportes en movimiento (como Google: casi en tiempo real). */
const MIN_SEND_MS = 3_000;
/** Detenido: un reporte cada este tiempo aunque no cambie nada. */
const HEARTBEAT_MS = 15_000;
/** Metros mínimos de movimiento real para reenviar antes del heartbeat. */
const MIN_MOVE_M = 5;

export type AccuracyQuality = 'gps' | 'buena' | 'aproximada' | 'muy_aproximada';

/** Clasifica coords.accuracy: ≤ 25 m suele ser GPS; > 100 m es WiFi/antena; > 1 km es por IP. */
export function accuracyQuality(m: number | null | undefined): AccuracyQuality | null {
  if (m == null) return null;
  if (m <= 25) return 'gps';
  if (m <= 100) return 'buena';
  if (m <= 1000) return 'aproximada';
  return 'muy_aproximada';
}

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
  /** Radio de incertidumbre (m) de la última lectura: el "círculo azul" de Google Maps. */
  readonly accuracy = signal<number | null>(null);
  /** true si el último envío fue descartado por el servidor por ser mucho peor que el anterior. */
  readonly lastIgnored = signal(false);
  readonly lastSync = signal<Date | null>(null);
  readonly error = signal<string | null>(null);
  readonly syncing = signal(false);
  readonly background = signal(false);
  readonly wakeLockHeld = signal(false);

  private watchId: number | null = null;
  private lastSentAt = 0;
  private lastSentLat: number | null = null;
  private lastSentLng: number | null = null;
  private lastSentAcc: number | null = null;
  private lastPosAt = 0;
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
        // maximumAge 0: nunca reutilizar una posición en caché (la causa típica de "estoy en otro lado").
        { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 }
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
    const acc = Math.round(pos.coords.accuracy);
    const now = Date.now();

    // Lecturas viejas que el navegador entrega fuera de orden.
    if (pos.timestamp && pos.timestamp < this.lastPosAt) return;

    // Con un GPS bueno reciente, ignorar lecturas mucho peores (el celular alterna GPS y WiFi/antena).
    const prevAcc = this.accuracy();
    if (!force && prevAcc !== null && now - this.lastPosAt < 30_000 && acc > Math.max(100, prevAcc * 3)) return;
    this.lastPosAt = pos.timestamp || now;

    // Velocidad del GPS; si el equipo no la da, se calcula con el desplazamiento.
    let speed = pos.coords.speed != null && pos.coords.speed >= 0 ? Math.round(pos.coords.speed * 3.6) : null;
    if (speed === null && this.lastSentLat !== null && this.lastSentLng !== null && this.lastSentAt) {
      const d = haversineM(this.lastSentLat, this.lastSentLng, lat, lng);
      const dt = (now - this.lastSentAt) / 1000;
      speed = dt > 0 && d > Math.max(acc, 10) ? Math.min(180, Math.round((d / dt) * 3.6)) : 0;
    }

    this.lat.set(lat);
    this.lng.set(lng);
    this.accuracy.set(acc);
    this.speedKmh.set(speed ?? 0);

    const isFirst = this.lastSentAt === 0;
    const dist =
      this.lastSentLat === null || this.lastSentLng === null ? Infinity : haversineM(this.lastSentLat, this.lastSentLng, lat, lng);
    // Moverse "de verdad": más que el ruido de la propia medición.
    const moved = dist >= Math.max(MIN_MOVE_M, acc / 2);
    const improved = this.lastSentAcc !== null && acc < this.lastSentAcc * 0.6;
    const elapsed = now - this.lastSentAt;

    if (!force && !isFirst && !improved && (elapsed < MIN_SEND_MS || (!moved && elapsed < HEARTBEAT_MS))) return;

    await this.sendPosition(lat, lng, speed ?? 0, acc);
  }

  /** Pide una lectura nueva al instante (botón "Precisar ubicación"). */
  refreshNow(): Promise<void> {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await this.onPosition(pos, true);
          resolve();
        },
        () => resolve(),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }
      );
    });
  }

  private async sendPosition(lat: number, lng: number, speed: number, acc: number | null = this.accuracy()): Promise<void> {
    const vid = this.vehicleId();
    if (!vid) return;

    this.syncing.set(true);
    try {
      const res = await this.api.post<{ ignorada?: boolean }>(`/vehicles/${vid}/position`, {
        lat,
        lng,
        velocidad: speed,
        precision_m: acc
      });
      this.lastIgnored.set(!!res?.ignorada);
      this.error.set(null);
      this.lastSentAt = Date.now();
      this.lastSentLat = lat;
      this.lastSentLng = lng;
      this.lastSentAcc = acc;
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
    this.accuracy.set(null);
    this.lastIgnored.set(false);
    this.lastSync.set(null);
    this.background.set(false);
    this.lastSentAt = 0;
    this.lastSentLat = null;
    this.lastSentLng = null;
    this.lastSentAcc = null;
    this.lastPosAt = 0;
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
      // Si watchPosition no trajo nada nuevo (equipo quieto), se pide una lectura fresca.
      if (Date.now() - this.lastSentAt < HEARTBEAT_MS - 1000) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => void this.onPosition(pos, true),
        () => {
          const lat = this.lat();
          const lng = this.lng();
          if (lat != null && lng != null) void this.sendPosition(lat, lng, this.speedKmh());
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 12_000 }
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
