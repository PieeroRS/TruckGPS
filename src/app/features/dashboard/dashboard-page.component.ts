import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
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
  ArrowRight,
  Clock,
  LucideAngularModule,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
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

const KPI_COLORS: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  red: { bg: 'bg-red-50', text: 'text-red-600' },
  green: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600' }
};

const ICON_MAP: Record<string, unknown> = {
  truck: Activity,
  'alert-triangle': Activity,
  clock: Clock,
  sparkles: Sparkles
};

@Component({
  standalone: true,
  selector: 'app-dashboard-page',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="p-4 sm:p-6 lg:p-8">
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        @for (k of dashboard.kpis(); track k.label) {
          <div class="kpi fade-in-up">
            <div class="flex items-center justify-between">
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center"
                [class]="(kpiColors[k.color] || kpiColors['blue']).bg + ' ' + (kpiColors[k.color] || kpiColors['blue']).text"
              >
                <lucide-icon [img]="sparklesIcon" [size]="18" />
              </div>
              <span
                class="text-[11px] font-semibold"
                [class]="k.trend.startsWith('-') ? 'text-slate-500' : 'text-emerald-600'"
              >{{ k.trend }}</span>
            </div>
            <div class="text-2xl font-bold text-slate-900 tracking-tight">{{ k.value }}</div>
            <div class="text-xs text-slate-500">{{ k.label }}</div>
          </div>
        }
      </section>

      <section class="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
        <div class="xl:col-span-8 card overflow-hidden">
          <div class="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200">
            <div>
              <h2 class="text-sm sm:text-base font-semibold text-slate-900">Posición en tiempo real</h2>
              <p class="text-xs text-slate-500 mt-0.5">{{ fleet.count() }} vehículos monitoreados · OpenStreetMap</p>
            </div>
            <div class="hidden sm:flex items-center gap-3 text-[11px] text-slate-600">
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>En ruta</span>
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500"></span>Detenido</span>
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-red-500"></span>Alerta</span>
            </div>
          </div>
          <div #mapEl class="w-full" style="height: 540px"></div>
        </div>

        <aside class="xl:col-span-4 card flex flex-col">
          <div class="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                <lucide-icon [img]="sparklesIcon" [size]="16" />
              </div>
              <div>
                <h2 class="text-sm font-semibold text-slate-900">Alertas Predictivas IA</h2>
                <p class="text-[11px] text-slate-500">{{ dashboard.aiAlerts().length }} alertas activas</p>
              </div>
            </div>
            <button type="button" class="p-1.5 rounded-md hover:bg-slate-100 transition" aria-label="Refrescar" (click)="refreshAlerts()">
              <lucide-icon [img]="refreshIcon" [size]="14" class="text-slate-500" />
            </button>
          </div>
          @if (auth.isStaff()) {
            <div class="px-4 pb-2">
              <button type="button" class="w-full text-xs font-semibold py-2 rounded-md border border-violet-200 text-violet-700 hover:bg-violet-50 flex items-center justify-center gap-1" (click)="openAlertForm()">
                <lucide-icon [img]="plusIcon" [size]="12" />Nueva alerta (manual)
              </button>
            </div>
          }
          <div class="p-3 sm:p-4 space-y-3 overflow-y-auto" style="max-height: 540px">
            @for (a of dashboard.aiAlerts(); track a.id) {
              <article class="ai-alert severity-{{ a.severidad }} fade-in-up">
                <div class="flex items-start gap-2.5">
                  <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    <lucide-icon [img]="sparklesIcon" [size]="15" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                      <h4 class="text-sm font-semibold text-slate-900 leading-snug">{{ a.titulo }}</h4>
                      <span class="badge shrink-0" [class]="sevBadge(a.severidad)">{{ sevLabel(a.severidad) }}</span>
                    </div>
                    <p class="text-xs text-slate-600 mt-1 leading-relaxed">{{ a.descripcion }}</p>
                    <div class="flex items-center justify-between mt-2.5">
                      <div class="flex items-center gap-1 text-[11px] text-slate-500">
                        <lucide-icon [img]="clockIcon" [size]="11" />
                        <span>{{ a.tiempo }}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        @if (auth.isStaff()) {
                          <button type="button" class="text-[10px] font-semibold text-slate-600 hover:text-slate-900" (click)="openAlertForm(a)">Editar</button>
                          <button type="button" class="text-[10px] font-semibold text-amber-700" (click)="dismissAlert(a.id)">Descartar</button>
                          <button type="button" class="text-[10px] font-semibold text-red-600" (click)="deleteAlert(a.id)">Eliminar</button>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            }
          </div>
          <div class="p-3 border-t border-slate-200">
            <p class="text-[10px] text-center text-slate-500">Las alertas del LLM aparecerán aquí automáticamente.</p>
          </div>
        </aside>
      </section>

      <section class="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mt-6">
        <div class="card p-5">
          <div class="flex items-center gap-2 mb-3">
            <lucide-icon [img]="activityIcon" [size]="16" class="text-blue-600" />
            <h3 class="text-sm font-semibold text-slate-900">Actividad reciente</h3>
          </div>
          <ul class="space-y-2.5 text-xs text-slate-600">
            @for (item of dashboard.activity(); track item.html) {
              <li class="flex items-start gap-2">
                <span class="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" [class]="dotClass(item.dot)"></span>
                <span [innerHTML]="item.html"></span>
              </li>
            }
          </ul>
        </div>

        <div class="card p-5">
          <div class="flex items-center gap-2 mb-3">
            <lucide-icon [img]="mapPinIcon" [size]="16" class="text-blue-600" />
            <h3 class="text-sm font-semibold text-slate-900">Rutas activas hoy</h3>
          </div>
          <ul class="space-y-3 text-xs">
            @for (r of dashboard.routes(); track r.ruta) {
              <li>
                <div class="flex items-center justify-between mb-1">
                  <span class="font-medium text-slate-700">{{ r.ruta }}</span>
                  <span class="font-semibold" [class]="r.color === 'emerald' ? 'text-emerald-600' : 'text-amber-600'">{{ r.pct }}%</span>
                </div>
                <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div class="h-full rounded-full" [class]="r.color === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'" [style.width.%]="r.pct"></div>
                </div>
              </li>
            }
          </ul>
        </div>

        <div class="card p-5">
          <div class="flex items-center gap-2 mb-3">
            <lucide-icon [img]="trendIcon" [size]="16" class="text-blue-600" />
            <h3 class="text-sm font-semibold text-slate-900">Resumen del día</h3>
          </div>
          @if (summary(); as s) {
            <div class="space-y-3 text-xs">
              <div class="flex items-center justify-between"><span class="text-slate-600">Distancia recorrida</span><strong class="text-slate-900">{{ s.distancia }}</strong></div>
              <div class="flex items-center justify-between"><span class="text-slate-600">Entregas completadas</span><strong class="text-slate-900">{{ s.entregas }}</strong></div>
              <div class="flex items-center justify-between"><span class="text-slate-600">Combustible consumido</span><strong class="text-slate-900">{{ s.combustible }}</strong></div>
              <div class="flex items-center justify-between"><span class="text-slate-600">Incidencias resueltas</span><strong class="text-emerald-600">{{ s.resueltas }}</strong></div>
              <div class="divider"></div>
              <div class="flex items-center justify-between"><span class="text-slate-600">Eficiencia operativa</span><strong class="text-emerald-600">{{ s.eficiencia }}</strong></div>
            </div>
          }
        </div>
      </section>
    </div>

    @if (showAlertForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" (click)="closeAlertForm()">
        <div class="card w-full max-w-md p-5" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold">{{ editingAlertId() ? 'Editar alerta' : 'Nueva alerta IA' }}</h3>
            <button type="button" (click)="closeAlertForm()"><lucide-icon [img]="closeIcon" [size]="18" /></button>
          </div>
          <form class="space-y-3" (ngSubmit)="saveAlert($event)">
            <div><label class="input-label">Título</label><input class="input" [(ngModel)]="alertForm.titulo" name="titulo" required /></div>
            <div><label class="input-label">Descripción</label><textarea class="textarea" rows="3" [(ngModel)]="alertForm.descripcion" name="desc" required></textarea></div>
            <div><label class="input-label">Severidad</label>
              <select class="select" [(ngModel)]="alertForm.severidad" name="sev">
                <option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option>
              </select>
            </div>
            <div><label class="input-label">Placas afectadas (coma)</label><input class="input font-mono text-xs" [(ngModel)]="alertPlacas" name="placas" placeholder="ABC-123, XYZ-789" /></div>
            @if (alertError()) { <p class="text-xs text-red-600">{{ alertError() }}</p> }
            <button type="submit" class="w-full py-2.5 rounded-md bg-violet-600 text-white text-sm font-semibold" [disabled]="alertSaving()">
              {{ alertSaving() ? 'Guardando...' : 'Guardar alerta' }}
            </button>
          </form>
        </div>
      </div>
    }
  `
})
export class DashboardPageComponent implements OnInit, AfterViewInit {
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

  readonly showAlertForm = signal(false);
  readonly editingAlertId = signal<string | null>(null);
  readonly alertSaving = signal(false);
  readonly alertError = signal<string | null>(null);
  alertForm: AiAlertInput = { titulo: '', descripcion: '', severidad: 'medium' };
  alertPlacas = '';

  private map: L.Map | null = null;

  summary = this.dashboard.daySummary;

  ngOnInit(): void {
    this.layout.setPage('Dashboard', 'Centro de control · Operaciones en tiempo real');
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    await Promise.all([this.fleet.load(), this.dashboard.load(), this.aiAlerts.load()]);
    if (this.mapEl) {
      this.initMap();
    }
  }

  async refreshAlerts(): Promise<void> {
    await Promise.all([this.dashboard.load(), this.aiAlerts.load()]);
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

  ngAfterViewInit(): void {
    void this.fleet.load().then(() => {
      if (!this.map) this.initMap();
    });
    fromEvent(window, 'resize')
      .pipe(startWith(null), debounceTime(150), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.map?.invalidateSize());
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
    this.map = createOsmMap(this.mapEl.nativeElement, [-12.0464, -77.0428], 6);
    for (const v of this.fleet.vehicles()) {
      const m = L.marker([v.lat, v.lng], { icon: buildTruckIcon(v.estado) }).addTo(this.map);
      bindVehicleTooltip(m, v);
    }
    setTimeout(() => this.map?.invalidateSize(), 0);
  }
}
