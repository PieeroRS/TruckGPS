import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  FlaskConical,
  History,
  LucideAngularModule,
  MapPin,
  Route,
  ShieldAlert,
  Siren,
  Sparkles,
  WifiOff,
  Zap
} from 'lucide-angular';

import { AuthService } from '../../auth/auth.service';
import { AiAlert, AlertAction } from '../models/dashboard.model';
import { AiAlertsService } from '../services/ai-alerts.service';

type LucideIcon = typeof Activity;

const ICONS: Record<string, LucideIcon> = {
  route: Route,
  'shield-alert': ShieldAlert,
  'wifi-off': WifiOff,
  'map-pin': MapPin,
  siren: Siren,
  'alert-triangle': AlertTriangle,
  sparkles: Sparkles
};

const TIPO_LABEL: Record<string, string> = {
  manual: 'Manual',
  desvio: 'Desvío de ruta',
  spoofing: 'GPS spoofing',
  jamming: 'GPS jamming',
  salida_zona: 'Salida de zona',
  parada_riesgo: 'Parada en zona de riesgo',
  trafico: 'Tráfico',
  sabotaje: 'Sabotaje'
};

/** Acciones que también puede ejecutar un conductor (el resto es de supervisión). */
const DRIVER_ACTIONS = new Set(['atender', 'contactar_conductor', 'ver_mapa']);

