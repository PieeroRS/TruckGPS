import { TrafficLayerService } from '../../core/services/traffic-layer.service';
import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import * as L from 'leaflet';
import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Ban,
  CircleCheck,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Loader2,
  LocateFixed,
  LucideAngularModule,
  Merge,
  Navigation,
  Repeat,
  RotateCw,
  TriangleAlert,
  Undo2,
  Volume2,
  VolumeX,
  X
} from 'lucide-angular';

import { GeoPlace, NavGuide, NavStep, TrafficEvent } from '../../core/models/route.model';
import { LayoutService } from '../../core/services/layout.service';
import { LocationTrackingService } from '../../core/services/location-tracking.service';
import { NavRoutesService } from '../../core/services/nav-routes.service';
import { NavSessionService } from '../../core/services/nav-session.service';
import { OfflineQueueService, isNetworkError } from '../../core/services/offline-queue.service';
import { RoutingService } from '../../core/services/routing.service';
import { VoiceService } from '../../core/services/voice.service';
import { apiErrorMessage } from '../../core/utils/api-error.util';
import { createOsmMap, glideTo } from '../../core/utils/map.utils';
import { LatLng, cumulative, lowerFirst, pointAt, projectOnPath, spokenDistance } from '../../core/utils/nav.util';

type Phase = 'inicio' | 'gps' | 'ruta' | 'guiando' | 'llegada' | 'error';

