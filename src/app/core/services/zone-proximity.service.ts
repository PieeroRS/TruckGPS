import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { RiskZone } from '../models/zone.model';
import { LocationTrackingService } from './location-tracking.service';
import { ZonesService } from './zones.service';

/** Distancia extra (m) a partir del borde de una zona para avisar que te acercas. */
const NEAR_MARGIN_M = 1000;
const RELOAD_MS = 10 * 60_000;

export interface ZoneHit {
  zone: RiskZone;
  distanceM: number;
}

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

/**
 * Avisa al conductor (en cualquier pantalla) cuando su posición compartida
 * entra o se acerca a una zona peligrosa activa.
 */
@Injectable({ providedIn: 'root' })
export class ZoneProximityService {
  private readonly tracking = inject(LocationTrackingService);
  private readonly zonesSvc = inject(ZonesService);

  private readonly zones = signal<RiskZone[]>([]);
  private lastLoad = 0;
  private loading = false;
  private lastInsideId: string | null = null;

  readonly dismissedId = signal<string | null>(null);

  private readonly hits = computed<ZoneHit[]>(() => {
    const lat = this.tracking.lat();
    const lng = this.tracking.lng();
    if (!this.tracking.active() || lat === null || lng === null) return [];
    return this.zones()
      .filter((z) => z.activa)
      .map((zone) => ({ zone, distanceM: distanceM(lat, lng, zone.lat, zone.lng) }))
      .filter((h) => h.distanceM <= h.zone.radioM + NEAR_MARGIN_M)
      .sort((a, b) => a.distanceM - b.distanceM);
  });

  readonly inside = computed<ZoneHit | null>(() => this.hits().find((h) => h.distanceM <= h.zone.radioM) ?? null);
  readonly near = computed<ZoneHit | null>(() => (this.inside() ? null : this.hits()[0] ?? null));

  constructor() {
    effect(() => {
      if (this.tracking.active() && this.tracking.lat() !== null) void this.ensureZones();
    });
    effect(() => {
      const id = this.inside()?.zone.id ?? null;
      if (id && id !== this.lastInsideId) {
        this.dismissedId.set(null);
        try {
          navigator.vibrate?.([300, 150, 300]);
        } catch {
          /* algunos navegadores no permiten vibrar */
        }
      }
      this.lastInsideId = id;
    });
  }

  dismiss(): void {
    this.dismissedId.set(this.inside()?.zone.id ?? this.near()?.zone.id ?? null);
  }

  private async ensureZones(): Promise<void> {
    if (this.loading || Date.now() - this.lastLoad < RELOAD_MS) return;
    this.loading = true;
    try {
      this.zones.set(await this.zonesSvc.loadZones());
      this.lastLoad = Date.now();
    } catch {
      /* sin conexión: se reintenta en la próxima posición */
    } finally {
      this.loading = false;
    }
  }
}
