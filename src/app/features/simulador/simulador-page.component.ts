import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import * as L from 'leaflet';
import {
  FlaskConical,
  Gauge,
  Loader2,
  LucideAngularModule,
  Play,
  RotateCcw,
  Square,
  WifiOff,
  Route
} from 'lucide-angular';

import { AlertCardComponent } from '../../core/components/alert-card.component';
import { LayoutService } from '../../core/services/layout.service';
import { SimScenario, SimulatorService, SimulatorState } from '../../core/services/simulator.service';
import { buildTruckIcon, createOsmMap } from '../../core/utils/map.utils';

const EVENT_LABEL: Record<string, string> = {
  desvio: 'Desvío de ruta',
  regreso_ruta: 'Volvió a la ruta',
  spoofing: 'GPS spoofing',
  jamming: 'Pérdida de señal (jamming)',
  senal_recuperada: 'Señal recuperada',
  salida_zona: 'Salida de geocerca',
  parada_riesgo: 'Parada en zona de riesgo',
  ruta_completada: 'Ruta completada',
  simulacion: 'Simulador'
};

const ESCENARIO_LABEL: Record<string, string> = {
  normal: 'Circulando normal',
  retorno: 'Retomando la ruta',
  desvio: 'Desvío en curso',
  spoofing: 'Spoofing en curso',
  jamming: 'Sin señal GPS',
  salida_zona: 'Saliendo de la geocerca',
  sabotaje: 'Sabotaje en curso'
};

