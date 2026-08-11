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
import { Chart, registerables } from 'chart.js';
import * as L from 'leaflet';
import 'leaflet.heat';
import { fromEvent } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Brain,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Info,
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
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">

      <!-- ═══════════ ENCABEZADO ═══════════ -->
      <div class="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h2 class="text-[22px] font-bold text-slate-900 tracking-[-0.03em] leading-tight">Reportes predictivos</h2>
          <p class="text-[13px] text-slate-500 mt-1.5">Análisis territorial y tendencias de incidencias en Perú.</p>
        </div>
        <div class="flex items-center gap-2">
          <select class="select w-auto py-2 text-[12.5px] font-medium" [(ngModel)]="rango" name="rango">
            @for (r of rangos; track r) {
              <option [value]="r">{{ r }}</option>
            }
          </select>
          <button
            type="button"
            class="group inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0b1220] hover:bg-[#16233b]
                   text-white text-[12.5px] font-semibold transition-all active:scale-[0.98]
                   shadow-[0_1px_2px_rgba(11,18,32,0.25),0_6px_16px_-8px_rgba(11,18,32,0.5)]"
            (click)="exportPdf()"
          >
            <lucide-icon [img]="downloadIcon" [size]="14" class="transition-transform group-hover:translate-y-0.5" />
            Descargar PDF
          </button>
        </div>
      </div>

      <!-- ═══════════ KPIs ═══════════ -->
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        @for (k of kpis; track k.label; let i = $index) {
          <div class="kpi group fade-in-up" [style.animation-delay.ms]="i * 60">
            <div class="flex items-start justify-between">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center ring-1 transition-transform duration-200 group-hover:scale-105"
                   [class]="k.iconClass">
                <lucide-icon [img]="k.icon" [size]="18" [strokeWidth]="2" />
              </div>
              <span class="inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md" [class]="k.trendClass">
                @if (k.trendIcon) {
                  <lucide-icon [img]="k.trendIcon" [size]="11" />
                }
                {{ k.trend }}
              </span>
            </div>
            <div class="text-[26px] font-bold text-slate-900 tracking-[-0.03em] leading-none mt-3 tnum">{{ k.value }}</div>
            <div class="text-[12.5px] text-slate-500 font-medium mt-1">{{ k.label }}</div>
          </div>
        }
      </section>

      <!-- ═══════════ MAPA DE CALOR ═══════════ -->
      <section class="card mb-6 overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-red-50 text-red-600 ring-1 ring-red-100 flex items-center justify-center shrink-0">
              <lucide-icon [img]="alertIcon" [size]="17" />
            </div>
            <div>
              <h3 class="text-[15px] font-semibold text-slate-900 tracking-tight">Mapa de calor — Incidencias por territorio</h3>
              <p class="text-[12px] text-slate-500 mt-0.5">Concentración geográfica · {{ rango.toLowerCase() }}</p>
            </div>
          </div>

          <div class="flex items-center gap-2.5">
            <span class="text-[10.5px] font-medium text-slate-400 uppercase tracking-wider">Baja</span>
            <span class="w-28 h-2 rounded-full" style="background: linear-gradient(90deg,#3b82f6,#10b981,#f59e0b,#ef4444,#b91c1c)"></span>
            <span class="text-[10.5px] font-medium text-slate-400 uppercase tracking-wider">Alta</span>
          </div>
        </div>

        <div class="relative">
          <div #heatmapEl style="height: 480px"></div>
          <div class="absolute bottom-3 left-3 z-[400] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/90 backdrop-blur ring-1 ring-slate-200 shadow-sm">
            <lucide-icon [img]="infoIcon" [size]="12" class="text-slate-400" />
            <span class="text-[11px] font-medium text-slate-600">Ctrl + scroll para hacer zoom</span>
          </div>
        </div>
      </section>

      <!-- ═══════════ CHARTS ═══════════ -->
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

        <div class="lg:col-span-2 card p-5">
          <div class="flex items-start justify-between gap-3 mb-5">
            <div>
              <h3 class="text-[14px] font-semibold text-slate-900 tracking-tight">Incidencias por mes y categoría</h3>
              <p class="text-[12px] text-slate-500 mt-0.5">Distribución mensual apilada</p>
            </div>
            <span class="badge badge-info shrink-0">7 meses</span>
          </div>
          <div style="height: 320px"><canvas #barsCanvas></canvas></div>
        </div>

        <div class="card p-5">
          <div class="mb-5">
            <h3 class="text-[14px] font-semibold text-slate-900 tracking-tight">Distribución por tipo</h3>
            <p class="text-[12px] text-slate-500 mt-0.5">% del total</p>
          </div>
          <div style="height: 320px"><canvas #donutCanvas></canvas></div>
        </div>

        <div class="lg:col-span-3 card p-5">
          <div class="flex items-start justify-between gap-3 mb-5">
            <div>
              <h3 class="text-[14px] font-semibold text-slate-900 tracking-tight">Tendencia semanal</h3>
              <p class="text-[12px] text-slate-500 mt-0.5">Incidencias reportadas por semana</p>
            </div>
            <span class="badge badge-success shrink-0 inline-flex items-center gap-1">
              <lucide-icon [img]="trendDownIcon" [size]="11" />Descendente
            </span>
          </div>
          <div style="height: 240px"><canvas #trendCanvas></canvas></div>
        </div>
      </section>

      <!-- ═══════════ INSIGHTS IA ═══════════ -->
      <section class="mt-6 card overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200/80 flex items-center gap-3 bg-gradient-to-r from-violet-50/60 to-transparent">
          <div class="w-9 h-9 rounded-lg bg-violet-100 text-violet-600 ring-1 ring-violet-200/60 flex items-center justify-center shrink-0">
            <lucide-icon [img]="brainIcon" [size]="17" />
          </div>
          <div>
            <h3 class="text-[15px] font-semibold text-slate-900 tracking-tight">Insights del modelo predictivo</h3>
            <p class="text-[12px] text-slate-500 mt-0.5">Patrones detectados en los datos del último trimestre.</p>
          </div>
        </div>

        <ul class="divide-y divide-slate-100">
          @for (ins of insights; track ins.text) {
            <li class="flex items-start gap-3 px-5 py-4 hover:bg-slate-50/60 transition-colors">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ring-1 mt-0.5" [class]="ins.iconClass">
                <lucide-icon [img]="ins.icon" [size]="13" />
              </div>
              <p class="text-[13px] text-slate-600 leading-relaxed">{{ ins.text }}</p>
            </li>
          }
        </ul>
      </section>
    </div>
  `
})
export class ReportesPageComponent implements OnInit, AfterViewInit, OnDestroy {
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
  readonly infoIcon = Info;
  readonly arrowUpIcon = ArrowUpRight;
  readonly arrowDownIcon = ArrowDownRight;

  readonly rangos = ['Últimos 7 meses', 'Últimos 12 meses', 'Año actual'];
  rango = 'Últimos 7 meses';

  readonly kpis = [
    {
      label: 'Incidencias totales',
      value: '142',
      icon: AlertTriangle,
      iconClass: 'bg-blue-50 text-blue-600 ring-blue-100',
      trend: 'Mensual',
      trendIcon: null,
      trendClass: 'text-slate-600 bg-slate-100'
    },
    {
      label: 'Tasa de resolución',
      value: '87%',
      icon: CheckCircle2,
      iconClass: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
      trend: '8%',
      trendIcon: ArrowUpRight,
      trendClass: 'text-emerald-700 bg-emerald-50'
    },
    {
      label: 'Tiempo promedio',
      value: '2.4 h',
      icon: Clock,
      iconClass: 'bg-amber-50 text-amber-600 ring-amber-100',
      trend: '12%',
      trendIcon: ArrowDownRight,
      trendClass: 'text-emerald-700 bg-emerald-50'
    },
    {
      label: 'Precisión predictiva',
      value: '94.2%',
      icon: Sparkles,
      iconClass: 'bg-violet-50 text-violet-600 ring-violet-100',
      trend: 'IA',
      trendIcon: null,
      trendClass: 'text-violet-700 bg-violet-50'
    }
  ];

  readonly insights = [
    {
      icon: Check,
      iconClass: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
      text: 'Las incidencias mecánicas se concentran en unidades con más de 150,000 km. Recomendado adelantar mantenimiento preventivo.'
    },
    {
      icon: AlertTriangle,
      iconClass: 'bg-amber-50 text-amber-600 ring-amber-100',
      text: 'El corredor Lima → Huancayo concentra el 23% de incidencias graves. Considerar rutas alternas en horario nocturno.'
    },
    {
      icon: TrendingDown,
      iconClass: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
      text: 'Tendencia general descendente del 12% en tiempo de respuesta gracias al despacho automatizado.'
    }
  ];

  private map: L.Map | null = null;
  private charts: Chart[] = [];

  ngOnInit(): void {
    this.layout.setPage('Reportes Predictivos', 'Análisis y mapas de calor de incidencias');
  }

  async ngAfterViewInit(): Promise<void> {
    await this.reports.load();
    this.initHeatmap();
    this.initCharts();
    fromEvent(window, 'resize')
      .pipe(startWith(null), debounceTime(150), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.map?.invalidateSize());
  }

  ngOnDestroy(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
    this.map?.remove();
    this.map = null;
  }

  exportPdf(): void {
    window.print();
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
    const tooltipStyle = {
      backgroundColor: '#0b1220',
      titleFont: { size: 12, weight: 600 as const },
      bodyFont: { size: 12 },
      padding: 10,
      cornerRadius: 8,
      boxPadding: 4,
      displayColors: true
    };

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
          animation: { duration: 700 },
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: { stacked: true, grid: { display: false }, border: { display: false }, ticks: { color: COLORS.slate500, font: { size: 11 } } },
            y: {
              stacked: true,
              grid: { color: COLORS.slate200 },
              border: { display: false },
              ticks: { color: COLORS.slate500, font: { size: 11 }, padding: 8 }
            }
          },
          plugins: {
            tooltip: tooltipStyle,
            legend: {
              position: 'bottom',
              labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', font: { size: 11 }, color: COLORS.slate500, padding: 16 }
            }
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
          datasets: [
            {
              data: donut.data,
              backgroundColor: [COLORS.blue, COLORS.blueLight, COLORS.red, COLORS.amber, COLORS.green],
              borderWidth: 3,
              borderColor: '#fff',
              hoverOffset: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          animation: { duration: 700 },
          plugins: {
            tooltip: tooltipStyle,
            legend: {
              position: 'bottom',
              labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', font: { size: 11 }, color: COLORS.slate500, padding: 14 }
            }
          }
        }
      })
    );

    const trend = this.reports.chartTrend();
    this.charts.push(
      new Chart(this.trendCanvas.nativeElement, {
        type: 'line',
        data: {
          labels: trend.labels,
          datasets: [
            {
              label: 'Incidencias',
              data: trend.data,
              borderColor: COLORS.blueLight,
              backgroundColor: 'rgba(59,130,246,0.10)',
              borderWidth: 2.5,
              fill: true,
              tension: 0.4,
              pointRadius: 0,
              pointHoverRadius: 6,
              pointBackgroundColor: COLORS.blueLight,
              pointBorderColor: '#fff',
              pointBorderWidth: 2.5
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 700 },
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: { grid: { display: false }, border: { display: false }, ticks: { color: COLORS.slate500, font: { size: 11 } } },
            y: {
              grid: { color: COLORS.slate200 },
              border: { display: false },
              ticks: { color: COLORS.slate500, font: { size: 11 }, padding: 8 }
            }
          },
          plugins: { tooltip: tooltipStyle, legend: { display: false } }
        }
      })
    );
  }
}