/** Navegación giro a giro con voz: guía al conductor y rodea las calles cerradas. */
@Component({
  standalone: true,
  selector: 'app-navegar-page',
  imports: [CommonModule, FormsModule, LucideAngularModule, RouterLink],
  template: `
    <div class="relative h-[calc(var(--app-h)-4rem-env(safe-area-inset-top,0px)-var(--bnav,0px))] bg-slate-200 overflow-hidden">
      <div #mapEl class="absolute inset-0 nav-map"></div>

      <!-- Indicación actual -->
      @if (phase() === 'guiando' && nextStep(); as st) {
        <button
          type="button"
          class="absolute top-2 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[440px] z-[600] text-left rounded-2xl bg-[#0b1220] text-white shadow-2xl px-4 py-3 flex items-center gap-3"
          title="Toca para repetir la indicación"
          (click)="repeat()"
        >
          <span class="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <lucide-icon [img]="stepIcon(st)" [size]="28" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[22px] font-bold leading-none tnum">{{ distLabel(distToNext()) }}</span>
            <span class="block text-[14px] font-medium leading-snug mt-1">{{ st.texto }}</span>
            @if (afterStep(); as nx) {
              <span class="block text-[11.5px] text-slate-400 mt-0.5 truncate">Luego: {{ nx.texto }}</span>
            }
          </span>
        </button>
      }

      @if (banner(); as b) {
        <div class="absolute left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[440px] z-[600] rounded-xl px-3 py-2 text-[12.5px] font-medium shadow-lg flex items-start gap-2"
          [style.top.px]="phase() === 'guiando' ? 112 : 8"
          [class]="b.tone === 'warn' ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300' : b.tone === 'bad' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'">
          <lucide-icon [img]="b.tone === 'ok' ? okIcon : warnIcon" [size]="15" class="mt-0.5 shrink-0" />
          <span>{{ b.text }}</span>
        </div>
      }

      <!-- Inicio -->
      @if (phase() === 'inicio' || phase() === 'gps' || phase() === 'ruta' || phase() === 'error') {
        <div class="absolute inset-x-3 top-1/2 -translate-y-1/2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[400px] z-[650] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-5">
          <p class="text-[10.5px] uppercase tracking-wide font-semibold text-slate-500">Navegación con voz</p>
          <h2 class="text-[17px] font-bold text-slate-900 leading-snug mt-0.5">{{ destName() }}</h2>
          @if (phase() === 'inicio') {
            <p class="text-[12.5px] text-slate-600 mt-2 leading-snug">
              Te guía giro a giro desde donde estás, habla cada indicación y busca otra ruta si hay una calle cerrada.
            </p>
            @if (!voice.supported) {
              <p class="text-[11.5px] text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-2.5 py-2 mt-3">
                Este navegador no tiene voz. Verás las indicaciones en pantalla; para escucharlas abre TruckGPS en Chrome o Safari.
              </p>
            }
            <button type="button" class="w-full mt-4 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[15px] flex items-center justify-center gap-2" (click)="start()">
              <lucide-icon [img]="navIcon" [size]="18" /> Iniciar navegación
            </button>
          } @else if (phase() === 'gps') {
            <p class="text-[13px] text-blue-700 mt-3 flex items-center gap-2"><lucide-icon [img]="loaderIcon" [size]="15" class="animate-spin" /> Buscando tu ubicación…</p>
          } @else if (phase() === 'ruta') {
            <p class="text-[13px] text-blue-700 mt-3 flex items-center gap-2"><lucide-icon [img]="loaderIcon" [size]="15" class="animate-spin" /> Calculando la mejor ruta…</p>
          } @else {
            <p class="text-[12.5px] text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg px-2.5 py-2 mt-3">{{ error() }}</p>
            <button type="button" class="w-full mt-3 py-3 rounded-xl bg-blue-600 text-white font-semibold text-[14px]" (click)="start()">Reintentar</button>
          }
          <button type="button" class="w-full mt-2 py-2.5 rounded-xl text-slate-600 text-[13px] font-semibold hover:bg-slate-50" (click)="exit()">Volver</button>
        </div>
      }

      <!-- Llegada -->
      @if (phase() === 'llegada') {
        <div class="absolute inset-x-3 top-1/2 -translate-y-1/2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[380px] z-[650] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-5 text-center">
          <span class="inline-flex w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 items-center justify-center"><lucide-icon [img]="flagIcon" [size]="26" /></span>
          <h2 class="text-[18px] font-bold text-slate-900 mt-3">Llegaste a tu destino</h2>
          <p class="text-[12.5px] text-slate-600 mt-1">{{ destName() }}</p>
          <button type="button" class="w-full mt-4 py-3 rounded-xl bg-[#0b1220] text-white font-semibold text-[14px]" (click)="exit()">Terminar</button>
        </div>
      }

      <!-- Reportar calle cerrada -->
      @if (closureSheet()) {
        <div class="absolute inset-x-2 bottom-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[420px] z-[700] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-4">
          <p class="text-[15px] font-bold text-slate-900 flex items-center gap-2"><lucide-icon [img]="banIcon" [size]="17" class="text-red-600" /> ¿La calle de adelante está cerrada?</p>
          <p class="text-[12px] text-slate-600 mt-1">Se avisa al centro de control y a los demás conductores, y se busca otra ruta.</p>
          <div class="grid grid-cols-3 gap-2 mt-3">
            @for (o of closureOptions; track o.h) {
              <button type="button" class="py-3 rounded-xl text-[12.5px] font-semibold ring-1 leading-tight" [class]="closureHours() === o.h ? 'bg-red-600 text-white ring-red-600' : 'bg-white text-slate-700 ring-slate-200'" (click)="closureHours.set(o.h)">
                {{ o.label }}<span class="block text-[10px] font-medium opacity-80">{{ o.sub }}</span>
              </button>
            }
          </div>
          <div class="flex gap-2 mt-3">
            <button type="button" class="flex-1 py-3 rounded-xl ring-1 ring-slate-200 text-slate-700 text-[14px] font-semibold" [disabled]="reporting()" (click)="closureSheet.set(false)">Cancelar</button>
            <button type="button" class="flex-1 py-3 rounded-xl bg-red-600 text-white text-[14px] font-semibold disabled:opacity-50" [disabled]="reporting()" (click)="reportClosure()">{{ reporting() ? 'Reportando…' : 'Reportar y buscar otra ruta' }}</button>
          </div>
        </div>
      }

      <!-- Barra inferior -->
      @if (phase() === 'guiando' && !closureSheet()) {
        @if (!following()) {
          <button type="button" class="absolute right-3 bottom-[104px] z-[600] px-3.5 py-2.5 rounded-full bg-white shadow-lg ring-1 ring-slate-200 text-[12.5px] font-semibold text-blue-700 flex items-center gap-1.5" (click)="recenter()">
            <lucide-icon [img]="locateIcon" [size]="15" /> Centrar
          </button>
        }
        <div class="absolute inset-x-2 bottom-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[440px] z-[600] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 px-3 py-2.5">
          <div class="flex items-center gap-2">
            <div class="min-w-0 flex-1">
              <p class="text-[19px] font-bold text-slate-900 leading-none tnum">{{ etaMin() }} min <span class="text-[12.5px] font-semibold text-slate-500">· {{ remainingLabel() }}</span></p>
              <p class="text-[11px] text-slate-500 mt-1 truncate">
                Llegada {{ etaClock() }} · {{ destName() }}
                @if (rerouting()) { · <span class="text-blue-700 font-semibold">recalculando…</span> }
              </p>
            </div>
            <button type="button" class="nav-btn" [class.is-off]="!voice.enabled()" [title]="voice.enabled() ? 'Silenciar la voz' : 'Activar la voz'" [attr.aria-label]="voice.enabled() ? 'Silenciar la voz' : 'Activar la voz'" (click)="toggleVoice()">
              <lucide-icon [img]="voice.enabled() ? volIcon : muteIcon" [size]="19" />
            </button>
            <button type="button" class="nav-btn is-danger" title="Reportar calle cerrada" aria-label="Reportar calle cerrada" (click)="closureSheet.set(true)">
              <lucide-icon [img]="banIcon" [size]="19" />
            </button>
            <button type="button" class="nav-btn" title="Salir de la navegación" aria-label="Salir de la navegación" (click)="exit()">
              <lucide-icon [img]="xIcon" [size]="19" />
            </button>
          </div>
          @if (routeId && !tracking.active()) {
            <p class="text-[10.5px] text-amber-800 mt-1.5">
              El GPS de tu unidad está apagado: el centro de control no ve tu posición.
              <a routerLink="/mi-ubicacion" class="font-semibold underline">Activarlo</a>
            </p>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .nav-btn {
        width: 44px; height: 44px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
        background: #f1f5f9; color: #0f172a; transition: background .15s;
      }
      .nav-btn:hover { background: #e2e8f0; }
      .nav-btn.is-off { background: #fee2e2; color: #b91c1c; }
      .nav-btn.is-danger { background: #fee2e2; color: #b91c1c; }
    `
  ]
})
export class NavegarPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly layout = inject(LayoutService);
  private readonly routing = inject(RoutingService);
  private readonly navRoutes = inject(NavRoutesService);
  private readonly session = inject(NavSessionService);
  readonly voice = inject(VoiceService);
  private readonly queue = inject(OfflineQueueService);
  private readonly liveTraffic = inject(TrafficLayerService);
  private detachTraffic: (() => void) | null = null;
  readonly tracking = inject(LocationTrackingService);

  readonly navIcon = Navigation;
  readonly loaderIcon = Loader2;
  readonly flagIcon = Flag;
  readonly banIcon = Ban;
  readonly volIcon = Volume2;
  readonly muteIcon = VolumeX;
  readonly xIcon = X;
  readonly locateIcon = LocateFixed;
  readonly warnIcon = TriangleAlert;
  readonly okIcon = CircleCheck;
  readonly repeatIcon = Repeat;

  readonly phase = signal<Phase>('inicio');
  readonly error = signal('');
  readonly destName = signal('Destino');
  readonly guide = signal<NavGuide | null>(null);
  readonly along = signal(0);
  readonly rerouting = signal(false);
  readonly following = signal(true);
  readonly banner = signal<{ text: string; tone: 'ok' | 'warn' | 'bad' } | null>(null);
  readonly closureSheet = signal(false);
  readonly closureHours = signal(12);
  readonly reporting = signal(false);
  readonly closureOptions = [
    { h: 2, label: 'Un rato', sub: '2 horas' },
    { h: 12, label: 'Hoy', sub: '12 horas' },
    { h: 72, label: 'Varios días', sub: '3 días' }
  ];

  routeId: string | null = null;
  private dest: GeoPlace | null = null;
  private path: LatLng[] = [];
  private cum: number[] = [0];
  private pos: { lat: number; lng: number; acc: number; speed: number; heading: number | null } | null = null;
  private watchId: number | null = null;
  private offCount = 0;
  private lastGuideAt = 0;
  private lastFixAt = 0;
  private said = new Set<string>();
  private unavoidable = new Set<string>();
  private closureTimer: ReturnType<typeof setInterval> | null = null;
  private bannerTimer: ReturnType<typeof setTimeout> | null = null;
  private wakeLock: { release: () => Promise<void> } | null = null;

  private map: L.Map | null = null;
  private line: L.Polyline | null = null;
  private lineCase: L.Polyline | null = null;
  private me: L.Marker | null = null;
  private accCircle: L.Circle | null = null;
  private destMarker: L.Marker | null = null;
  private closureLayer: L.LayerGroup | null = null;

  private readonly total = signal(0);

  /** Índice de la próxima maniobra (la primera que todavía está por delante). */
  private readonly nextIdx = computed(() => {
    const g = this.guide();
    if (!g || !g.steps.length) return -1;
    const a = this.along();
    for (let i = 1; i < g.steps.length; i++) {
      if (g.steps[i].along_m > a + 8) return i;
    }
    return g.steps.length - 1;
  });
  readonly nextStep = computed<NavStep | null>(() => this.guide()?.steps[this.nextIdx()] ?? null);
  readonly afterStep = computed<NavStep | null>(() => {
    const g = this.guide();
    const i = this.nextIdx();
    const nx = g?.steps[i + 1];
    return nx && g && nx.along_m - g.steps[i].along_m < 400 ? nx : null;
  });
  readonly distToNext = computed(() => {
    const st = this.nextStep();
    this.guide();
    return st ? Math.max(0, st.along_m - this.along()) : 0;
  });
  readonly remainingM = computed(() => {
    this.guide();
    return Math.max(0, this.total() - this.along());
  });
  readonly etaMin = computed(() => {
    const g = this.guide();
    const t = this.total();
    if (!g || !t) return 0;
    return Math.max(1, Math.round((g.durationTrafficMin * this.remainingM()) / t));
  });

  ngOnInit(): void {
    this.layout.setPage('Navegación', 'Guía por voz giro a giro');
    this.routeId = this.route.snapshot.paramMap.get('id');
    const target = this.session.target();
    if (target && (!this.routeId || target.routeId === this.routeId)) {
      this.dest = target.dest;
      this.destName.set(target.label ?? target.dest.name.split(',')[0]);
    } else if (this.routeId) {
      void this.loadRouteInfo(this.routeId);
    } else {
      void this.router.navigate(['/rutas']);
    }
  }

  /** Se abrió /navegar/<id> directo (recarga): el destino sale de la ruta guardada. */
  private async loadRouteInfo(id: string): Promise<void> {
    if (!this.navRoutes.routes().length) await this.navRoutes.load();
    const r = this.navRoutes.routes().find((x) => x.id === id);
    if (!r) {
      void this.router.navigate(['/rutas']);
      return;
    }
    this.dest = { name: r.destName, lat: r.destLat, lng: r.destLng };
    this.destName.set(r.routeLabel);
    this.drawDest();
  }

  ngAfterViewInit(): void {
    const c: LatLng = this.dest ? [this.dest.lat, this.dest.lng] : [-12.0464, -77.0428];
    this.map = createOsmMap(this.mapEl.nativeElement, c, 14);
    this.detachTraffic = this.liveTraffic.attach(this.map);
    this.closureLayer = L.layerGroup().addTo(this.map);
    this.map.on('dragstart', () => this.following.set(false));
    this.drawDest();
    setTimeout(() => this.map?.invalidateSize(), 100);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  ngOnDestroy(): void {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    if (this.closureTimer) clearInterval(this.closureTimer);
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    void this.wakeLock?.release().catch(() => undefined);
    this.voice.stop();
    this.detachTraffic?.();
    this.map?.remove();
    this.map = null;
  }

  private readonly onVisibility = (): void => {
    if (!document.hidden && this.phase() === 'guiando') void this.keepAwake();
  };

  /** Mantiene la pantalla encendida mientras se navega (si el navegador lo permite). */
  private async keepAwake(): Promise<void> {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      if (wl) this.wakeLock = await wl.request('screen');
    } catch {
      /* no disponible: la pantalla se apaga según el equipo */
    }
  }

  // ─────────────── inicio y GPS ───────────────

  start(): void {
    if (!this.dest) return;
    this.voice.unlock();
    void this.keepAwake();
    this.error.set('');
    if (!('geolocation' in navigator)) {
      this.fail('Este dispositivo no permite obtener la ubicación.');
      return;
    }
    this.phase.set('gps');
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = navigator.geolocation.watchPosition(
      (p) => this.onFix(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.coords.speed, p.coords.heading),
      (err) => {
        if (this.phase() === 'guiando' || this.phase() === 'llegada') {
          // Estar detenido (semáforo) hace vencer la espera del GPS: no es una pérdida de señal.
          if (err.code !== err.TIMEOUT && Date.now() - this.lastFixAt > 20000) this.flash('Se perdió la señal GPS. La guía continúa cuando vuelva.', 'warn');
          return;
        }
        this.fail(
          err.code === err.PERMISSION_DENIED
            ? 'Permiso de ubicación denegado. Actívalo en el navegador para poder navegar.'
            : 'No se pudo obtener tu ubicación. Sal a un lugar abierto e inténtalo de nuevo.'
        );
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 }
    );
    if (!this.closureTimer) this.closureTimer = setInterval(() => void this.checkClosures(), 20000);
  }

  private fail(msg: string): void {
    this.error.set(msg);
    this.phase.set('error');
  }

  private flash(text: string, tone: 'ok' | 'warn' | 'bad', ms = 7000): void {
    this.banner.set({ text, tone });
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.banner.set(null), ms);
  }

  private onFix(lat: number, lng: number, acc: number, speed: number | null, heading: number | null): void {
    this.lastFixAt = Date.now();
    const prev = this.pos;
    let v = speed ?? 0;
    if ((speed === null || Number.isNaN(speed)) && prev) v = prev.speed;
    this.pos = { lat, lng, acc: Math.round(acc), speed: v, heading: heading !== null && !Number.isNaN(heading) && v > 1 ? heading : null };
    this.drawMe();
    if (!this.guide()) {
      if (this.phase() === 'gps') void this.loadGuide('inicio');
      return;
    }
    if (this.phase() === 'guiando') this.progress();
  }

  // ─────────────── ruta y guía ───────────────

  private async loadGuide(motivo: 'inicio' | 'desvio' | 'cierre'): Promise<void> {
    if (!this.pos || !this.dest || this.rerouting()) return;
    const first = !this.guide();
    if (first) this.phase.set('ruta');
    this.rerouting.set(true);
    this.lastGuideAt = Date.now();
    try {
      const g = await this.routing.guide({
        origin: { lat: this.pos.lat, lng: this.pos.lng },
        routeId: this.routeId,
        dest: this.routeId ? null : { lat: this.dest.lat, lng: this.dest.lng },
        motivo
      });
      if (!g.geometry?.length || g.geometry.length < 2) throw new Error('No hay ruta disponible hasta ese destino');
      this.path = g.geometry;
      this.cum = cumulative(this.path);
      this.total.set(this.cum[this.cum.length - 1] ?? 0);
      this.said = new Set<string>();
      this.offCount = 0;
      this.along.set(0);
      this.guide.set(g);
      this.drawRoute();
      this.phase.set('guiando');
      for (const c of g.cierresEnRuta) this.unavoidable.add(c.id);

      const km = Math.round(g.distanceKm * 10) / 10;
      const resumen = `${String(km).replace('.', ',')} ${km === 1 ? 'kilómetro' : 'kilómetros'}, unos ${Math.max(1, Math.round(g.durationTrafficMin))} minutos`;
      const primero = g.steps[0]?.texto ? ` ${g.steps[0].texto}.` : '';
      if (g.cierresEnRuta.length) {
        this.flash('Hay una calle cerrada en la ruta y no se encontró cómo rodearla. Avanza con cuidado.', 'bad', 12000);
        this.voice.speak(`Atención. Hay una calle cerrada en la ruta y no se encontró otra ruta.${primero}`);
      } else if (motivo === 'cierre') {
        this.flash(`Calle cerrada más adelante: nueva ruta de ${resumen.replace(', unos', ' y')}.`, 'ok');
        this.voice.speak(`Calle cerrada más adelante. Tomando una ruta alterna.${primero}`);
      } else if (motivo === 'desvio') {
        this.voice.speak(`Ruta recalculada.${primero}`);
      } else {
        const evita = g.cierresEvitados.length ? ' Esta ruta rodea una calle cerrada.' : '';
        if (evita) this.flash('Esta ruta rodea una calle cerrada reportada.', 'ok');
        this.voice.speak(`Ruta lista. ${resumen}.${evita}${primero}`);
      }
      this.said.add('0:n');
      this.following.set(true);
      this.progress();
      void this.checkClosures(true);
    } catch (e) {
      const msg = apiErrorMessage(e, 'No se pudo calcular la ruta');
      if (first) this.fail(msg);
      else this.flash(`${msg}. Se mantiene la ruta anterior.`, 'warn');
    } finally {
      this.rerouting.set(false);
    }
  }

  /** Avance sobre la ruta: indicaciones, desvíos y llegada. */
  private progress(): void {
    const g = this.guide();
    if (!g || !this.pos || this.path.length < 2) return;
    const pr = projectOnPath(this.path, this.cum, [this.pos.lat, this.pos.lng], this.along());
    if (!pr) return;
    const tolerancia = Math.max(45, Math.min(this.pos.acc, 90));
    if (pr.distanceM > tolerancia) {
      this.offCount++;
      // Tres lecturas seguidas fuera de la ruta: se recalcula desde donde está.
      if (this.offCount >= 3 && Date.now() - this.lastGuideAt > 8000) {
        this.voice.speak('Recalculando la ruta.');
        void this.loadGuide('desvio');
      }
      return;
    }
    this.offCount = 0;
    if (pr.alongM > this.along() - 30) this.along.set(pr.alongM);

    const restante = this.total() - this.along();
    if (restante < 30) {
      this.arrive();
      return;
    }
    this.announce(g);
    this.drawMe(pr.bearing);
  }

  private announce(g: NavGuide): void {
    const i = this.nextIdx();
    const st = g.steps[i];
    if (!st || i < 1) return;
    const d = st.along_m - this.along();
    const v = Math.max(3, this.pos?.speed ?? 8);
    const cerca = Math.min(90, Math.max(35, v * 4));
    const llegada = st.tipo === 'arrive';
    if (d <= cerca && !this.said.has(`${i}:n`)) {
      this.said.add(`${i}:n`);
      this.said.add(`${i}:f`);
      if (llegada) return; // la llegada se anuncia al llegar
      const nx = g.steps[i + 1];
      const luego = nx && nx.tipo !== 'arrive' && nx.along_m - st.along_m < 130 ? `, y luego ${lowerFirst(nx.texto)}` : '';
      this.voice.speak(`${st.texto}${luego}.`);
      return;
    }
    if (d <= 420 && d > cerca + 70 && !this.said.has(`${i}:f`)) {
      this.said.add(`${i}:f`);
      this.voice.speak(llegada ? `En ${spokenDistance(d)} llegarás a tu destino.` : `En ${spokenDistance(d)}, ${lowerFirst(st.texto)}.`);
      return;
    }
    // Tramo largo sin maniobras: se avisa una vez cuánto falta.
    if (d > 800 && !this.said.has(`${i}:c`)) {
      this.said.add(`${i}:c`);
      const calle = g.steps[i - 1]?.calle;
      this.voice.speak(`Continúa${calle ? ' por ' + calle : ''} durante ${spokenDistance(d)}.`, false);
    }
  }

  private arrive(): void {
    if (this.phase() === 'llegada') return;
    this.phase.set('llegada');
    this.voice.speak('Has llegado a tu destino.');
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    void this.wakeLock?.release().catch(() => undefined);
  }

  // ─────────────── calles cerradas ───────────────

  /** Revisa los cierres reportados: si uno cae en lo que falta de la ruta, busca otra. */
  private async checkClosures(soloDibujar = false): Promise<void> {
    if (document.hidden) return;
    const t = await this.routing.trafficStatus();
    const cierres = (t?.eventos ?? []).filter((e) => e.nivel === 'cierre');
    this.drawClosures(cierres);
    if (soloDibujar || this.phase() !== 'guiando' || this.rerouting() || this.path.length < 2) return;
    for (const c of cierres) {
      if (this.unavoidable.has(c.id)) continue;
      const pr = projectOnPath(this.path, this.cum, [c.lat, c.lng]);
      if (pr && pr.distanceM <= c.radioM + 5 && pr.alongM > this.along() - 15) {
        await this.loadGuide('cierre');
        return;
      }
    }
  }

  async reportClosure(): Promise<void> {
    if (!this.pos) return;
    this.reporting.set(true);
    let pendiente: Record<string, unknown> | null = null;
    try {
      // El cierre está adelante del vehículo: se marca unos 60 m más allá sobre la ruta.
      let punto: LatLng = [this.pos.lat, this.pos.lng];
      const pr = this.path.length > 1 ? projectOnPath(this.path, this.cum, punto, this.along()) : null;
      if (pr && pr.distanceM < 60) punto = pointAt(this.path, this.cum, pr.alongM + 60);
      const calle = this.nextStepStreet();
      pendiente = {
        lat: punto[0],
        lng: punto[1],
        descripcion: calle ? `Calle cerrada en ${calle}` : 'Calle cerrada',
        duracion_h: this.closureHours(),
        route_id: this.routeId
      };
      await this.routing.reportClosure({
        lat: punto[0],
        lng: punto[1],
        descripcion: calle ? `Calle cerrada en ${calle}` : 'Calle cerrada',
        duracionH: this.closureHours(),
        routeId: this.routeId
      });
      this.closureSheet.set(false);
      await this.checkClosures(true);
      await this.loadGuide('cierre');
    } catch (e) {
      this.closureSheet.set(false);
      if (isNetworkError(e) && pendiente) {
        // Sin señal: el aviso queda guardado y se envía solo. La ruta alterna necesita conexión.
        await this.queue.addJson('/traffic/cierre', pendiente, 'Calle cerrada');
        this.flash('Sin señal: el aviso de calle cerrada se enviará al volver la conexión. Busca un desvío por tu cuenta.', 'warn', 12000);
        this.voice.speak('Sin señal. El aviso de calle cerrada se enviará cuando vuelva la conexión.');
      } else this.flash(apiErrorMessage(e, 'No se pudo reportar la calle cerrada'), 'bad');
    } finally {
      this.reporting.set(false);
    }
  }

  /** Calle por la que va el vehículo ahora (la de la última maniobra hecha). */
  private nextStepStreet(): string {
    const g = this.guide();
    const i = this.nextIdx();
    return g?.steps[Math.max(0, i - 1)]?.calle ?? '';
  }

  // ─────────────── controles ───────────────

  repeat(): void {
    const st = this.nextStep();
    if (!st) return;
    const d = this.distToNext();
    this.voice.speak(d > 60 ? `En ${spokenDistance(d)}, ${lowerFirst(st.texto)}.` : `${st.texto}.`);
  }

  toggleVoice(): void {
    const on = !this.voice.enabled();
    this.voice.setEnabled(on);
    if (on) this.voice.speak('Voz activada.');
  }

  recenter(): void {
    this.following.set(true);
    if (this.pos && this.map) this.map.setView([this.pos.lat, this.pos.lng], Math.max(this.map.getZoom(), 17), { animate: true });
  }

  exit(): void {
    this.voice.stop();
    void this.router.navigate([this.routeId ? '/mi-ubicacion' : '/rutas']);
  }

  // ─────────────── textos ───────────────

  distLabel(m: number): string {
    if (m >= 950) return `${(m / 1000).toFixed(1)} km`;
    if (m >= 100) return `${Math.round(m / 50) * 50} m`;
    return m <= 15 ? 'Ahora' : `${Math.max(10, Math.round(m / 10) * 10)} m`;
  }

  remainingLabel(): string {
    const m = this.remainingM();
    return m >= 950 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`;
  }

  etaClock(): string {
    return new Date(Date.now() + this.etaMin() * 60000).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }

  stepIcon(st: NavStep) {
    if (st.tipo === 'arrive') return Flag;
    if (st.tipo === 'roundabout' || st.tipo === 'rotary' || st.tipo === 'roundabout turn') return RotateCw;
    if (st.tipo === 'merge') return Merge;
    switch (st.mod) {
      case 'left':
      case 'sharp left':
        return CornerUpLeft;
      case 'right':
      case 'sharp right':
        return CornerUpRight;
      case 'slight left':
        return ArrowUpLeft;
      case 'slight right':
        return ArrowUpRight;
      case 'uturn':
        return Undo2;
      default:
        return ArrowUp;
    }
  }

  // ─────────────── mapa ───────────────

  private drawDest(): void {
    if (!this.map || !this.dest) return;
    this.destMarker?.remove();
    this.destMarker = L.marker([this.dest.lat, this.dest.lng], {
      icon: L.divIcon({
        className: '',
        html: '<div style="width:22px;height:22px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 2px 6px rgba(15,23,42,.35)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      })
    })
      .bindTooltip('Destino')
      .addTo(this.map);
  }

  private drawRoute(): void {
    if (!this.map) return;
    this.line?.remove();
    this.lineCase?.remove();
    this.lineCase = L.polyline(this.path, { color: '#ffffff', weight: 10, opacity: 0.95, interactive: false }).addTo(this.map);
    this.line = L.polyline(this.path, { color: '#2563eb', weight: 6, opacity: 0.95, interactive: false }).addTo(this.map);
    if (this.pos) this.map.setView([this.pos.lat, this.pos.lng], 17);
    else this.map.fitBounds(this.line.getBounds().pad(0.15));
  }

  private drawMe(rumboRuta?: number): void {
    if (!this.map || !this.pos) return;
    const ll: L.LatLngTuple = [this.pos.lat, this.pos.lng];
    const rumbo = this.pos.heading ?? rumboRuta ?? 0;
    const html = `<div style="width:34px;height:34px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;transform:rotate(${Math.round(rumbo)}deg)"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12 2 4.5 20.3l.7.7L12 18l6.8 3 .7-.7z"/></svg></div>`;
    const icon = L.divIcon({ className: '', html, iconSize: [34, 34], iconAnchor: [17, 17] });
    if (!this.me) {
      this.accCircle = L.circle(ll, { radius: this.pos.acc, color: '#2563eb', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.12, interactive: false }).addTo(this.map);
      this.me = L.marker(ll, { icon, zIndexOffset: 1000, interactive: false }).addTo(this.map);
    } else {
      this.me.setIcon(icon);
      glideTo(this.me, ll, 800);
      if (this.accCircle) {
        this.accCircle.setRadius(this.pos.acc);
        glideTo(this.accCircle, ll, 800);
      }
    }
    if (this.following() && this.phase() === 'guiando') this.map.setView(ll, Math.max(this.map.getZoom(), 16), { animate: true });
  }

  private drawClosures(cierres: TrafficEvent[]): void {
    if (!this.closureLayer) return;
    this.closureLayer.clearLayers();
    const icon = L.divIcon({
      className: '',
      html: '<div style="width:24px;height:24px;border-radius:50%;background:#dc2626;border:3px solid #fff;box-shadow:0 2px 6px rgba(15,23,42,.4);display:flex;align-items:center;justify-content:center"><div style="width:12px;height:4px;border-radius:2px;background:#fff"></div></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    for (const c of cierres) {
      L.marker([c.lat, c.lng], { icon, zIndexOffset: 500 }).bindTooltip(`Calle cerrada: ${c.descripcion}`).addTo(this.closureLayer);
    }
  }
}
