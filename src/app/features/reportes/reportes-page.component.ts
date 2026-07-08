import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Chart, registerables } from 'chart.js';
import * as L from 'leaflet';
import 'leaflet.heat';
import { fromEvent } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import {
  AlertTriangle,
  Brain,
  Check,
  CheckCircle2,
  Clock,
  Download,
  LucideAngularModule,
  Sparkles,
  TrendingDown
} from 'lucide-angular';
import { LayoutService } from '../../core/services/layout.service';
import { ReportsService } from '../../core/services/reports.service';
import { createOsmMap } from '../../core/utils/map.utils';

Chart.register(...registerables);

const COLORS = {
  blue: '#1e3a8a',
  blueLight: '#3b82f6',
  amber: '#f59e0b',
  red: '#dc2626',
  green: '#10b981',
  slate200: '#e2e8f0',
  slate500: '#64748b'
};

@Component({
  standalone: true,
  selector: 'app-reportes-page',
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="p-4 sm:p-6 lg:p-8">
      <div class="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 class="text-lg sm:text-xl font-bold text-slate-900">Reportes predictivos</h2>
          <p class="text-xs text-slate-500 mt-1">Análisis territorial y tendencias de incidencias en Perú.</p>
        </div>
        <div class="flex items-center gap-2">
          <select class="select w-auto py-2 text-xs">
            <option>Últimos 7 meses</option>
            <option>Últimos 12 meses</option>
            <option>Año actual</option>
          </select>
          <button type="button" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition">
            <lucide-icon [img]="downloadIcon" [size]="14" />Descargar PDF
          </button>
        </div>
      </div>

      <section class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div class="kpi">
          <div class="flex items-center justify-between">
            <div class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <lucide-icon [img]="alertIcon" [size]="18" />
            </div>
            <span class="text-[11px] font-semibold text-slate-500">Mensual</span>
          </div>
          <div class="text-2xl font-bold text-slate-900">142</div>
          <div class="text-xs text-slate-500">Incidencias totales</div>
        </div>
        <div class="kpi">
          <div class="flex items-center justify-between">
            <div class="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <lucide-icon [img]="checkCircleIcon" [size]="18" />
            </div>
            <span class="text-[11px] font-semibold text-emerald-600">+8%</span>
          </div>
          <div class="text-2xl font-bold text-slate-900">87%</div>
          <div class="text-xs text-slate-500">Tasa de resolución</div>
        </div>
        <div class="kpi">
          <div class="flex items-center justify-between">
            <div class="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <lucide-icon [img]="clockIcon" [size]="18" />
            </div>
            <span class="text-[11px] font-semibold text-emerald-600">-12%</span>
          </div>
          <div class="text-2xl font-bold text-slate-900">2.4 h</div>
          <div class="text-xs text-slate-500">Tiempo promedio</div>
        </div>
        <div class="kpi">
          <div class="flex items-center justify-between">
            <div class="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
              <lucide-icon [img]="sparklesIcon" [size]="18" />
            </div>
            <span class="text-[11px] font-semibold text-violet-600">IA</span>
          </div>
          <div class="text-2xl font-bold text-slate-900">94.2%</div>
          <div class="text-xs text-slate-500">Precisión predictiva</div>
        </div>
      </section>

      <section class="card mb-6 overflow-hidden">
        <div class="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 class="text-sm font-semibold text-slate-900">Mapa de calor — Incidencias por territorio</h3>
            <p class="text-xs text-slate-500 mt-0.5">Concentración geográfica · últimos 7 meses</p>
          </div>
        </div>
        <div #heatmapEl style="height: 480px"></div>
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div class="lg:col-span-2 card p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-sm font-semibold text-slate-900">Incidencias por mes y categoría</h3>
              <p class="text-xs text-slate-500 mt-0.5">Distribución mensual apilada</p>
            </div>
            <span class="badge badge-info">7 meses</span>
          </div>
          <div style="height: 320px"><canvas #barsCanvas></canvas></div>
        </div>
        <div class="card p-5">
          <div class="mb-4">
            <h3 class="text-sm font-semibold text-slate-900">Distribución por tipo</h3>
            <p class="text-xs text-slate-500 mt-0.5">% del total</p>
          </div>
          <div style="height: 320px"><canvas #donutCanvas></canvas></div>
        </div>
        <div class="lg:col-span-3 card p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-sm font-semibold text-slate-900">Tendencia semanal</h3>
              <p class="text-xs text-slate-500 mt-0.5">Incidencias reportadas por semana</p>
            </div>
            <span class="badge badge-success">Tendencia descendente</span>
          </div>
          <div style="height: 240px"><canvas #trendCanvas></canvas></div>
        </div>
      </section>

      <section class="mt-6 card p-5">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
            <lucide-icon [img]="brainIcon" [size]="18" />
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-slate-900 mb-1">Insights del modelo predictivo</h3>
            <p class="text-xs text-slate-500 mb-3">Patrones detectados en los datos del último trimestre.</p>
            <ul class="space-y-2 text-sm text-slate-700">
              <li class="flex items-start gap-2">
                <lucide-icon [img]="checkIcon" [size]="14" class="text-emerald-600 mt-0.5 shrink-0" />
                Las incidencias mecánicas se concentran en unidades con más de 150,000 km. Recomendado adelantar mantenimiento preventivo.
              </li>
              <li class="flex items-start gap-2">
                <lucide-icon [img]="alertIcon" [size]="14" class="text-amber-600 mt-0.5 shrink-0" />
                El corredor Lima → Huancayo concentra el 23% de incidencias graves. Considerar rutas alternas en horario nocturno.
              </li>
              <li class="flex items-start gap-2">
                <lucide-icon [img]="trendDownIcon" [size]="14" class="text-emerald-600 mt-0.5 shrink-0" />
                Tendencia general descendente del 12% en tiempo de respuesta gracias al despacho automatizado.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  `
})
export class ReportesPageComponent implements OnInit, AfterViewInit {
  private readonly reports = inject(ReportsService);
  private readonly layout = inject(LayoutService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('heatmapEl') heatmapEl!: ElementRef<HTMLDivElement>;
  @ViewChild('barsCanvas') barsCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('donutCanvas') donutCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendCanvas') trendCanvas!: ElementRef<HTMLCanvasElement>;

  readonly downloadIcon = Download;
  readonly alertIcon = AlertTriangle;
  readonly checkCircleIcon = CheckCircle2;
  readonly clockIcon = Clock;
  readonly sparklesIcon = Sparkles;
  readonly brainIcon = Brain;
  readonly checkIcon = Check;
  readonly trendDownIcon = TrendingDown;

  private map: L.Map | null = null;
  private charts: Chart[] = [];

  ngOnInit(): void {
    this.layout.setPage('Reportes Predictivos', 'Análisis y mapas de calor de incidencias');
    void this.reports.load();
  }

  async ngAfterViewInit(): Promise<void> {
    await this.reports.load();
    this.initHeatmap();
    this.initCharts();
    fromEvent(window, 'resize')
      .pipe(startWith(null), debounceTime(150), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.map?.invalidateSize());
  }

  private initHeatmap(): void {
    this.map = createOsmMap(this.heatmapEl.nativeElement, [-9.19, -75.0], 5);
    this.map.scrollWheelZoom.disable();

    L.heatLayer(this.reports.heatmap(), {
      radius: 28,
      blur: 22,
      minOpacity: 0.35,
      maxZoom: 11,
      gradient: { 0.2: '#3b82f6', 0.4: '#10b981', 0.6: '#f59e0b', 0.85: '#ef4444', 1.0: '#b91c1c' }
    }).addTo(this.map);

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private initCharts(): void {
    const bars = this.reports.chartBars();
    const palette = [COLORS.blue, COLORS.blueLight, COLORS.amber, COLORS.red];

    this.charts.push(
      new Chart(this.barsCanvas.nativeElement, {
        type: 'bar',
        data: {
          labels: bars.labels,
          datasets: bars.datasets.map((d, i) => ({
            label: d.label,
            data: d.data,
            backgroundColor: palette[i] || COLORS.slate500,
            borderRadius: 6,
            barPercentage: 0.7,
            categoryPercentage: 0.65
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true, grid: { display: false }, ticks: { color: COLORS.slate500, font: { size: 11 } } },
            y: { stacked: true, grid: { color: COLORS.slate200 }, ticks: { color: COLORS.slate500, font: { size: 11 } } }
          },
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, font: { size: 11 }, color: COLORS.slate500, padding: 14 } }
          }
        }
      })
    );

    const donut = this.reports.chartDonut();
    this.charts.push(
      new Chart(this.donutCanvas.nativeElement, {
        type: 'doughnut',
        data: {
          labels: donut.labels,
          datasets: [{
            data: donut.data,
            backgroundColor: [COLORS.blue, COLORS.blueLight, COLORS.red, COLORS.amber, COLORS.green],
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, font: { size: 11 }, color: COLORS.slate500, padding: 12 } } }
        }
      })
    );

    const trend = this.reports.chartTrend();
    this.charts.push(
      new Chart(this.trendCanvas.nativeElement, {
        type: 'line',
        data: {
          labels: trend.labels,
          datasets: [{
            label: 'Incidencias',
            data: trend.data,
            borderColor: COLORS.blueLight,
            backgroundColor: 'rgba(59,130,246,0.12)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: COLORS.blueLight,
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { grid: { display: false }, ticks: { color: COLORS.slate500, font: { size: 11 } } },
            y: { grid: { color: COLORS.slate200 }, ticks: { color: COLORS.slate500, font: { size: 11 } } }
          },
          plugins: { legend: { display: false } }
        }
      })
    );
  }
}
