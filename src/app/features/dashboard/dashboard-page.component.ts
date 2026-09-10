import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import { fromEvent } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Clock,
  Fuel,
  Gauge,
  Inbox,
  LucideAngularModule,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Route,
  Sparkles,
  TrendingUp,
  Truck,
  X
} from 'lucide-angular';
import { AuthService } from '../../auth/auth.service';
import { AiAlertInput, AiAlertsService } from '../../core/services/ai-alerts.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { FleetService } from '../../core/services/fleet.service';
import { LayoutService } from '../../core/services/layout.service';
import { AiAlert } from '../../core/models/dashboard.model';
import {
  bindVehicleTooltip,
  buildTruckIcon,
  createOsmMap
} from '../../core/utils/map.utils';

/** Tipo de icono de lucide-angular (evita el error de [img] con `unknown`). */
type LucideIcon = typeof Activity;

const KPI_COLORS: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  red: { bg: 'bg-red-50', text: 'text-red-600' },
  green: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600' }
};

const KPI_RINGS: Record<string, string> = {
  blue: 'ring-blue-100',
  red: 'ring-red-100',
  green: 'ring-emerald-100',
  violet: 'ring-violet-100'
};

const ICON_MAP: Record<string, LucideIcon> = {
  truck: Truck,
  'alert-triangle': AlertTriangle,
  clock: Clock,
  sparkles: Sparkles,
  route: Route,
  fuel: Fuel,
  gauge: Gauge,
  package: Package,
  activity: Activity
};