/** Tarjeta de alerta con estado, acciones de respuesta ejecutables e historial. */
@Component({
  selector: 'app-alert-card',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    @let a = alert();
    <article class="ai-alert severity-{{ a.severidad }} group">
      <div class="flex items-start gap-2.5">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ring-1" [class]="sevIconClass()">
          <lucide-icon [img]="icon()" [size]="14" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <h4 class="text-[13.5px] font-semibold text-slate-900 leading-snug tracking-tight">{{ a.titulo }}</h4>
            <span class="badge shrink-0" [class]="sevBadge()">{{ sevLabel() }}</span>
          </div>

          <div class="flex flex-wrap items-center gap-1 mt-1.5">
            @if (a.tipo && a.tipo !== 'manual') {
              <span class="px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-slate-100 text-slate-600 ring-1 ring-slate-200/70">{{ tipoLabel() }}</span>
            }
            <span class="px-1.5 py-0.5 rounded text-[10.5px] font-medium ring-1" [class]="estadoClass()">{{ estadoLabel() }}</span>
            @if (a.origen === 'simulacion') {
              <span class="px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-violet-50 text-violet-700 ring-1 ring-violet-200 inline-flex items-center gap-1">
                <lucide-icon [img]="flaskIcon" [size]="10" />Prueba
              </span>
            }
            @for (p of a.afecta; track p) {
              <span class="px-1.5 py-0.5 rounded text-[10.5px] font-mono font-medium bg-slate-100 text-slate-600 ring-1 ring-slate-200/70">{{ p }}</span>
            }
          </div>

          <p class="text-[12.5px] text-slate-600 mt-1.5 leading-relaxed">{{ a.descripcion }}</p>

          @if (a.payload?.factores?.length) {
            <ul class="mt-2 space-y-1">
              @for (f of a.payload!.factores!; track f.tipo) {
                <li class="flex items-center justify-between text-[11.5px] text-slate-600">
                  <span>{{ f.cantidad }} × {{ f.label }}</span>
                  <span class="tnum font-semibold text-slate-800">+{{ f.puntos }}</span>
                </li>
              }
              <li class="flex items-center justify-between text-[11.5px] pt-1 border-t border-slate-100">
                <span class="text-slate-500">Puntaje (umbral {{ a.payload!.umbral }})</span>
                <span class="tnum font-bold text-red-600">{{ a.payload!.puntaje }}/100</span>
              </li>
            </ul>
          }

          @if (a.tipo === 'trafico' && a.payload?.alternativa) {
            <div class="mt-2 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 px-2.5 py-2 text-[11.5px] text-emerald-800">
              Alternativa: <strong>{{ a.payload!.alternativa!.distance_km }} km</strong> ·
              ~{{ round(a.payload!.alternativa!.duration_traffic_min) }} min con tráfico ·
              ahorra <strong>~{{ round(a.payload!.alternativa!.ahorro_min) }} min</strong>
            </div>
          }

          @if (acciones().length) {
            <div class="flex flex-wrap gap-1.5 mt-2.5">
              @for (ac of acciones(); track ac.codigo; let i = $index) {
                <button
                  type="button"
                  [title]="ac.descripcion"
                  [disabled]="busy() !== null || ac.ejecutada"
                  (click)="run(ac)"
                  class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                  [class]="i === 0 ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'"
                >
                  @if (busy() === ac.codigo) {
                    <span class="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
                  } @else if (ac.ejecutada) {
                    <lucide-icon [img]="checkIcon" [size]="12" />
                  } @else if (i === 0) {
                    <lucide-icon [img]="zapIcon" [size]="12" />
                  }
                  {{ ac.label }}
                </button>
              }
            </div>
          }

          @if (secundarias().length) {
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
              @for (ac of secundarias(); track ac.codigo) {
                <button
                  type="button"
                  [title]="ac.descripcion"
                  [disabled]="busy() !== null"
                  (click)="run(ac)"
                  class="text-[11px] font-semibold transition disabled:opacity-50"
                  [class]="ac.codigo === 'descartar' ? 'text-amber-600 hover:text-amber-700' : ac.codigo === 'resolver' ? 'text-emerald-600 hover:text-emerald-700' : 'text-slate-500 hover:text-slate-900'"
                >
                  {{ ac.label }}
                </button>
              }
            </div>
          }

          @if (mensaje()) {
            <p class="mt-2 text-[11.5px] leading-snug" [class]="error() ? 'text-red-600' : 'text-emerald-700'">{{ mensaje() }}</p>
          }

          <div class="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-100">
            <span class="flex items-center gap-1 text-[11px] text-slate-400">
              <lucide-icon [img]="clockIcon" [size]="11" />{{ a.tiempo }}
            </span>
            <div class="flex items-center gap-2.5">
              @if (a.historial?.length) {
                <button type="button" class="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900" (click)="showHistory.set(!showHistory())">
                  <lucide-icon [img]="historyIcon" [size]="11" />Historial ({{ a.historial!.length }})
                  <lucide-icon [img]="chevronIcon" [size]="11" class="transition-transform" [class.rotate-180]="showHistory()" />
                </button>
              }
              @if (staff() && a.tipo === 'manual') {
                <button type="button" class="text-[11px] font-semibold text-slate-500 hover:text-slate-900" (click)="edit.emit(a)">Editar</button>
                <button type="button" class="text-[11px] font-semibold text-red-500 hover:text-red-700" (click)="remove.emit(a)">Eliminar</button>
              }
            </div>
          </div>

          @if (showHistory() && a.historial?.length) {
            <ol class="mt-2 space-y-1.5 border-l-2 border-slate-200 pl-3">
              @for (h of a.historial!; track $index) {
                <li class="text-[11.5px] leading-snug">
                  <span class="font-semibold text-slate-800">{{ h.label }}</span>
                  <span class="text-slate-400"> · {{ fecha(h.fecha) }} · {{ h.usuario }}</span>
                  <p class="text-slate-600">{{ h.resultado }}</p>
                  @if (h.nota) {
                    <p class="text-slate-500 italic">“{{ h.nota }}”</p>
                  }
                </li>
              }
            </ol>
          }
        </div>
      </div>
    </article>
  `
})
export class AlertCardComponent {
  private readonly alerts = inject(AiAlertsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly alert = input.required<AiAlert>();
  /** Se emite tras ejecutar una acción, para que la página recargue lo que necesite. */
  readonly changed = output<AiAlert>();
  readonly edit = output<AiAlert>();
  readonly remove = output<AiAlert>();

  readonly busy = signal<string | null>(null);
  readonly mensaje = signal<string | null>(null);
  readonly error = signal(false);
  readonly showHistory = signal(false);

  readonly clockIcon = Clock;
  readonly checkIcon = CheckCircle2;
  readonly zapIcon = Zap;
  readonly historyIcon = History;
  readonly chevronIcon = ChevronDown;
  readonly flaskIcon = FlaskConical;

  readonly staff = computed(() => this.auth.isStaff());
  private readonly permitidas = computed(() =>
    (this.alert().acciones ?? []).filter((a) => this.staff() || DRIVER_ACTIONS.has(a.codigo))
  );
  readonly acciones = computed(() => this.permitidas().filter((a) => a.recomendada));
  readonly secundarias = computed(() => this.permitidas().filter((a) => !a.recomendada));

  readonly icon = computed(() => ICONS[this.alert().icon] ?? Sparkles);
  readonly tipoLabel = computed(() => TIPO_LABEL[this.alert().tipo ?? 'manual'] ?? this.alert().tipo);

  readonly estadoLabel = computed(
    () =>
      ({ activa: 'Sin atender', en_atencion: 'En atención', resuelta: 'Resuelta', descartada: 'Descartada' } as Record<string, string>)[
        this.alert().estado ?? 'activa'
      ]
  );
  readonly estadoClass = computed(
    () =>
      ({
        activa: 'bg-red-50 text-red-700 ring-red-200',
        en_atencion: 'bg-blue-50 text-blue-700 ring-blue-200',
        resuelta: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        descartada: 'bg-slate-100 text-slate-500 ring-slate-200'
      } as Record<string, string>)[this.alert().estado ?? 'activa']
  );

  sevLabel(): string {
    return ({ high: 'Alta', medium: 'Media', low: 'Baja' } as Record<string, string>)[this.alert().severidad] ?? '';
  }

  sevBadge(): string {
    return ({ high: 'badge-danger', medium: 'badge-warning', low: 'badge-success' } as Record<string, string>)[this.alert().severidad] ?? '';
  }

  sevIconClass(): string {
    return (
      ({
        high: 'bg-red-50 text-red-600 ring-red-100',
        medium: 'bg-amber-50 text-amber-600 ring-amber-100',
        low: 'bg-emerald-50 text-emerald-600 ring-emerald-100'
      } as Record<string, string>)[this.alert().severidad] ?? 'bg-slate-100 text-slate-500 ring-slate-200'
    );
  }

  round(n: number): number {
    return Math.round(n);
  }

  fecha(iso: string): string {
    return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  async run(ac: AlertAction): Promise<void> {
    if (ac.codigo === 'descartar' && !confirm('¿Descartar esta alerta como falsa alarma?')) return;
    let nota: string | undefined;
    if (ac.codigo === 'contactar_conductor') {
      const r = prompt('Resultado del contacto con el conductor (opcional):', '');
      if (r === null) return;
      nota = r.trim() || undefined;
    }
    this.busy.set(ac.codigo);
    this.mensaje.set(null);
    this.error.set(false);
    try {
      const res = await this.alerts.executeAction(this.alert().id, ac.codigo, nota);
      this.mensaje.set(res.resultado);
      this.changed.emit(res.alerta);
      if (res.navegar) {
        const [path, query] = res.navegar.split('?');
        const params = Object.fromEntries(new URLSearchParams(query ?? ''));
        await this.router.navigate([path], { queryParams: params });
      }
    } catch (e) {
      this.error.set(true);
      this.mensaje.set(e instanceof Error ? e.message : 'Error');
    } finally {
      this.busy.set(null);
    }
  }
}
