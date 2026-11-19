import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertCircle, Download, FileSpreadsheet, FileText, Loader2, LucideAngularModule, RefreshCw } from 'lucide-angular';

import { ApiService } from '../../core/api/api.service';
import { apiErrorMessage } from '../../core/utils/api-error.util';

function hoyLima(offsetDias = 0): string {
  const d = new Date(Date.now() - 5 * 3600_000 + offsetDias * 86_400_000);
  return d.toISOString().slice(0, 10);
}

interface Seguridad {
  fecha: string;
  generado: string;
  resumen: {
    eventos: number;
    alertas: number;
    alertasAltas: number;
    alertasMedias: number;
    alertasBajas: number;
    alertasAtendidas: number;
    incidencias: number;
    panico: number;
    unidades: number;
    simulados: number;
  };
  porTipo: { tipo: string; label: string; cantidad: number }[];
  eventos: { hora: string; placa: string; tipo: string; label: string; severidad: string; descripcion: string; simulado: boolean }[];
  alertas: { hora: string; placa: string; titulo: string; severidad: string; estado: string; acciones: number }[];
  incidencias: { hora: string; id: string; placa: string; titulo: string; severidad: string; estado: string }[];
}

interface Rutas {
  desde: string;
  hasta: string;
  generado: string;
  precioGalon: number;
  precioReferencial: boolean;
  resumen: { rutas: number; km: number; horas: number; puntualidad: number | null; minAhorrados: number; galones: number; costo: number; galonesPorDesvio: number };
  rutas: {
    fecha: string;
    placa: string;
    conductor: string;
    origen: string;
    destino: string;
    distanciaKm: number;
    recorridoKm: number | null;
    kmExtra: number | null;
    estimadoMin: number | null;
    realMin: number | null;
    difMin: number | null;
    puntual: boolean;
    galones: number;
    costo: number;
  }[];
}

const SEV: Record<string, string> = {
  alta: 'bg-red-50 text-red-700 ring-red-200',
  high: 'bg-red-50 text-red-700 ring-red-200',
  media: 'bg-amber-50 text-amber-700 ring-amber-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  baja: 'bg-slate-50 text-slate-600 ring-slate-200',
  low: 'bg-slate-50 text-slate-600 ring-slate-200'
};