@Component({
  standalone: true,
  selector: 'app-dashboard-page',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">

      <!-- ═══════════ KPIs ═══════════ -->
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        @for (k of dashboard.kpis(); track k.label; let i = $index) {
          <div class="kpi group anim-in" [style.animation-delay.ms]="i * 60">
            <div class="flex items-start justify-between">
              <div
                class="w-10 h-10 rounded-xl flex items-center justify-center ring-1 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
                [class]="(kpiColors[k.color] || kpiColors['blue']).bg + ' ' + (kpiColors[k.color] || kpiColors['blue']).text + ' ' + kpiRing(k.color)"
              >
                <lucide-icon [img]="kpiIcon(k.icon)" [size]="18" [strokeWidth]="2" />
              </div>
              @if (k.trend) {
                <span
                  class="inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md transition-transform duration-200 group-hover:scale-105"
                  [class]="k.trend.startsWith('-') ? 'text-slate-600 bg-slate-100' : 'text-emerald-700 bg-emerald-50'"
                >
                  <lucide-icon [img]="k.trend.startsWith('-') ? arrowDownIcon : arrowUpIcon" [size]="11" />
                  {{ stripSign(k.trend) }}
                </span>
              }
            </div>
            <div
              class="kpi-value text-[26px] font-bold text-slate-900 tracking-[-0.03em] leading-none mt-3 tnum"
              [style.animation-delay.ms]="i * 60 + 180"
            >{{ k.value }}</div>
            <div class="text-[12.5px] text-slate-500 font-medium mt-1">{{ k.label }}</div>
          </div>
        }
      </section>

      <!-- ═══════════ MAPA + ALERTAS ═══════════ -->
      <section class="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">

        <div class="xl:col-span-8 card overflow-hidden flex flex-col anim-in" style="animation-delay: 240ms">
          <div class="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200/80">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100 flex items-center justify-center shrink-0">
                <lucide-icon [img]="mapPinIcon" [size]="17" />
              </div>
              <div class="min-w-0">
                <h2 class="text-[15px] font-semibold text-slate-900 tracking-tight">Posición en tiempo real</h2>
                <p class="text-[12px] text-slate-500 mt-0.5 truncate">
                  <span class="tnum font-medium text-slate-600">{{ fleet.count() }}</span> vehículos monitoreados · OpenStreetMap
                </p>
              </div>
            </div>

            <div class="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-slate-50 ring-1 ring-slate-200/70 shrink-0">
              @for (l of legend; track l.label) {
                <span class="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-slate-600">
                  <span class="w-1.5 h-1.5 rounded-full" [class]="l.dot"></span>{{ l.label }}
                </span>
              }
            </div>
          </div>

          <div class="relative flex-1">
            <div #mapEl class="w-full" style="height: 540px"></div>
            <div class="absolute bottom-3 left-3 z-[400] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/90 backdrop-blur ring-1 ring-slate-200 shadow-sm">
              <span class="relative flex w-1.5 h-1.5">
                <span class="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                <span class="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              </span>
              <span class="text-[11px] font-medium text-slate-600">En vivo</span>
            </div>
          </div>
        </div>

        <aside class="xl:col-span-4 card flex flex-col overflow-hidden anim-in" style="animation-delay: 300ms">
          <div class="px-4 py-4 border-b border-slate-200/80 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
                <lucide-icon [img]="sparklesIcon" [size]="16" />
              </div>
              <div class="min-w-0">
                <h2 class="text-[14px] font-semibold text-slate-900 tracking-tight">Alertas Predictivas IA</h2>
                <p class="text-[11.5px] text-slate-500 mt-0.5">
                  <span class="tnum font-medium">{{ dashboard.aiAlerts().length }}</span> alertas activas
                </p>
              </div>
            </div>
            <button
              type="button"
              class="group p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
              aria-label="Refrescar"
              (click)="refreshAlerts()"
            >
              <lucide-icon
                [img]="refreshIcon"
                [size]="14"
                class="transition-transform duration-500 group-hover:rotate-180"
                [class.animate-spin]="refreshing()"
              />
            </button>
          </div>

          @if (auth.isStaff()) {
            <div class="px-4 pt-3">
              <button
                type="button"
                class="group w-full text-[12.5px] font-semibold py-2.5 rounded-lg border border-dashed border-violet-300 text-violet-700 hover:bg-violet-50 hover:border-violet-400 flex items-center justify-center gap-1.5 transition"
                (click)="openAlertForm()"
              >
                <lucide-icon [img]="plusIcon" [size]="13" class="transition-transform duration-300 group-hover:rotate-90" />Nueva alerta manual
              </button>
            </div>
          }

          <div class="p-3 sm:p-4 space-y-2.5 overflow-y-auto flex-1" style="max-height: 500px">
            @for (a of dashboard.aiAlerts(); track a.id; let ai = $index) {
              <article class="ai-alert severity-{{ a.severidad }} alert-slide group" [style.animation-delay.ms]="ai * 50">
                <div class="flex items-start gap-2.5">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ring-1 transition-transform duration-200 group-hover:scale-105" [class]="sevIconClass(a.severidad)">
                    <lucide-icon [img]="alertIcon(a.icon)" [size]="14" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-2">
                      <h4 class="text-[13.5px] font-semibold text-slate-900 leading-snug tracking-tight">{{ a.titulo }}</h4>
                      <span class="badge shrink-0" [class]="sevBadge(a.severidad)">{{ sevLabel(a.severidad) }}</span>
                    </div>
                    <p class="text-[12.5px] text-slate-600 mt-1 leading-relaxed">{{ a.descripcion }}</p>

                    @if (a.afecta.length) {
                      <div class="flex flex-wrap gap-1 mt-2">
                        @for (p of a.afecta; track p) {
                          <span class="px-1.5 py-0.5 rounded text-[10.5px] font-mono font-medium bg-slate-100 text-slate-600 ring-1 ring-slate-200/70">{{ p }}</span>
                        }
                      </div>
                    }

                    <div class="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-100">
                      <span class="flex items-center gap-1 text-[11px] text-slate-400">
                        <lucide-icon [img]="clockIcon" [size]="11" />{{ a.tiempo }}
                      </span>
                      @if (auth.isStaff()) {
                        <div class="flex items-center gap-2.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                          <button type="button" class="text-[11px] font-semibold text-slate-500 hover:text-slate-900 transition" (click)="openAlertForm(a)">Editar</button>
                          <span class="w-px h-3 bg-slate-200"></span>
                          <button type="button" class="text-[11px] font-semibold text-amber-600 hover:text-amber-700 transition" (click)="dismissAlert(a.id)">Descartar</button>
                          <span class="w-px h-3 bg-slate-200"></span>
                          <button type="button" class="text-[11px] font-semibold text-red-500 hover:text-red-700 transition" (click)="deleteAlert(a.id)">Eliminar</button>
                        </div>
                      }
                    </div>
                  </div>
                </div>
              </article>
            } @empty {
              <div class="py-14 text-center">
                <div class="w-12 h-12 rounded-xl bg-slate-50 ring-1 ring-slate-200/70 flex items-center justify-center mx-auto mb-3">
                  <lucide-icon [img]="inboxIcon" [size]="20" class="text-slate-300" />
                </div>
                <p class="text-[13px] font-medium text-slate-600">Sin alertas activas</p>
                <p class="text-[12px] text-slate-400 mt-1 px-6 leading-relaxed">Todo en orden. El motor de IA notificará ante cualquier anomalía.</p>
              </div>
            }
          </div>

          <div class="px-4 py-2.5 border-t border-slate-200/80 bg-slate-50/50">
            <p class="text-[10.5px] text-center text-slate-400">Las alertas del LLM aparecerán aquí automáticamente.</p>
          </div>
        </aside>
      </section>

      <!-- ═══════════ FILA INFERIOR ═══════════ -->
      <section class="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mt-6">

        <div class="card p-5 anim-in transition-shadow duration-300 hover:shadow-md" style="animation-delay: 360ms">
          <div class="flex items-center gap-2 mb-4">
            <lucide-icon [img]="activityIcon" [size]="15" class="text-blue-600" />
            <h3 class="text-[13.5px] font-semibold text-slate-900 tracking-tight">Actividad reciente</h3>
          </div>
          <ul class="space-y-3 text-[12.5px] text-slate-600">
            @for (item of dashboard.activity(); track item.html; let ii = $index) {
              <li class="flex items-start gap-2.5 leading-relaxed alert-slide" [style.animation-delay.ms]="400 + ii * 45">
                <span class="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0 ring-2 ring-white" [class]="dotClass(item.dot)"></span>
                <span [innerHTML]="item.html"></span>
              </li>
            } @empty {
              <li class="text-slate-400 text-center py-6">Sin actividad registrada</li>
            }
          </ul>
        </div>

        <div class="card p-5 anim-in transition-shadow duration-300 hover:shadow-md" style="animation-delay: 420ms">
          <div class="flex items-center gap-2 mb-4">
            <lucide-icon [img]="routeIcon" [size]="15" class="text-blue-600" />
            <h3 class="text-[13.5px] font-semibold text-slate-900 tracking-tight">Rutas activas hoy</h3>
          </div>
          <ul class="space-y-3.5">
            @for (r of dashboard.routes(); track r.ruta; let ri = $index) {
              <li>
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-[12.5px] font-medium text-slate-700 truncate pr-2">{{ r.ruta }}</span>
                  <span class="text-[12.5px] font-bold tnum tracking-tight shrink-0" [class]="r.color === 'emerald' ? 'text-emerald-600' : 'text-amber-600'">{{ r.pct }}%</span>
                </div>
                <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full bar-grow transition-[width] duration-700 ease-out"
                    [class]="r.color === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'"
                    [style.width.%]="r.pct"
                    [style.animation-delay.ms]="480 + ri * 80"
                  ></div>
                </div>
              </li>
            } @empty {
              <li class="text-[12.5px] text-slate-400 text-center py-6">Sin rutas activas</li>
            }
          </ul>
        </div>

        <div class="card p-5 anim-in transition-shadow duration-300 hover:shadow-md" style="animation-delay: 480ms">
          <div class="flex items-center gap-2 mb-4">
            <lucide-icon [img]="trendIcon" [size]="15" class="text-blue-600" />
            <h3 class="text-[13.5px] font-semibold text-slate-900 tracking-tight">Resumen del día</h3>
          </div>
          @if (summary(); as s) {
            <dl class="space-y-2.5 text-[12.5px]">
              <div class="flex items-center justify-between gap-3 px-2 -mx-2 py-1 rounded-md transition-colors hover:bg-slate-50">
                <dt class="text-slate-500">Distancia recorrida</dt>
                <dd class="font-semibold tnum text-slate-900">{{ s.distancia }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3 px-2 -mx-2 py-1 rounded-md transition-colors hover:bg-slate-50">
                <dt class="text-slate-500">Entregas completadas</dt>
                <dd class="font-semibold tnum text-slate-900">{{ s.entregas }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3 px-2 -mx-2 py-1 rounded-md transition-colors hover:bg-slate-50">
                <dt class="text-slate-500">Combustible consumido</dt>
                <dd class="font-semibold tnum text-slate-900">{{ s.combustible }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3 px-2 -mx-2 py-1 rounded-md transition-colors hover:bg-slate-50">
                <dt class="text-slate-500">Incidencias resueltas</dt>
                <dd class="font-semibold tnum text-emerald-600">{{ s.resueltas }}</dd>
              </div>
              <div class="divider"></div>
              <div class="flex items-center justify-between gap-3 px-2 -mx-2 py-1 rounded-md transition-colors hover:bg-slate-50">
                <dt class="text-slate-500">Eficiencia operativa</dt>
                <dd class="font-semibold tnum text-emerald-600">{{ s.eficiencia }}</dd>
              </div>
            </dl>
          } @else {
            <div class="space-y-2.5">
              @for (n of [1, 2, 3, 4]; track n) {
                <div class="h-4 rounded bg-slate-100 animate-pulse"></div>
              }
            </div>
          }
        </div>
      </section>
    </div>

    <!-- ═══════════ MODAL ═══════════ -->
    @if (showAlertForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] fade-in-up" (click)="closeAlertForm()">
        <div class="card w-full max-w-md p-6 shadow-2xl" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between mb-5">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center">
                <lucide-icon [img]="sparklesIcon" [size]="16" />
              </div>
              <div>
                <h3 class="text-[15px] font-bold text-slate-900 tracking-tight">{{ editingAlertId() ? 'Editar alerta' : 'Nueva alerta IA' }}</h3>
                <p class="text-[11.5px] text-slate-500 mt-0.5">Se mostrará en el panel de alertas predictivas.</p>
              </div>
            </div>
            <button type="button" class="p-1.5 -mr-1.5 -mt-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" (click)="closeAlertForm()" aria-label="Cerrar">
              <lucide-icon [img]="closeIcon" [size]="18" />
            </button>
          </div>

          <form class="space-y-4" (ngSubmit)="saveAlert($event)">
            <div>
              <label class="input-label">Título</label>
              <input class="input" [(ngModel)]="alertForm.titulo" name="titulo" placeholder="Riesgo de sobrecalentamiento" required />
            </div>
            <div>
              <label class="input-label">Descripción</label>
              <textarea class="textarea" rows="3" [(ngModel)]="alertForm.descripcion" name="desc" placeholder="Detalle de la anomalía detectada..." required></textarea>
            </div>
            <div>
              <label class="input-label">Severidad</label>
              <div class="grid grid-cols-3 gap-2">
                @for (s of severities; track s.value) {
                  <button
                    type="button"
                    (click)="alertForm.severidad = s.value"
                    class="py-2 rounded-lg text-[12.5px] font-semibold ring-1 transition active:scale-95 flex flex-col items-center gap-1"
                    [class]="alertForm.severidad === s.value ? s.active : 'ring-slate-200 text-slate-500 hover:bg-slate-50'"
                  >
                    <span class="w-1.5 h-1.5 rounded-full" [class]="alertForm.severidad === s.value ? s.dot : 'bg-slate-300'"></span>
                    {{ s.label }}
                  </button>
                }
              </div>
            </div>
            <div>
              <label class="input-label">Placas afectadas</label>
              <input class="input font-mono text-[12.5px]" [(ngModel)]="alertPlacas" name="placas" placeholder="ABC-123, XYZ-789" />
              <p class="text-[11px] text-slate-400 mt-1.5">Sepáralas con comas.</p>
            </div>

            @if (alertError()) {
              <div class="flex items-start gap-2 p-3 rounded-lg bg-red-50 ring-1 ring-red-200 text-red-700 msg-in">
                <lucide-icon [img]="alertTriangleIcon" [size]="14" class="mt-0.5 shrink-0" />
                <p class="text-[12.5px] leading-snug">{{ alertError() }}</p>
              </div>
            }

            <div class="flex gap-2.5 pt-1">
              <button type="button" (click)="closeAlertForm()" class="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 transition">
                Cancelar
              </button>
              <button
                type="submit"
                [disabled]="alertSaving()"
                class="flex-[1.6] py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-60 disabled:active:scale-100 shadow-sm shadow-violet-600/25"
              >
                @if (alertSaving()) {
                  <lucide-icon [img]="refreshIcon" [size]="14" class="animate-spin" />Guardando...
                } @else {
                  Guardar alerta
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class DashboardPageComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly dashboard = inject(DashboardService);
  readonly fleet = inject(FleetService);
  readonly auth = inject(AuthService);
  private readonly aiAlerts = inject(AiAlertsService);
  private readonly layout = inject(LayoutService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;

  readonly kpiColors = KPI_COLORS;
  readonly sparklesIcon = Sparkles;
  readonly refreshIcon = RefreshCw;
  readonly clockIcon = Clock;
  readonly arrowIcon = ArrowRight;
  readonly activityIcon = Activity;
  readonly mapPinIcon = MapPin;
  readonly trendIcon = TrendingUp;
  readonly plusIcon = Plus;
  readonly closeIcon = X;

  readonly arrowUpIcon = ArrowUpRight;
  readonly arrowDownIcon = ArrowDownRight;
  readonly routeIcon = Route;
  readonly inboxIcon = Inbox;
  readonly alertTriangleIcon = AlertTriangle;

  readonly refreshing = signal(false);

  readonly legend = [
    { label: 'En ruta', dot: 'bg-emerald-500' },
    { label: 'Detenido', dot: 'bg-amber-500' },
    { label: 'Alerta', dot: 'bg-red-500' }
  ];

  readonly severities = [
    { value: 'high' as const, label: 'Alta', active: 'ring-red-300 bg-red-50 text-red-700', dot: 'bg-red-500' },
    { value: 'medium' as const, label: 'Media', active: 'ring-amber-300 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
    { value: 'low' as const, label: 'Baja', active: 'ring-emerald-300 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' }
  ];

  readonly showAlertForm = signal(false);
  readonly editingAlertId = signal<string | null>(null);
  readonly alertSaving = signal(false);
  readonly alertError = signal<string | null>(null);
  alertForm: AiAlertInput = { titulo: '', descripcion: '', severidad: 'medium' };
  alertPlacas = '';

  private map: L.Map | null = null;
  private readonly markers = new Map<string, L.Marker>();

  summary = this.dashboard.daySummary;

  ngOnInit(): void {
    this.layout.setPage('Dashboard', 'Centro de control · Operaciones en tiempo real');
  }

  async ngAfterViewInit(): Promise<void> {
    await Promise.all([this.fleet.load(), this.dashboard.load(), this.aiAlerts.load()]);
    this.initMap();
    fromEvent(window, 'resize')
      .pipe(startWith(null), debounceTime(150), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.map?.invalidateSize());
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
    this.markers.clear();
  }

  async refreshAlerts(): Promise<void> {
    this.refreshing.set(true);
    try {
      await Promise.all([this.dashboard.load(), this.aiAlerts.load(), this.fleet.load()]);
      this.refreshMarkers();
    } finally {
      this.refreshing.set(false);
    }
  }

  kpiRing(color: string): string {
    return KPI_RINGS[color] ?? KPI_RINGS['blue'];
  }

  kpiIcon(icon?: string): LucideIcon {
    return (icon && ICON_MAP[icon]) || Gauge;
  }

  alertIcon(icon?: string): LucideIcon {
    return (icon && ICON_MAP[icon]) || Sparkles;
  }

  stripSign(trend: string): string {
    return trend.replace(/^[+-]/, '');
  }

  sevIconClass(s: string): string {
    return (
      ({
        high: 'bg-red-50 text-red-600 ring-red-100',
        medium: 'bg-amber-50 text-amber-600 ring-amber-100',
        low: 'bg-emerald-50 text-emerald-600 ring-emerald-100'
      } as Record<string, string>)[s] ?? 'bg-slate-100 text-slate-500 ring-slate-200'
    );
  }

  openAlertForm(alert?: AiAlert): void {
    if (!this.auth.isStaff()) return;
    if (alert) {
      this.editingAlertId.set(alert.id);
      this.alertForm = {
        titulo: alert.titulo,
        descripcion: alert.descripcion,
        severidad: alert.severidad,
        icon: alert.icon,
        placas_afectadas: alert.afecta
      };
      this.alertPlacas = alert.afecta.join(', ');
    } else {
      this.editingAlertId.set(null);
      this.alertForm = { titulo: '', descripcion: '', severidad: 'medium' };
      this.alertPlacas = '';
    }
    this.alertError.set(null);
    this.showAlertForm.set(true);
  }

  closeAlertForm(): void {
    this.showAlertForm.set(false);
  }

  async saveAlert(e: Event): Promise<void> {
    e.preventDefault();
    this.alertSaving.set(true);
    this.alertError.set(null);
    const input: AiAlertInput = {
      ...this.alertForm,
      placas_afectadas: this.alertPlacas.split(',').map((p) => p.trim()).filter(Boolean)
    };
    try {
      const id = this.editingAlertId();
      if (id) await this.aiAlerts.update(id, input);
      else await this.aiAlerts.create(input);
      await this.dashboard.load();
      this.closeAlertForm();
    } catch (err) {
      this.alertError.set(err instanceof Error ? err.message : 'Error');
    } finally {
      this.alertSaving.set(false);
    }
  }

  async dismissAlert(id: string): Promise<void> {
    try {
      await this.aiAlerts.dismiss(id);
      await this.dashboard.load();
    } catch (err) {
      this.alertError.set(err instanceof Error ? err.message : 'Error');
    }
  }

  async deleteAlert(id: string): Promise<void> {
    if (!confirm('¿Eliminar esta alerta permanentemente?')) return;
    try {
      await this.aiAlerts.delete(id);
      await this.dashboard.load();
    } catch (err) {
      this.alertError.set(err instanceof Error ? err.message : 'Error');
    }
  }

  sevLabel(s: string): string {
    return ({ high: 'Alta', medium: 'Media', low: 'Baja' } as Record<string, string>)[s] ?? s;
  }

  sevBadge(s: string): string {
    return ({ high: 'badge-danger', medium: 'badge-warning', low: 'badge-success' } as Record<string, string>)[s] ?? '';
  }

  dotClass(dot: string): string {
    return ({ emerald: 'bg-emerald-500', red: 'bg-red-500', amber: 'bg-amber-500' } as Record<string, string>)[dot] ?? 'bg-slate-400';
  }

  private initMap(): void {
    if (this.map || !this.mapEl) return;
    this.map = createOsmMap(this.mapEl.nativeElement, [-12.0464, -77.0428], 6);
    this.refreshMarkers();
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private refreshMarkers(): void {
    if (!this.map) return;

    const vehicles = this.fleet.vehicles();
    const activas = new Set(vehicles.map((v) => v.placa));

    for (const [placa, marker] of this.markers) {
      if (!activas.has(placa)) {
        marker.remove();
        this.markers.delete(placa);
      }
    }

    for (const v of vehicles) {
      const pos: L.LatLngExpression = [v.lat, v.lng];
      const existing = this.markers.get(v.placa);
      if (existing) {
        existing.setLatLng(pos);
        existing.setIcon(buildTruckIcon(v.estado));
        bindVehicleTooltip(existing, v);
      } else {
        const m = L.marker(pos, { icon: buildTruckIcon(v.estado) }).addTo(this.map);
        bindVehicleTooltip(m, v);
        this.markers.set(v.placa, m);
      }
    }
  }
}