import { TrafficLayerService } from '../../core/services/traffic-layer.service';
import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { FLOW_COLORS, NavMap, TrafficSection, buildNavStyle, isNight } from './nav-map';
import { LatLng, cumulative, lowerFirst, pointAt, projectOnPath, spokenDistance } from '../../core/utils/nav.util';

type Phase = 'inicio' | 'gps' | 'ruta' | 'guiando' | 'llegada' | 'error';

/** Navegación giro a giro con voz: guía al conductor y rodea las calles cerradas. */
@Component({
  standalone: true,
  selector: 'app-navegar-page',
  imports: [CommonModule, FormsModule, LucideAngularModule, RouterLink],
  template: `
    <div class="relative h-[calc(var(--app-h)-4rem-env(safe-area-inset-top,0px)-var(--bnav,0px))] overflow-hidden" [class]="night() ? 'bg-[#1b2433]' : 'bg-slate-200'">
      <div class="absolute inset-0"><div #mapEl style="width: 100%; height: 100%"></div></div>

      <!-- Indicación actual -->
      @if (phase() === 'guiando' && nextStep(); as st) {
        <div class="absolute top-2 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[460px] z-[600]">
          <button type="button" class="nav-turn w-full text-left" title="Toca para repetir la indicación" (click)="repeat()">
            <span class="flex flex-col items-center justify-center shrink-0 w-14">
              <lucide-icon [img]="stepIcon(st)" [size]="40" [strokeWidth]="2.6" />
              <span class="text-[15px] font-bold tnum mt-0.5 whitespace-nowrap">{{ distLabel(distToNext()) }}</span>
            </span>
            <span class="min-w-0 flex-1 text-[19px] sm:text-[21px] font-semibold leading-tight">{{ st.texto }}</span>
          </button>
          @if (afterStep(); as nx) {
            <div class="nav-then">Luego <lucide-icon [img]="stepIcon(nx)" [size]="20" [strokeWidth]="2.4" /></div>
          }
        </div>
      }

      @if (banner(); as b) {
        <div class="absolute left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[460px] z-[600] rounded-xl px-3 py-2 text-[12.5px] font-medium shadow-lg flex items-start gap-2"
          [style.top.px]="phase() === 'guiando' ? (afterStep() ? 150 : 108) : 8"
          [class]="b.tone === 'warn' ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300' : b.tone === 'bad' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'">
          <lucide-icon [img]="b.tone === 'ok' ? okIcon : warnIcon" [size]="15" class="mt-0.5 shrink-0" />
          <span>{{ b.text }}</span>
        </div>
      }

      <!-- Botones del mapa -->
      @if (phase() === 'guiando' && !closureSheet()) {
        <div class="absolute right-3 z-[600] flex flex-col gap-3" style="bottom: calc(96px + env(safe-area-inset-bottom, 0px))">
          <button type="button" class="nav-fab" title="Ver el mapa con el norte arriba" aria-label="Ver el mapa con el norte arriba" (click)="northUp()">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 16 12H8Z" fill="#ef4444"/><path d="M12 22 8 12h8Z" fill="currentColor" opacity=".85"/></svg>
          </button>
          @if (hasTraffic()) {
            <button type="button" class="nav-fab" [class.is-traffic]="liveTraffic.enabled()" [attr.aria-pressed]="liveTraffic.enabled()" [title]="liveTraffic.enabled() ? 'Ocultar el tráfico' : 'Ver el tráfico'" [attr.aria-label]="liveTraffic.enabled() ? 'Ocultar el tráfico' : 'Ver el tráfico'" (click)="toggleTraffic()">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="3"/><circle cx="12" cy="7" r="1.6" fill="#ef4444" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="#f59e0b" stroke="none"/><circle cx="12" cy="17" r="1.6" fill="#22c55e" stroke="none"/></svg>
            </button>
          }
          <button type="button" class="nav-fab" [class.is-off]="!voice.enabled()" [title]="voice.enabled() ? 'Silenciar la voz' : 'Activar la voz'" [attr.aria-label]="voice.enabled() ? 'Silenciar la voz' : 'Activar la voz'" (click)="toggleVoice()">
            <lucide-icon [img]="voice.enabled() ? volIcon : muteIcon" [size]="22" />
          </button>
          <button type="button" class="nav-fab is-warn" title="Reportar calle cerrada" aria-label="Reportar calle cerrada" (click)="closureSheet.set(true)">
            <lucide-icon [img]="warnIcon" [size]="22" />
          </button>
        </div>
        @if (hasTraffic() && liveTraffic.enabled()) {
          <div class="nav-legend" [style.bottom]="following() ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : 'calc(152px + env(safe-area-inset-bottom, 0px))'" aria-label="Colores del tráfico">
            <span><i [style.background]="flowColors.fluido"></i>Fluido</span>
            <span><i [style.background]="flowColors.lento"></i>Lento</span>
            <span><i [style.background]="flowColors.congestion"></i>Congestión</span>
            <span><i [style.background]="flowColors.detenido"></i>Detenido</span>
          </div>
        }
        @if (!following()) {
          <button type="button" class="absolute left-3 z-[600] px-4 py-2.5 rounded-full bg-white shadow-lg text-[13px] font-semibold text-blue-700 flex items-center gap-1.5" style="bottom: calc(96px + env(safe-area-inset-bottom, 0px))" (click)="recenter()">
            <lucide-icon [img]="locateIcon" [size]="16" /> Centrar
          </button>
        }
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
        <div class="nav-bottom">
          <div class="min-w-0 flex-1 text-center">
            <p class="text-[26px] font-bold leading-none tnum" [class]="(guide()?.demoraTraficoMin ?? 0) >= 5 ? 'text-amber-400' : 'text-emerald-400'">{{ etaMin() }} min</p>
            <p class="text-[13px] text-slate-300 mt-1 tnum truncate">
              @if (guide()?.enVivo) { <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot align-middle mr-1" title="Con tráfico en vivo"></span> }{{ etaClock() }} · {{ remainingLabel() }}
              @if (rerouting()) { · <span class="text-sky-300 font-semibold">recalculando…</span> }
            </p>
            @if (routeId && !tracking.active()) {
              <p class="text-[10.5px] text-amber-300 mt-1">
                El GPS de tu unidad está apagado. <a routerLink="/mi-ubicacion" class="font-semibold underline">Activarlo</a>
              </p>
            }
          </div>
          <button type="button" class="nav-exit" (click)="exit()">Salir</button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .nav-turn {
        display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 18px;
        background: #0f5b49; color: #fff; box-shadow: 0 10px 30px rgba(0, 0, 0, .35);
      }
      .nav-then {
        display: inline-flex; align-items: center; gap: 8px; margin-top: -6px; padding: 12px 14px 8px;
        border-radius: 0 0 14px 14px; background: #0c4a3c; color: #fff; font-size: 15px; font-weight: 600;
        box-shadow: 0 8px 20px rgba(0, 0, 0, .3);
      }
      .nav-fab {
        width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
        background: #1f2937; color: #f8fafc; box-shadow: 0 6px 18px rgba(0, 0, 0, .35);
      }
      .nav-fab:active { transform: scale(.95); }
      .nav-fab.is-off { color: #fca5a5; }
      .nav-fab.is-warn { color: #fbbf24; }
      .nav-fab.is-traffic { background: #14532d; }
      .nav-legend {
        position: absolute; left: 12px; z-index: 600; display: flex; flex-wrap: wrap; gap: 4px 10px; max-width: calc(100% - 90px);
        padding: 7px 11px; border-radius: 12px; background: rgba(17, 20, 24, .88); color: #e5e7eb; font-size: 11.5px; font-weight: 600;
        box-shadow: 0 4px 14px rgba(0, 0, 0, .3);
      }
      .nav-legend span { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
      .nav-legend i { width: 14px; height: 5px; border-radius: 3px; display: inline-block; }
      .nav-bottom {
        position: absolute; left: 0; right: 0; bottom: 0; z-index: 600; display: flex; align-items: center; gap: 12px;
        padding: 14px 16px calc(14px + env(safe-area-inset-bottom, 0px)); background: #111418; color: #fff;
        border-radius: 22px 22px 0 0; box-shadow: 0 -8px 24px rgba(0, 0, 0, .3);
      }
      .nav-exit {
        flex-shrink: 0; padding: 12px 26px; border-radius: 999px; background: #dc2626; color: #fff; font-size: 17px; font-weight: 700;
      }
      .nav-exit:active { transform: scale(.97); }
      .nav-turn:focus-visible, .nav-fab:focus-visible, .nav-exit:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
      @media (min-width: 640px) {
        .nav-bottom { left: 50%; right: auto; width: 460px; transform: translateX(-50%); bottom: 12px; border-radius: 22px; padding-bottom: 14px; }
      }
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
  readonly liveTraffic = inject(TrafficLayerService);
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
  private trafficTimer: ReturnType<typeof setInterval> | null = null;
  private bannerTimer: ReturnType<typeof setTimeout> | null = null;
  private wakeLock: { release: () => Promise<void> } | null = null;

  private nav: NavMap | null = null;
  private rumbo = 0;
  /** De noche el mapa y la pantalla se oscurecen. */
  readonly night = signal(isNight());
  readonly hasTraffic = signal(false);
  readonly flowColors = FLOW_COLORS;

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
  /** Última revisión del tráfico: minutos que faltaban y metros que faltaban en ese momento. */
  private readonly etaRef = signal<{ min: number; restanteM: number } | null>(null);
  readonly etaMin = computed(() => {
    const g = this.guide();
    const t = this.total();
    if (!g || !t) return 0;
    const ref = this.etaRef();
    if (ref && ref.restanteM > 0) return Math.max(1, Math.round((ref.min * this.remainingM()) / ref.restanteM));
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
    document.addEventListener('visibilitychange', this.onVisibility);
    void this.initMap();
  }

  private async initMap(): Promise<void> {
    const c: LatLng = this.dest ? [this.dest.lat, this.dest.lng] : [-12.0464, -77.0428];
    const tiles = await this.liveTraffic.tiles();
    if (!this.mapEl) return;
    const built = await buildNavStyle(this.night(), tiles);
    if (!this.mapEl) return;
    this.nav = new NavMap(this.mapEl.nativeElement, c, built);
    this.hasTraffic.set(this.nav.hasTraffic());
    this.nav.setTrafficVisible(this.liveTraffic.enabled());
    this.nav.onManualMove(() => this.following.set(false));
    this.drawDest();
    if (this.path.length > 1) this.drawRoute();
    setTimeout(() => this.nav?.resize(), 100);
  }

  ngOnDestroy(): void {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    if (this.closureTimer) clearInterval(this.closureTimer);
    if (this.trafficTimer) clearInterval(this.trafficTimer);
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    void this.wakeLock?.release().catch(() => undefined);
    this.voice.stop();
    if (this.overviewTimer) clearTimeout(this.overviewTimer);
    this.nav?.remove();
    this.nav = null;
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
    // Cada 5 minutos: ¿el tráfico de más adelante empeoró y hay una ruta más rápida?
    if (!this.trafficTimer) this.trafficTimer = setInterval(() => void this.checkTraffic(), 5 * 60 * 1000);
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
      this.etaRef.set(null);
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
        this.voice.speak(`Ruta lista. ${resumen}${g.enVivo ? ' con el tráfico de ahora' : ''}.${evita}${primero}`);
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

  /** Revisa el tráfico de lo que falta. Si hay una ruta que ahorra tiempo, la toma y lo avisa. */
  private async checkTraffic(): Promise<void> {
    if (document.hidden || this.phase() !== 'guiando' || this.rerouting() || !this.pos || this.path.length < 2) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (this.remainingM() < 1500) return;
    const restante = this.remainingPath(300);
    let r;
    try {
      r = await this.routing.trafficCheck({ origin: { lat: this.pos.lat, lng: this.pos.lng }, routeId: this.routeId, remaining: restante });
    } catch {
      return; // sin señal o servidor ocupado: se intenta en la próxima revisión
    }
    if (!r.disponible || this.phase() !== 'guiando') return;
    if (!r.cambio || !r.guia) {
      if (r.etaMin) this.etaRef.set({ min: r.etaMin, restanteM: this.remainingM() });
      return;
    }
    const g = r.guia;
    if (!g.geometry?.length || g.geometry.length < 2) return;
    this.path = g.geometry;
    this.cum = cumulative(this.path);
    this.total.set(this.cum[this.cum.length - 1] ?? 0);
    this.said = new Set<string>();
    this.offCount = 0;
    this.along.set(0);
    this.etaRef.set(null);
    this.guide.set(g);
    this.lastGuideAt = Date.now();
    this.drawRoute();
    const ahorro = Math.max(1, Math.round(r.ahorroMin ?? 0));
    // A mitad de viaje se anuncia la próxima maniobra (no la salida).
    const sig = g.steps.find((st, i) => i > 0 && st.tipo !== 'arrive');
    const primero = sig ? ` En ${spokenDistance(sig.along_m)}, ${lowerFirst(sig.texto)}.` : '';
    this.flash(`Hay tráfico más adelante: nueva ruta más rápida, ahorras unos ${ahorro} min.`, 'ok', 10000);
    this.voice.speak(`Hay tráfico más adelante. Tomando una ruta más rápida. Ahorras unos ${ahorro} minutos.${primero}`);
    this.said.add('0:n');
    this.progress();
  }

  /** Lo que falta de la ruta, desde la posición actual, con como máximo `max` puntos. */
  private remainingPath(max: number): [number, number][] {
    const desde = this.along();
    let i = this.cum.findIndex((c) => c > desde);
    if (i < 0) i = this.path.length - 1;
    const resto = this.path.slice(i);
    const pts: [number, number][] = [[this.pos!.lat, this.pos!.lng], ...resto];
    if (pts.length <= max) return pts;
    const paso = (pts.length - 1) / (max - 1);
    return Array.from({ length: max }, (_, k) => pts[Math.round(k * paso)]);
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
    this.nav?.recenter(this.pos ? [this.pos.lat, this.pos.lng] : null, this.rumbo);
  }

  toggleTraffic(): void {
    const on = !this.liveTraffic.enabled();
    this.liveTraffic.setEnabled(on);
    this.nav?.setTrafficVisible(on);
  }

  northUp(): void {
    this.following.set(false);
    this.nav?.northUp();
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
    return new Date(Date.now() + this.etaMin() * 60000).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
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
    if (this.nav && this.dest) this.nav.setDest([this.dest.lat, this.dest.lng]);
  }

  private overviewTimer: ReturnType<typeof setTimeout> | null = null;
  private shownOverview = false;

  private drawRoute(): void {
    if (!this.nav) return;
    this.nav.setRoute(this.path, (this.guide()?.tramosTrafico ?? []) as TrafficSection[]);
    if (!this.pos) {
      this.nav.overview(this.path);
      return;
    }
    // Solo al empezar: se ve la ruta completa un momento y luego la vista de manejo.
    if (this.shownOverview) {
      if (this.following()) this.recenter();
      return;
    }
    this.shownOverview = true;
    if (this.overviewTimer) clearTimeout(this.overviewTimer);
    this.nav.setFollowing(false);
    this.nav.overview(this.path, 140);
    this.overviewTimer = setTimeout(() => {
      if (this.following()) this.recenter();
    }, 2600);
  }

  private drawMe(rumboRuta?: number): void {
    if (!this.nav || !this.pos) return;
    this.rumbo = this.pos.heading ?? rumboRuta ?? this.rumbo;
    this.nav.setMe([this.pos.lat, this.pos.lng], this.rumbo, this.pos.speed, this.phase() === 'guiando');
  }

  private drawClosures(cierres: TrafficEvent[]): void {
    this.nav?.setClosures(cierres);
  }
}