@Component({
  standalone: true,
  selector: 'app-simulador-page',
  imports: [LucideAngularModule, AlertCardComponent],
  template: `
    <div class="p-4 sm:p-6 space-y-5">
      <!-- Estado de la unidad -->
      <section class="card p-4 flex flex-wrap items-center gap-4 justify-between">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-11 h-11 rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
            <lucide-icon [img]="flaskIcon" [size]="20" />
          </div>
          <div class="min-w-0">
            <h2 class="text-[15px] font-semibold text-slate-900 tracking-tight">
              Unidad de prueba {{ st()?.vehicle?.placa ?? 'SIM-001' }}
            </h2>
            <p class="text-[12px] text-slate-500 mt-0.5">
              Se mueve sola por un circuito real del Callao y Lima. Usa los escenarios para probar cada regla; los correos llevan el prefijo [SIMULACIÓN].
            </p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold ring-1" [class]="escenarioClass()">
            <span class="w-1.5 h-1.5 rounded-full bg-current"></span>{{ escenarioLabel() }}
            @if (restante() !== null) {
              <span class="tnum font-mono">· {{ fmtSecs(restante()!) }}</span>
            }
          </span>
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-slate-100 text-slate-700 ring-1 ring-slate-200 tnum">
            <lucide-icon [img]="gaugeIcon" [size]="12" />{{ st()?.vehicle?.velocidad ?? 0 }} km/h
          </span>
          @if (st()?.senalPerdida) {
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-red-50 text-red-700 ring-1 ring-red-200">
              <lucide-icon [img]="wifiOffIcon" [size]="12" />Sin señal
            </span>
          }
          @if (st()?.desviado) {
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200">
              <lucide-icon [img]="routeIcon" [size]="12" />Fuera de ruta
            </span>
          }
          <button type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50" [disabled]="busy() !== null || !escenarioActivo()" (click)="stop()">
            <lucide-icon [img]="stopIcon" [size]="12" />Terminar escenario
          </button>
          <button type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50" [disabled]="busy() !== null" (click)="reset()">
            <lucide-icon [img]="resetIcon" [size]="12" />Reiniciar unidad
          </button>
        </div>
      </section>

      @if (info()) {
        <p class="text-[12.5px] rounded-lg px-3 py-2 ring-1" [class]="infoError() ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-blue-50 text-blue-800 ring-blue-200'">{{ info() }}</p>
      }

      <section class="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <!-- Escenarios -->
        <div class="xl:col-span-4 space-y-2.5">
          <h3 class="text-[12px] uppercase tracking-wide font-semibold text-slate-500">Escenarios de prueba</h3>
          @for (s of st()?.escenarios ?? []; track s.tipo) {
            <article class="card p-3.5" [class.ring-2]="st()?.escenario === s.tipo" [class.ring-violet-400]="st()?.escenario === s.tipo">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-1 mb-1">
                    @for (c of s.casos; track c) {
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-900 text-white">{{ c }}</span>
                    }
                  </div>
                  <h4 class="text-[13.5px] font-semibold text-slate-900">{{ s.titulo }}</h4>
                </div>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 shrink-0"
                  [disabled]="busy() !== null"
                  (click)="start(s)"
                >
                  @if (busy() === s.tipo) {
                    <lucide-icon [img]="loaderIcon" [size]="12" class="animate-spin" />
                  } @else {
                    <lucide-icon [img]="playIcon" [size]="12" />
                  }
                  Probar
                </button>
              </div>
              <p class="text-[12px] text-slate-600 mt-1.5 leading-relaxed">{{ s.descripcion }}</p>
            </article>
          }
          <p class="text-[11px] text-slate-400 leading-relaxed">
            Las reglas son las mismas que para los camiones reales: desvío &gt; 250 m (alta desde 1 km), salto de posición imposible, sin reportes mientras circula,
            salida de geocerca y puntaje de sabotaje ponderado de las últimas 24 h. «Reiniciar unidad» borra el historial de prueba.
          </p>
        </div>

        <!-- Mapa -->
        <div class="order-first xl:order-none xl:col-span-8 space-y-5">
          <div class="card overflow-hidden">
            <div #mapEl class="h-[45dvh] min-h-[280px] xl:h-[420px] w-full"></div>
            <div class="px-4 py-2.5 border-t border-slate-200/80 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <span class="flex items-center gap-1.5"><span class="w-4 h-0.5 bg-blue-600"></span>Ruta asignada</span>
              <span class="flex items-center gap-1.5"><span class="w-4 h-0.5 bg-violet-600"></span>Tramo recalculado / alterno</span>
              <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full ring-2 ring-emerald-500 ring-dashed"></span>Geocerca de operación</span>
              <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-red-500/30 ring-1 ring-red-500"></span>Evento de tráfico</span>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div class="space-y-2.5">
              <h3 class="text-[12px] uppercase tracking-wide font-semibold text-slate-500">Alertas de la unidad ({{ st()?.alertas?.length ?? 0 }})</h3>
              @for (a of st()?.alertas ?? []; track a.id) {
                <app-alert-card [alert]="a" (changed)="refresh()" />
              } @empty {
                <p class="card p-4 text-[12.5px] text-slate-500">Sin alertas activas. Inicia un escenario para generar una.</p>
              }
            </div>
            <div class="space-y-2.5">
              <h3 class="text-[12px] uppercase tracking-wide font-semibold text-slate-500">Historial de eventos</h3>
              <ol class="card p-4 space-y-2.5 max-h-[520px] overflow-y-auto">
                @for (e of st()?.eventos ?? []; track e.id) {
                  <li class="flex gap-2.5">
                    <span class="w-2 h-2 rounded-full mt-1.5 shrink-0" [class]="e.severidad === 'high' ? 'bg-red-500' : e.severidad === 'medium' ? 'bg-amber-500' : 'bg-slate-300'"></span>
                    <div class="min-w-0">
                      <p class="text-[12px] font-semibold text-slate-800">
                        {{ eventLabel(e.tipo) }}
                        <span class="font-normal text-slate-400"> · {{ hora(e.creado) }}</span>
                      </p>
                      <p class="text-[12px] text-slate-600 leading-snug">{{ e.descripcion }}</p>
                    </div>
                  </li>
                } @empty {
                  <li class="text-[12.5px] text-slate-500">Todavía no hay eventos.</li>
                }
              </ol>
            </div>
          </div>
        </div>
      </section>
    </div>
  `
})
export class SimuladorPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly sim = inject(SimulatorService);
  private readonly layout = inject(LayoutService);

  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;

  readonly flaskIcon = FlaskConical;
  readonly gaugeIcon = Gauge;
  readonly loaderIcon = Loader2;
  readonly playIcon = Play;
  readonly resetIcon = RotateCcw;
  readonly stopIcon = Square;
  readonly wifiOffIcon = WifiOff;
  readonly routeIcon = Route;

  readonly st = this.sim.state;
  readonly busy = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly infoError = signal(false);
  readonly restante = signal<number | null>(null);

  readonly escenarioActivo = computed(() => {
    const e = this.st()?.escenario;
    return !!e && e !== 'normal';
  });
  readonly escenarioLabel = computed(() => ESCENARIO_LABEL[this.st()?.escenario ?? 'normal'] ?? this.st()?.escenario ?? '');
  readonly escenarioClass = computed(() =>
    this.escenarioActivo() ? 'bg-violet-50 text-violet-700 ring-violet-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  );

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private overlays: L.LayerGroup | null = null;
  private trail: L.Polyline | null = null;
  private readonly trailPts: L.LatLngTuple[] = [];
  private lastGeomKey = '';
  private didFit = false;
  private poll: ReturnType<typeof setInterval> | null = null;
  private countdown: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.layout.setPage('Simulador', 'Unidad de prueba en movimiento y casos de prueba del motor de detección');
  }

  async ngAfterViewInit(): Promise<void> {
    this.map = createOsmMap(this.mapEl.nativeElement, [-12.05, -77.09], 13);
    this.overlays = L.layerGroup().addTo(this.map);
    this.trail = L.polyline([], { color: '#7c3aed', weight: 2, opacity: 0.6 }).addTo(this.map);
    setTimeout(() => this.map?.invalidateSize(), 100);
    await this.refresh();
    this.poll = setInterval(() => {
      if (!document.hidden) void this.refresh(true);
    }, 4000);
    this.countdown = setInterval(() => {
      const r = this.restante();
      if (r !== null && r > 0) this.restante.set(r - 1);
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.poll) clearInterval(this.poll);
    if (this.countdown) clearInterval(this.countdown);
    this.map?.remove();
    this.map = null;
  }

  async refresh(silent = false): Promise<void> {
    try {
      const s = await this.sim.load();
      this.apply(s);
    } catch (e) {
      if (!silent) this.show(e instanceof Error ? e.message : 'Error', true);
    }
  }

  async start(s: SimScenario): Promise<void> {
    this.busy.set(s.tipo);
    try {
      const info = await this.sim.start(s.tipo);
      this.show(`${s.titulo}: ${info}`);
      this.apply(this.st()!);
    } catch (e) {
      this.show(e instanceof Error ? e.message : 'Error', true);
    } finally {
      this.busy.set(null);
    }
  }

  async stop(): Promise<void> {
    this.busy.set('stop');
    try {
      await this.sim.stop();
      this.show('Escenario terminado: la unidad vuelve a su ruta.');
      this.apply(this.st()!);
    } catch (e) {
      this.show(e instanceof Error ? e.message : 'Error', true);
    } finally {
      this.busy.set(null);
    }
  }

  async reset(): Promise<void> {
    if (!confirm('¿Reiniciar la unidad de prueba? Se borran sus eventos y se cierran sus alertas.')) return;
    this.busy.set('reset');
    try {
      await this.sim.reset();
      this.trailPts.length = 0;
      this.show('Unidad reiniciada en su circuito.');
      this.apply(this.st()!);
    } catch (e) {
      this.show(e instanceof Error ? e.message : 'Error', true);
    } finally {
      this.busy.set(null);
    }
  }

  eventLabel(t: string): string {
    return EVENT_LABEL[t] ?? t;
  }

  hora(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  fmtSecs(s: number): string {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  private show(msg: string, error = false): void {
    this.info.set(msg);
    this.infoError.set(error);
  }

  private apply(s: SimulatorState): void {
    this.restante.set(s.restanteS);
    if (!this.map || !this.overlays || !this.trail) return;

    // Capas fijas: se redibujan sólo si cambian la ruta, el tramo o el tráfico.
    const key = JSON.stringify([s.ruta?.id, s.ruta?.geometry?.length, s.tramoRetorno?.length, s.trafico.map((t) => t.id)]);
    if (key !== this.lastGeomKey) {
      this.lastGeomKey = key;
      this.overlays.clearLayers();
      L.circle([s.geocerca.lat, s.geocerca.lng], {
        radius: s.geocerca.radioM,
        color: '#10b981',
        weight: 2,
        dashArray: '6 6',
        fillOpacity: 0.03
      })
        .bindTooltip('Geocerca de operación')
        .addTo(this.overlays);
      if (s.ruta?.geometry?.length) {
        L.polyline(s.ruta.geometry, { color: '#2563eb', weight: 5, opacity: 0.75 }).bindTooltip(s.ruta.routeLabel).addTo(this.overlays);
      }
      if (s.tramoRetorno?.length) {
        L.polyline(s.tramoRetorno, { color: '#7c3aed', weight: 5, opacity: 0.9 }).bindTooltip('Tramo recalculado').addTo(this.overlays);
      }
      for (const a of s.alertas) {
        const alt = a.payload?.alternativa;
        if (alt?.geometry?.length) {
          L.polyline(alt.geometry, { color: '#7c3aed', weight: 4, dashArray: '6 6', opacity: 0.8 })
            .bindTooltip(`Alternativa: ahorra ~${Math.round(alt.ahorro_min)} min`)
            .addTo(this.overlays);
        }
      }
      for (const t of s.trafico) {
        L.circle([t.lat, t.lng], { radius: t.radioM, color: '#dc2626', weight: 2, fillColor: '#dc2626', fillOpacity: 0.2 })
          .bindTooltip(t.descripcion)
          .addTo(this.overlays);
      }
    }

    const v = s.vehicle;
    const pos: L.LatLngTuple = [v.lat, v.lng];
    const last = this.trailPts[this.trailPts.length - 1];
    if (!last || last[0] !== pos[0] || last[1] !== pos[1]) {
      this.trailPts.push(pos);
      if (this.trailPts.length > 120) this.trailPts.shift();
      this.trail.setLatLngs(this.trailPts);
    }
    const icon = buildTruckIcon(v.estado, true);
    if (this.marker) {
      this.marker.setLatLng(pos).setIcon(icon);
    } else {
      this.marker = L.marker(pos, { icon, zIndexOffset: 1000 }).addTo(this.map);
    }
    this.marker.bindTooltip(`<strong>${v.placa}</strong> · ${v.velocidad} km/h`, { className: 'truck-tooltip', direction: 'top' });

    // Encuadre: al inicio, y si la unidad se sale de la vista (spoofing, geocerca).
    if (!this.didFit || !this.map.getBounds().pad(-0.05).contains(pos)) {
      const bounds = L.latLngBounds([pos]);
      if (s.ruta?.geometry?.length) s.ruta.geometry.forEach((p) => bounds.extend(p));
      this.map.fitBounds(bounds.pad(0.1), { maxZoom: 15 });
      this.didFit = true;
    }
  }
}