/** CP008 (informe de seguridad del día) y CP025 (desempeño de rutas). */
@Component({
  standalone: true,
  selector: 'app-informe',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <section class="card p-5 sm:p-6">
      <div class="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h3 class="text-[16px] font-semibold text-slate-900">{{ tipo === 'seguridad' ? 'Informe de seguridad del día' : 'Desempeño de rutas optimizadas' }}</h3>
          <p class="text-[12.5px] text-slate-500 mt-1 max-w-2xl">
            @if (tipo === 'seguridad') {
              Todos los eventos del día: desvíos, manipulaciones del GPS, pérdidas de señal, excesos de velocidad, alertas e incidencias, con lo que se hizo en cada una.
            } @else {
              Rutas completadas en el periodo: tiempo estimado frente al real, puntualidad, kilómetros recorridos y combustible estimado.
            }
          </p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          @if (tipo === 'seguridad') {
            <div>
              <label class="input-label" for="inf-fecha">Día</label>
              <input id="inf-fecha" type="date" class="input h-10 py-0" [max]="hoy" [(ngModel)]="fecha" (change)="cargar()" />
            </div>
          } @else {
            <div>
              <label class="input-label" for="inf-desde">Desde</label>
              <input id="inf-desde" type="date" class="input h-10 py-0" [max]="hasta" [(ngModel)]="desde" (change)="cargar()" />
            </div>
            <div>
              <label class="input-label" for="inf-hasta">Hasta</label>
              <input id="inf-hasta" type="date" class="input h-10 py-0" [min]="desde" [max]="hoy" [(ngModel)]="hasta" (change)="cargar()" />
            </div>
          }
          <button type="button" class="dl-btn ghost" (click)="cargar()" [disabled]="cargando()" aria-label="Actualizar"><lucide-icon [img]="refreshIcon" [size]="14" [class.animate-spin]="cargando()" /></button>
          <button type="button" class="dl-btn dark" (click)="descargar('pdf')" [disabled]="!!descargando()">
            <lucide-icon [img]="descargando() === 'pdf' ? loaderIcon : pdfIcon" [size]="14" [class.animate-spin]="descargando() === 'pdf'" />PDF
          </button>
          <button type="button" class="dl-btn green" (click)="descargar('xlsx')" [disabled]="!!descargando()">
            <lucide-icon [img]="descargando() === 'xlsx' ? loaderIcon : xlsIcon" [size]="14" [class.animate-spin]="descargando() === 'xlsx'" />Excel
          </button>
        </div>
      </div>

      @if (error()) {
        <div class="flex items-start gap-2 p-3 mb-4 rounded-lg bg-red-50 ring-1 ring-red-200 text-red-700" role="alert">
          <lucide-icon [img]="alertIcon" [size]="14" class="mt-0.5 shrink-0" /><p class="text-[12.5px]">{{ error() }}</p>
        </div>
      }

      @if (tipo === 'seguridad' && seg(); as s) {
        <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
          <div class="mini"><p class="mini-v">{{ s.resumen.eventos }}</p><p class="mini-l">Eventos de seguridad</p></div>
          <div class="mini"><p class="mini-v">{{ s.resumen.alertas }} <span class="text-[13px] text-red-600">({{ s.resumen.alertasAltas }} altas)</span></p><p class="mini-l">Alertas</p></div>
          <div class="mini"><p class="mini-v">{{ s.resumen.alertasAtendidas }}/{{ s.resumen.alertas }}</p><p class="mini-l">Alertas atendidas</p></div>
          <div class="mini"><p class="mini-v">{{ s.resumen.incidencias }}</p><p class="mini-l">Incidencias</p></div>
          <div class="mini"><p class="mini-v">{{ s.resumen.panico }}</p><p class="mini-l">Botón de pánico</p></div>
          <div class="mini"><p class="mini-v">{{ s.resumen.unidades }}</p><p class="mini-l">Unidades involucradas</p></div>
        </div>
        <div class="flex flex-wrap gap-2 mb-5">
          @for (t of s.porTipo; track t.tipo) {
            <span class="px-2.5 py-1 rounded-full text-[12px] ring-1" [class]="t.cantidad ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-400 ring-slate-200'">{{ t.label }}: <strong>{{ t.cantidad }}</strong></span>
          }
        </div>

        <h4 class="sub">Eventos del día</h4>
        <div class="overflow-x-auto mb-5">
          <table class="tbl">
            <thead><tr><th>Hora</th><th>Placa</th><th>Evento</th><th>Severidad</th><th>Detalle</th></tr></thead>
            <tbody>
              @for (e of s.eventos; track $index) {
                <tr>
                  <td class="tnum">{{ e.hora }}</td><td class="font-semibold">{{ e.placa }}</td><td>{{ e.label }}</td>
                  <td><span class="sev" [class]="sev(e.severidad)">{{ e.severidad }}</span></td>
                  <td class="text-slate-600">{{ e.descripcion }} @if (e.simulado) { <span class="text-[10.5px] text-violet-600 font-semibold">PRUEBA</span> }</td>
                </tr>
              } @empty { <tr><td colspan="5" class="empty">Sin eventos de seguridad este día.</td></tr> }
            </tbody>
          </table>
        </div>

        <h4 class="sub">Alertas y respuesta</h4>
        <div class="overflow-x-auto mb-5">
          <table class="tbl">
            <thead><tr><th>Hora</th><th>Placa</th><th>Alerta</th><th>Severidad</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              @for (a of s.alertas; track $index) {
                <tr><td class="tnum">{{ a.hora }}</td><td class="font-semibold">{{ a.placa }}</td><td>{{ a.titulo }}</td>
                  <td><span class="sev" [class]="sev(a.severidad)">{{ a.severidad }}</span></td><td>{{ a.estado }}</td><td class="tnum">{{ a.acciones }}</td></tr>
              } @empty { <tr><td colspan="6" class="empty">Sin alertas este día.</td></tr> }
            </tbody>
          </table>
        </div>

        <h4 class="sub">Incidencias</h4>
        <div class="overflow-x-auto">
          <table class="tbl">
            <thead><tr><th>Hora</th><th>Código</th><th>Placa</th><th>Incidencia</th><th>Severidad</th><th>Estado</th></tr></thead>
            <tbody>
              @for (i of s.incidencias; track i.id) {
                <tr><td class="tnum">{{ i.hora }}</td><td class="font-mono text-[11.5px]">{{ i.id }}</td><td class="font-semibold">{{ i.placa }}</td><td>{{ i.titulo }}</td>
                  <td><span class="sev" [class]="sev(i.severidad)">{{ i.severidad }}</span></td><td>{{ i.estado }}</td></tr>
              } @empty { <tr><td colspan="6" class="empty">Sin incidencias este día.</td></tr> }
            </tbody>
          </table>
        </div>
        <p class="text-[11px] text-slate-400 mt-4">Generado el {{ s.generado }} (hora de Lima). Los eventos marcados PRUEBA vienen de la unidad simulada SIM-001.</p>
      }

      @if (tipo === 'rutas' && rut(); as r) {
        <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
          <div class="mini"><p class="mini-v">{{ r.resumen.rutas }}</p><p class="mini-l">Rutas completadas</p></div>
          <div class="mini"><p class="mini-v">{{ r.resumen.km | number: '1.0-1' }}</p><p class="mini-l">Kilómetros</p></div>
          <div class="mini"><p class="mini-v">{{ r.resumen.horas | number: '1.0-1' }}</p><p class="mini-l">Horas de viaje</p></div>
          <div class="mini"><p class="mini-v">{{ r.resumen.puntualidad === null ? '—' : r.resumen.puntualidad + ' %' }}</p><p class="mini-l">Llegadas a tiempo</p></div>
          <div class="mini"><p class="mini-v">{{ r.resumen.minAhorrados }}</p><p class="mini-l">Min ahorrados vs. estimado</p></div>
          <div class="mini"><p class="mini-v">{{ r.resumen.galones | number: '1.0-1' }} gal</p><p class="mini-l">S/ {{ r.resumen.costo | number: '1.2-2' }} en combustible</p></div>
        </div>
        <div class="overflow-x-auto">
          <table class="tbl">
            <thead><tr><th>Llegada</th><th>Placa</th><th>Ruta</th><th class="r">Km plan</th><th class="r">Km GPS</th><th class="r">Estimado</th><th class="r">Real</th><th class="r">Dif.</th><th>A tiempo</th><th class="r">Galones</th><th class="r">Costo S/</th></tr></thead>
            <tbody>
              @for (f of r.rutas; track $index) {
                <tr>
                  <td class="tnum whitespace-nowrap">{{ f.fecha }}</td><td class="font-semibold">{{ f.placa }}</td>
                  <td>{{ f.origen }} → {{ f.destino }}<span class="block text-[11px] text-slate-400">{{ f.conductor }}</span></td>
                  <td class="r tnum">{{ f.distanciaKm | number: '1.0-1' }}</td>
                  <td class="r tnum">{{ f.recorridoKm === null ? '—' : (f.recorridoKm | number: '1.0-1') }}</td>
                  <td class="r tnum">{{ f.estimadoMin ?? '—' }} min</td>
                  <td class="r tnum">{{ f.realMin ?? '—' }} min</td>
                  <td class="r tnum" [class]="(f.difMin ?? 0) > 0 ? 'text-amber-700' : 'text-emerald-700'">{{ f.difMin === null ? '—' : ((f.difMin > 0 ? '+' : '') + f.difMin) }}</td>
                  <td><span class="sev" [class]="f.puntual ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'">{{ f.puntual ? 'Sí' : 'No' }}</span></td>
                  <td class="r tnum">{{ f.galones | number: '1.1-1' }}</td>
                  <td class="r tnum">{{ f.costo | number: '1.2-2' }}</td>
                </tr>
              } @empty { <tr><td colspan="11" class="empty">No hay rutas completadas en este periodo.</td></tr> }
            </tbody>
          </table>
        </div>
        <p class="text-[11px] text-slate-400 mt-4 leading-relaxed">
          Combustible estimado con el rendimiento de cada unidad y S/ {{ r.precioGalon | number: '1.2-2' }} por galón
          {{ r.precioReferencial ? '(precio referencial: aún no hay vales de combustible)' : '(promedio de los vales registrados en Consumo)' }}.
          «A tiempo»: llegó en el tiempo estimado o hasta 10 % más. Km GPS: distancia medida con las posiciones del viaje.
        </p>
      }

      @if (cargando() && !seg() && !rut()) {
        <div class="space-y-2" role="status" aria-label="Cargando">@for (n of [1, 2, 3, 4]; track n) { <span class="skeleton h-9 w-full block"></span> }</div>
      }
    </section>
  `,
  styles: [
    `
      .mini { border-radius: 12px; padding: 12px 14px; box-shadow: 0 0 0 1px #e2e8f0 inset; background: #fff; }
      .mini-v { font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; }
      .mini-l { font-size: 11.5px; color: #64748b; margin-top: 2px; }
      .sub { font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 8px; }
      .tbl { width: 100%; font-size: 12.5px; border-collapse: collapse; min-width: 640px; }
      .tbl th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; padding: 8px 10px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
      .tbl td { padding: 9px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; color: #0f172a; }
      .tbl .r { text-align: right; }
      .tbl .empty { text-align: center; color: #94a3b8; padding: 22px; }
      .sev { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; box-shadow: 0 0 0 1px currentColor inset; }
      .dl-btn { display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 14px; border-radius: 9px; font-size: 12.5px; font-weight: 600; transition: all .15s; }
      .dl-btn.dark { background: #0b1220; color: #fff; }
      .dl-btn.green { background: #047857; color: #fff; }
      .dl-btn.ghost { box-shadow: 0 0 0 1px #e2e8f0 inset; color: #334155; padding: 0 12px; }
      .dl-btn:disabled { opacity: .5; cursor: not-allowed; }
    `
  ]
})
export class InformeComponent implements OnInit {
  @Input({ required: true }) tipo!: 'seguridad' | 'rutas';
  private readonly api = inject(ApiService);

  readonly pdfIcon = FileText;
  readonly xlsIcon = FileSpreadsheet;
  readonly loaderIcon = Loader2;
  readonly alertIcon = AlertCircle;
  readonly refreshIcon = RefreshCw;
  readonly downloadIcon = Download;

  readonly hoy = hoyLima();
  fecha = hoyLima();
  desde = hoyLima(-29);
  hasta = hoyLima();

  readonly seg = signal<Seguridad | null>(null);
  readonly rut = signal<Rutas | null>(null);
  readonly cargando = signal(false);
  readonly descargando = signal<'pdf' | 'xlsx' | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.cargar();
  }

  sev(s: string): string {
    return SEV[s] ?? SEV['baja'];
  }

  private query(formato: string): string {
    return this.tipo === 'seguridad'
      ? `/reportes/seguridad?fecha=${this.fecha}&formato=${formato}`
      : `/reportes/rutas?desde=${this.desde}&hasta=${this.hasta}&formato=${formato}`;
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      if (this.tipo === 'seguridad') this.seg.set(await this.api.get<Seguridad>(this.query('json')));
      else this.rut.set(await this.api.get<Rutas>(this.query('json')));
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo generar el informe'));
    } finally {
      this.cargando.set(false);
    }
  }

  async descargar(formato: 'pdf' | 'xlsx'): Promise<void> {
    this.descargando.set(formato);
    this.error.set(null);
    try {
      await this.api.download(this.query(formato), `informe-${this.tipo}.${formato}`);
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo descargar el archivo'));
    } finally {
      this.descargando.set(null);
    }
  }
}
