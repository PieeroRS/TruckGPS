import { Injectable, computed, inject, signal } from '@angular/core';

import { AuthService } from '../../auth/auth.service';
import { ApiService } from '../api/api.service';
import { AiAlert } from '../models/dashboard.model';
import { LocationTrackingService } from './location-tracking.service';

const POLL_MS = 10_000;
const SEEN_KEY = 'truckgps_alertas_vistas';

export interface AlertToast {
  alert: AiAlert;
  at: number;
}

/**
 * Vigila las alertas en cualquier pantalla: a los supervisores les avisa de cada alerta nueva
 * (aviso en pantalla, vibración y notificación del sistema) y al conductor sólo las de su unidad.
 */
@Injectable({ providedIn: 'root' })
export class AlertWatcherService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly tracking = inject(LocationTrackingService);

  readonly alerts = signal<AiAlert[]>([]);
  readonly toasts = signal<AlertToast[]>([]);
  readonly notifPermission = signal<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );

  /** Alertas que le tocan a este usuario. */
  readonly mine = computed(() => {
    if (this.auth.isStaff()) return this.alerts();
    const vid = this.tracking.vehicleId();
    return vid ? this.alerts().filter((a) => a.vehicleId === vid) : [];
  });
  readonly unattended = computed(() => this.mine().filter((a) => (a.estado ?? 'activa') === 'activa').length);

  /** Desvío activo de la unidad que este celular está reportando (aviso para el conductor). */
  readonly myDeviation = computed(() => {
    const vid = this.tracking.vehicleId();
    return vid ? this.alerts().find((a) => a.vehicleId === vid && a.tipo === 'desvio') ?? null : null;
  });

  private timer: ReturnType<typeof setInterval> | null = null;
  private seen = new Set<string>();
  private primed = false;

  start(): void {
    if (this.timer) return;
    try {
      this.seen = new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]') as string[]);
    } catch {
      this.seen = new Set();
    }
    void this.poll();
    this.timer = setInterval(() => {
      if (!document.hidden) void this.poll();
    }, POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void this.poll();
    });
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.alerts.set([]);
    this.toasts.set([]);
    this.primed = false;
  }

  dismissToast(id: string): void {
    this.toasts.update((t) => t.filter((x) => x.alert.id !== id));
  }

  async enableNotifications(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    this.notifPermission.set(await Notification.requestPermission());
  }

  async poll(): Promise<void> {
    if (!this.auth.profile()) return;
    let list: AiAlert[];
    try {
      list = await this.api.get<AiAlert[]>('/alerts');
    } catch {
      return;
    }
    this.alerts.set(list);
    const relevant = this.mine();
    // En la primera carga sólo se marcan como vistas (no se avisa de alertas viejas).
    const fresh = relevant.filter((a) => !this.seen.has(this.key(a)));
    fresh.forEach((a) => this.seen.add(this.key(a)));
    try {
      sessionStorage.setItem(SEEN_KEY, JSON.stringify([...this.seen].slice(-300)));
    } catch {
      /* almacenamiento no disponible */
    }
    if (!this.primed) {
      this.primed = true;
      return;
    }
    for (const a of fresh) this.announce(a);
  }

  /** Una alerta que sube a severidad alta cuenta como nueva para volver a avisar. */
  private key(a: AiAlert): string {
    return `${a.id}:${a.severidad}`;
  }

  /** Respeta las preferencias de notificaciones del usuario (Mi perfil / asistente inicial). */
  private wanted(a: AiAlert): boolean {
    const n = this.auth.prefs().notificaciones;
    if (!n.en_app) return false;
    const tipo: string = a.tipo ?? '';
    if (tipo === 'desvio') return n.desvios;
    if (tipo === 'exceso_velocidad') return n.velocidad;
    if (tipo === 'incidente' || tipo === 'panico') return n.incidencias;
    if (a.severidad === 'high') return n.alta_severidad;
    return true;
  }

  private announce(a: AiAlert): void {
    if (!this.wanted(a)) return;
    const sonido = this.auth.prefs().notificaciones.sonido;
    this.toasts.update((t) => [{ alert: a, at: Date.now() }, ...t.filter((x) => x.alert.id !== a.id)].slice(0, 3));
    setTimeout(() => this.dismissToast(a.id), a.severidad === 'high' ? 20_000 : 10_000);
    if (sonido) {
      try {
        navigator.vibrate?.(a.severidad === 'high' ? [250, 120, 250, 120, 400] : [200]);
      } catch {
        /* sin vibración */
      }
      this.beep(a.severidad === 'high');
    }
    if (this.notifPermission() === 'granted' && document.hidden) {
      try {
        const n = new Notification(a.titulo, { body: a.descripcion, tag: a.id, requireInteraction: a.severidad === 'high' });
        n.onclick = () => window.focus();
      } catch {
        /* algunos navegadores móviles sólo permiten notificaciones desde un service worker */
      }
    }
  }

  private beep(alta: boolean): void {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const tonos = alta ? [880, 660, 880] : [740];
      tonos.forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
        g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.22 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.18);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + i * 0.22);
        o.stop(ctx.currentTime + i * 0.22 + 0.2);
      });
      setTimeout(() => void ctx.close(), 1200);
    } catch {
      /* el navegador no permite sonido sin interacción previa */
    }
  }
}
