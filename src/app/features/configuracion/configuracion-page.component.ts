import { ConfirmService } from '../../core/services/confirm.service';
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  AlertCircle,
  Check,
  Gauge,
  LayoutGrid,
  Lock,
  LucideAngularModule,
  RotateCcw,
  Route,
  Save,
  WifiOff,
  MapPin,
  SlidersHorizontal,
  ShieldAlert,
  Satellite
} from 'lucide-angular';

import { AuthService } from '../../auth/auth.service';
import { LayoutService } from '../../core/services/layout.service';
import {
  Deteccion,
  DeteccionNum,
  DeteccionResponse,
  InterfazResponse,
  Rol,
  RolInterfaz,
  SettingsService,
  Umbrales,
  UmbralesResponse
} from '../../core/services/settings.service';
import { apiErrorMessage } from '../../core/utils/api-error.util';

type Tab = 'umbrales' | 'deteccion' | 'interfaz';

interface CampoUmbral {
  key: keyof Umbrales;
  label: string;
  unidad: string;
  ayuda: string;
}

const GRUPOS: { titulo: string; icon: typeof Gauge; campos: CampoUmbral[] }[] = [
  {
    titulo: 'Velocidad',
    icon: Gauge,
    campos: [
      { key: 'velocidad_max_kmh', label: 'Límite de velocidad', unidad: 'km/h', ayuda: 'Por encima de este valor se crea una alerta de exceso de velocidad (severidad media).' },
      { key: 'velocidad_margen_alta_kmh', label: 'Margen para severidad alta', unidad: 'km/h', ayuda: 'Si la unidad supera el límite en este margen o más, la alerta sube a alta.' }
    ]
  },
  {
    titulo: 'Desvío de ruta',
    icon: Route,
    campos: [
      { key: 'desvio_m', label: 'Distancia de desvío', unidad: 'm', ayuda: 'Distancia a la ruta planificada desde la que se alerta un desvío (media).' },
      { key: 'desvio_alto_m', label: 'Desvío grave', unidad: 'm', ayuda: 'Desde esta distancia el desvío se escala a severidad alta. Debe ser mayor que el anterior.' }
    ]
  },
  {
    titulo: 'Señal y detenciones',
    icon: WifiOff,
    campos: [
      { key: 'sin_senal_s', label: 'Tiempo sin señal GPS', unidad: 's', ayuda: 'Una unidad en ruta que deja de reportar este tiempo genera alerta de posible jamming.' },
      { key: 'parada_riesgo_min', label: 'Detención en zona de riesgo', unidad: 'min', ayuda: 'Minutos detenida dentro de una zona peligrosa antes de alertar.' }
    ]
  }
];

const ROLES: { key: Rol; label: string }[] = [
  { key: 'conductor', label: 'Conductor' },
  { key: 'supervisor', label: 'Supervisor' },
  { key: 'admin', label: 'Administrador' }
];

@Component({
  standalone: true,
  selector: 'app-configuracion-page',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="p-4 sm:p-6 lg:p-8 space-y-5 max-w-6xl">
      <div class="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit">
        <button type="button" class="tab-btn" [class.is-on]="tab() === 'umbrales'" (click)="tab.set('umbrales')">
          <lucide-icon [img]="gaugeIcon" [size]="14" />Umbrales de alerta
        </button>
        <button type="button" class="tab-btn" [class.is-on]="tab() === 'deteccion'" (click)="tab.set('deteccion')">
          <lucide-icon [img]="slidersIcon" [size]="14" />Parámetros de detección
        </button>
        <button type="button" class="tab-btn" [class.is-on]="tab() === 'interfaz'" (click)="tab.set('interfaz')">
          <lucide-icon [img]="gridIcon" [size]="14" />Interfaz por rol
        </button>
      </div>

      @if (msg(); as m) {
        <div class="flex items-start gap-2 p-3 rounded-lg ring-1 msg-in" [class]="m.ok ? 'bg-emerald-50 ring-emerald-200 text-emerald-800' : 'bg-red-50 ring-red-200 text-red-700'">
          <lucide-icon [img]="m.ok ? checkIcon : alertIcon" [size]="15" class="mt-0.5 shrink-0" />
          <p class="text-[12.5px] leading-snug">{{ m.text }}</p>
        </div>
      }

      <!-- ═══════════ UMBRALES ═══════════ -->
      @if (tab() === 'umbrales') {
        <section class="card p-5 sm:p-6">
          <div class="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <h2 class="text-[16px] font-semibold text-slate-900">Umbrales de alerta</h2>
              <p class="text-[12.5px] text-slate-500 mt-1 max-w-2xl">
                Límites que usa el motor de detección para todas las unidades (camiones reales y unidad de prueba).
                Los cambios se aplican desde el siguiente reporte de posición.
              </p>
            </div>
            @if (umbrales(); as u) {
              @if (u.actualizado) {
                <p class="text-[11.5px] text-slate-400">Último cambio: {{ u.actualizado | date: 'dd/MM/yyyy HH:mm' }} · {{ u.actualizadoPor }}</p>
              } @else {
                <p class="text-[11.5px] text-slate-400">Usando los valores por defecto</p>
              }
            }
          </div>

          @if (umbrales(); as u) {
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
              @for (g of grupos; track g.titulo) {
                <div class="rounded-xl ring-1 ring-slate-200 p-4">
                  <div class="flex items-center gap-2 mb-3">
                    <span class="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100 flex items-center justify-center">
                      <lucide-icon [img]="g.icon" [size]="14" />
                    </span>
                    <h3 class="text-[13.5px] font-semibold text-slate-900">{{ g.titulo }}</h3>
                  </div>
                  <div class="space-y-4">
                    @for (c of g.campos; track c.key) {
                      <div>
                        <label class="input-label" [for]="'u-' + c.key">{{ c.label }}</label>
                        <div class="relative">
                          <input
                            type="number"
                            class="input pr-14 tnum"
                            [id]="'u-' + c.key"
                            [name]="c.key"
                            [min]="u.rangos[c.key].min"
                            [max]="u.rangos[c.key].max"
                            [disabled]="!auth.isStaff()"
                            [(ngModel)]="form[c.key]"
                          />
                          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] text-slate-400">{{ c.unidad }}</span>
                        </div>
                        <p class="text-[11px] text-slate-500 mt-1.5 leading-snug">{{ c.ayuda }}</p>
                        <p class="text-[10.5px] text-slate-400 mt-0.5">
                          Por defecto {{ u.porDefecto[c.key] }} {{ c.unidad }} · permitido {{ u.rangos[c.key].min }}–{{ u.rangos[c.key].max }}
                        </p>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <div class="mt-5 rounded-lg bg-slate-50 ring-1 ring-slate-200 p-3 text-[12px] text-slate-600 leading-relaxed">
              Con estos valores: alerta de velocidad sobre <strong>{{ form.velocidad_max_kmh }} km/h</strong>
              (alta desde {{ (form.velocidad_max_kmh || 0) + (form.velocidad_margen_alta_kmh || 0) }} km/h),
              desvío desde <strong>{{ form.desvio_m }} m</strong> (alto desde {{ form.desvio_alto_m }} m),
              sin señal tras <strong>{{ form.sin_senal_s }} s</strong> y detención en zona de riesgo de
              <strong>{{ form.parada_riesgo_min }} min</strong>.
            </div>

            <div class="flex flex-wrap items-center justify-end gap-2 mt-5">
              <button type="button" class="btn-ghost" [disabled]="saving()" (click)="resetUmbrales()">
                <lucide-icon [img]="resetIcon" [size]="14" />Restablecer valores por defecto
              </button>
              <button type="button" class="btn-dark" [disabled]="saving() || !umbralesDirty()" (click)="saveUmbrales()">
                <lucide-icon [img]="saveIcon" [size]="14" />{{ saving() ? 'Guardando...' : 'Guardar umbrales' }}
              </button>
            </div>
          } @else {
            <div class="space-y-3" aria-label="Cargando" role="status">
              @for (n of [1, 2, 3]; track n) {
                <div class="space-y-1.5"><span class="skeleton h-3 w-1/3"></span><span class="skeleton h-9 w-full"></span></div>
              }
            </div>
          }
        </section>
      }

      <!-- ═══════════ PARÁMETROS DE DETECCIÓN (CP020) ═══════════ -->
      @if (tab() === 'deteccion') {
        <section class="card p-5 sm:p-6">
          <div class="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <h2 class="text-[16px] font-semibold text-slate-900">Parámetros de detección</h2>
              <p class="text-[12.5px] text-slate-500 mt-1 max-w-2xl">
                Ajusta qué tan sensible es el motor que detecta anomalías y sabotajes. Hoy el motor funciona con reglas
                y pesos que se pueden explicar; estos son los parámetros que usa. Los cambios se aplican desde el siguiente reporte de posición.
              </p>
            </div>
            @if (deteccion()?.actualizado) {
              <p class="text-[11.5px] text-slate-400">Último cambio: {{ deteccion()!.actualizado | date: 'dd/MM/yyyy HH:mm' }} · {{ deteccion()!.actualizadoPor }}</p>
            }
          </div>

          @if (deteccion(); as d) {
            <h3 class="text-[13.5px] font-semibold text-slate-900 mb-2">Sensibilidad general</h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6" role="radiogroup" aria-label="Sensibilidad">
              @for (n of niveles; track n.key) {
                <button type="button" role="radio" [attr.aria-checked]="d.valores.sensibilidad === n.key"
                        class="text-left rounded-xl p-4 ring-1 transition"
                        [class]="d.valores.sensibilidad === n.key ? 'ring-2 ring-blue-600 bg-blue-50/50' : 'ring-slate-200 hover:bg-slate-50'"
                        [disabled]="saving() || !auth.isStaff()" (click)="aplicarNivel(n.key)">
                  <p class="text-[13.5px] font-semibold text-slate-900">{{ n.label }}</p>
                  <p class="text-[12px] text-slate-500 mt-1 leading-snug">{{ n.desc }}</p>
                  <p class="text-[11px] text-slate-400 mt-2 tnum">Desvío {{ d.presets[n.key].umbrales.desvio_m }} m · sin señal {{ d.presets[n.key].umbrales.sin_senal_s }} s · sabotaje desde {{ d.presets[n.key].deteccion.umbral_sabotaje }} pts</p>
                </button>
              }
            </div>
            @if (d.valores.sensibilidad === 'personalizada') {
              <p class="text-[12px] text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2 mb-5">Estás usando valores personalizados (no coinciden con un nivel).</p>
            }

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="rounded-xl ring-1 ring-slate-200 p-4">
                <div class="flex items-center gap-2 mb-3">
                  <span class="w-7 h-7 rounded-lg bg-red-50 text-red-600 ring-1 ring-red-100 flex items-center justify-center"><lucide-icon [img]="shieldAlertIcon" [size]="14" /></span>
                  <h3 class="text-[13.5px] font-semibold text-slate-900">Puntaje de posible sabotaje</h3>
                </div>
                <p class="text-[11.5px] text-slate-500 mb-3 leading-snug">Cada evento de las últimas 24 h suma puntos (máximo dos veces por tipo). Al llegar al umbral se crea la alerta «Posible sabotaje o robo».</p>
                <label class="input-label" for="d-umbral">Umbral de alerta</label>
                <div class="relative mb-4">
                  <input id="d-umbral" type="number" class="input pr-14 tnum" [min]="d.rangos.umbral_sabotaje.min" [max]="d.rangos.umbral_sabotaje.max" [disabled]="!auth.isStaff()" [(ngModel)]="detForm.umbral_sabotaje" name="umbral" />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] text-slate-400">puntos</span>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  @for (pz of pesos; track pz.key) {
                    <div>
                      <label class="input-label" [for]="'d-' + pz.key">{{ pz.label }}</label>
                      <input type="number" class="input tnum" [id]="'d-' + pz.key" [min]="d.rangos[pz.key].min" [max]="d.rangos[pz.key].max" [disabled]="!auth.isStaff()" [(ngModel)]="detForm[pz.key]" [name]="pz.key" />
                    </div>
                  }
                </div>
                <p class="text-[11.5px] text-slate-600 mt-3 bg-slate-50 rounded-lg px-3 py-2 leading-snug">{{ ejemploSabotaje() }}</p>
              </div>

              <div class="rounded-xl ring-1 ring-slate-200 p-4">
                <div class="flex items-center gap-2 mb-3">
                  <span class="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center"><lucide-icon [img]="satelliteIcon" [size]="14" /></span>
                  <h3 class="text-[13.5px] font-semibold text-slate-900">Posible GPS spoofing</h3>
                </div>
                <p class="text-[11.5px] text-slate-500 mb-3 leading-snug">Se alerta cuando la posición salta una distancia grande en poco tiempo, con una velocidad imposible para un camión.</p>
                <label class="input-label" for="d-salto">Salto mínimo</label>
                <div class="relative mb-3">
                  <input id="d-salto" type="number" class="input pr-12 tnum" [min]="d.rangos.spoofing_salto_m.min" [max]="d.rangos.spoofing_salto_m.max" [disabled]="!auth.isStaff()" [(ngModel)]="detForm.spoofing_salto_m" name="salto" />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] text-slate-400">m</span>
                </div>
                <label class="input-label" for="d-kmh">Velocidad imposible desde</label>
                <div class="relative">
                  <input id="d-kmh" type="number" class="input pr-14 tnum" [min]="d.rangos.spoofing_kmh.min" [max]="d.rangos.spoofing_kmh.max" [disabled]="!auth.isStaff()" [(ngModel)]="detForm.spoofing_kmh" name="kmh" />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] text-slate-400">km/h</span>
                </div>
                <p class="text-[11.5px] text-slate-500 mt-4 leading-snug">
                  Los umbrales de desvío, señal y velocidad están en la pestaña <button type="button" class="font-semibold text-blue-600 hover:underline" (click)="tab.set('umbrales')">Umbrales de alerta</button>
                  (desvío actual {{ d.umbrales.desvio_m }} m, sin señal {{ d.umbrales.sin_senal_s }} s).
                </p>
              </div>
            </div>

            @if (auth.isStaff()) {
              <div class="flex flex-wrap items-center justify-end gap-2 mt-5">
                <button type="button" class="btn-ghost" [disabled]="saving()" (click)="resetDeteccion()">
                  <lucide-icon [img]="resetIcon" [size]="14" />Volver a sensibilidad media
                </button>
                <button type="button" class="btn-dark" [disabled]="saving() || !deteccionDirty()" (click)="saveDeteccion()">
                  <lucide-icon [img]="saveIcon" [size]="14" />{{ saving() ? 'Guardando...' : 'Guardar parámetros' }}
                </button>
              </div>
            }
          } @else {
            <div class="space-y-3" aria-label="Cargando" role="status">
              @for (n of [1, 2, 3]; track n) {
                <div class="space-y-1.5"><span class="skeleton h-3 w-1/3"></span><span class="skeleton h-9 w-full"></span></div>
              }
            </div>
          }
        </section>
      }

      <!-- ═══════════ INTERFAZ POR ROL ═══════════ -->
      @if (tab() === 'interfaz') {
        <section class="card p-5 sm:p-6">
          <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 class="text-[16px] font-semibold text-slate-900">Interfaz por rol</h2>
              <p class="text-[12.5px] text-slate-500 mt-1 max-w-2xl">
                Elige qué módulos aparecen en el menú de cada rol y en qué pantalla entra al iniciar sesión.
                Un módulo oculto tampoco se puede abrir escribiendo su dirección.
              </p>
            </div>
            @if (interfaz()?.actualizado) {
              <p class="text-[11.5px] text-slate-400">Último cambio: {{ interfaz()!.actualizado | date: 'dd/MM/yyyy HH:mm' }} · {{ interfaz()!.actualizadoPor }}</p>
            }
          </div>

          @if (!esAdmin()) {
            <div class="flex items-start gap-2 p-3 mb-4 rounded-lg bg-amber-50 ring-1 ring-amber-200 text-amber-800">
              <lucide-icon [img]="lockIcon" [size]="14" class="mt-0.5 shrink-0" />
              <p class="text-[12.5px] leading-snug">Solo el <strong>administrador</strong> puede cambiar la interfaz por rol. Aquí ves la configuración actual.</p>
            </div>
          }

          @if (interfaz(); as conf) {
            <div class="overflow-x-auto -mx-1">
              <table class="w-full min-w-[560px] text-[12.5px]">
                <thead>
                  <tr class="text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th class="py-2 px-2 font-semibold">Módulo</th>
                    @for (r of roles; track r.key) {
                      <th class="py-2 px-2 font-semibold text-center">{{ r.label }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (m of conf.modulos; track m.key) {
                    <tr class="border-t border-slate-100">
                      <td class="py-2.5 px-2 text-slate-800 font-medium">
                        {{ m.label }}
                        @if (m.solo_staff) { <span class="ml-1 text-[10px] text-slate-400">(solo personal de control)</span> }
                      </td>
                      @for (r of roles; track r.key) {
                        <td class="py-2.5 px-2 text-center">
                          @if (r.key === 'conductor' && m.solo_staff) {
                            <span class="text-slate-300" title="No disponible para conductores">—</span>
                          } @else {
                            <label class="inline-flex items-center justify-center gap-1 cursor-pointer" [title]="esFijo(r.key, m.key) ? 'Siempre visible para este rol' : ''">
                              <input
                                type="checkbox"
                                class="w-4 h-4 accent-blue-600"
                                [checked]="draft[r.key].modulos.includes(m.key)"
                                [disabled]="!esAdmin() || esFijo(r.key, m.key)"
                                (change)="toggle(r.key, m.key)"
                              />
                              @if (esFijo(r.key, m.key)) { <lucide-icon [img]="lockIcon" [size]="11" class="text-slate-400" /> }
                            </label>
                          }
                        </td>
                      }
                    </tr>
                  }
                  <tr class="border-t-2 border-slate-200">
                    <td class="py-3 px-2 text-slate-800 font-semibold">Pantalla de inicio</td>
                    @for (r of roles; track r.key) {
                      <td class="py-3 px-2">
                        <select class="input h-9 text-[12px]" [disabled]="!esAdmin()" [(ngModel)]="draft[r.key].inicio" [name]="'inicio-' + r.key">
                          @for (m of conf.modulos; track m.key) {
                            @if (draft[r.key].modulos.includes(m.key)) {
                              <option [value]="m.key">{{ m.label }}</option>
                            }
                          }
                        </select>
                      </td>
                    }
                  </tr>
                  <tr>
                    <td class="py-2 px-2 text-[11px] text-slate-400">Módulos visibles</td>
                    @for (r of roles; track r.key) {
                      <td class="py-2 px-2 text-center text-[11.5px] font-semibold text-slate-600 tnum">{{ draft[r.key].modulos.length }}</td>
                    }
                  </tr>
                </tbody>
              </table>
            </div>

            @if (esAdmin()) {
              <div class="flex flex-wrap items-center justify-end gap-2 mt-5">
                <button type="button" class="btn-ghost" [disabled]="saving()" (click)="restoreInterfaz()">
                  <lucide-icon [img]="resetIcon" [size]="14" />Volver a la configuración guardada
                </button>
                <button type="button" class="btn-dark" [disabled]="saving() || !interfazDirty()" (click)="saveInterfaz()">
                  <lucide-icon [img]="saveIcon" [size]="14" />{{ saving() ? 'Guardando...' : 'Guardar interfaz' }}
                </button>
              </div>
            }
          } @else {
            <div class="space-y-3" aria-label="Cargando" role="status">
              @for (n of [1, 2, 3]; track n) {
                <div class="space-y-1.5"><span class="skeleton h-3 w-1/3"></span><span class="skeleton h-9 w-full"></span></div>
              }
            </div>
          }
        </section>
      }
    </div>
  `,
  styles: [
    `
      .tab-btn {
        display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 9px;
        font-size: 12.5px; font-weight: 600; color: #475569; transition: all .15s;
      }
      .tab-btn:hover { color: #0f172a; }
      .tab-btn.is-on { background: #fff; color: #0f172a; box-shadow: 0 1px 2px rgba(15,23,42,.08), 0 0 0 1px rgba(15,23,42,.06); }
      .btn-dark, .btn-ghost {
        display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 9px;
        font-size: 12.5px; font-weight: 600; transition: all .15s;
      }
      .btn-dark { background: #0b1220; color: #fff; }
      .btn-dark:hover:not(:disabled) { background: #16233b; }
      .btn-ghost { color: #334155; box-shadow: 0 0 0 1px #e2e8f0 inset; }
      .btn-ghost:hover:not(:disabled) { background: #f8fafc; }
      .btn-dark:disabled, .btn-ghost:disabled { opacity: .45; cursor: not-allowed; }
    `
  ]
})
export class ConfiguracionPageComponent implements OnInit {
  private readonly confirmDialog = inject(ConfirmService);
  readonly auth = inject(AuthService);
  private readonly settings = inject(SettingsService);
  private readonly layout = inject(LayoutService);
  private readonly route = inject(ActivatedRoute);

  readonly gaugeIcon = Gauge;
  readonly gridIcon = LayoutGrid;
  readonly saveIcon = Save;
  readonly resetIcon = RotateCcw;
  readonly checkIcon = Check;
  readonly alertIcon = AlertCircle;
  readonly lockIcon = Lock;
  readonly pinIcon = MapPin;
  readonly slidersIcon = SlidersHorizontal;
  readonly shieldAlertIcon = ShieldAlert;
  readonly satelliteIcon = Satellite;

  readonly niveles: { key: 'baja' | 'media' | 'alta'; label: string; desc: string }[] = [
    { key: 'baja', label: 'Baja', desc: 'Espera más evidencia. Menos falsas alarmas, pero avisa más tarde.' },
    { key: 'media', label: 'Media (recomendada)', desc: 'Equilibrio entre avisar a tiempo y evitar falsas alarmas.' },
    { key: 'alta', label: 'Alta', desc: 'Avisa ante la menor señal. Útil en rutas peligrosas; habrá más alertas.' }
  ];
  readonly pesos: { key: DeteccionNum; label: string }[] = [
    { key: 'peso_desvio', label: 'Desvío de ruta' },
    { key: 'peso_spoofing', label: 'GPS spoofing' },
    { key: 'peso_jamming', label: 'Pérdida de señal' },
    { key: 'peso_parada_riesgo', label: 'Detención en zona de riesgo' },
    { key: 'peso_salida_zona', label: 'Salida de geocerca' }
  ];
  readonly deteccion = signal<DeteccionResponse | null>(null);
  detForm: Partial<Deteccion> = {};

  readonly grupos = GRUPOS;
  readonly roles = ROLES;

  readonly tab = signal<Tab>('umbrales');
  readonly saving = signal(false);
  readonly msg = signal<{ ok: boolean; text: string } | null>(null);
  readonly umbrales = signal<UmbralesResponse | null>(null);
  readonly interfaz = signal<InterfazResponse | null>(null);
  readonly esAdmin = computed(() => this.auth.profile()?.role === 'admin');

  form: Partial<Umbrales> = {};
  draft: Record<Rol, RolInterfaz> = {
    conductor: { modulos: [], inicio: 'dashboard' },
    supervisor: { modulos: [], inicio: 'dashboard' },
    admin: { modulos: [], inicio: 'dashboard' }
  };

  async ngOnInit(): Promise<void> {
    this.layout.setPage('Configuración', 'Umbrales, parámetros de detección e interfaz por rol');
    const t = this.route.snapshot.queryParamMap.get('tab');
    if (t === 'interfaz' || t === 'deteccion') this.tab.set(t);
    try {
      const [u, i, d] = await Promise.all([this.settings.getUmbrales(), this.settings.loadInterfaz(), this.settings.getDeteccion()]);
      this.setUmbrales(u);
      if (i) this.setInterfaz(i);
      this.setDeteccion(d);
    } catch (e) {
      this.flash(false, apiErrorMessage(e, 'No se pudo cargar la configuración'));
    }
  }

  private setUmbrales(u: UmbralesResponse): void {
    this.umbrales.set(u);
    this.form = { ...u.valores };
  }

  private setDeteccion(d: DeteccionResponse): void {
    this.deteccion.set(d);
    this.detForm = { ...d.valores };
  }

  deteccionDirty(): boolean {
    const d = this.deteccion()?.valores;
    if (!d) return false;
    return (Object.keys(this.deteccion()!.rangos) as DeteccionNum[]).some((k) => Number(this.detForm[k]) !== d[k]);
  }

  ejemploSabotaje(): string {
    const f = this.detForm;
    const u = Number(f.umbral_sabotaje) || 0;
    const combos: [string, number][] = [
      ['un desvío y una pérdida de señal', Number(f.peso_desvio) + Number(f.peso_jamming)],
      ['dos desvíos', 2 * Number(f.peso_desvio)],
      ['un spoofing y una detención en zona de riesgo', Number(f.peso_spoofing) + Number(f.peso_parada_riesgo)]
    ];
    return combos
      .map(([t, p]) => `${t[0].toUpperCase() + t.slice(1)} suman ${p} puntos: ${p >= u ? 'sí alerta' : 'no alerta'}.`)
      .join(' ');
  }

  async aplicarNivel(nivel: 'baja' | 'media' | 'alta'): Promise<void> {
    if (!(await this.confirmDialog.ask(`¿Aplicar la sensibilidad ${nivel}? Cambia también los umbrales de desvío, señal y detención.`, { okLabel: 'Aplicar', danger: false }))) return;
    this.saving.set(true);
    try {
      this.setDeteccion(await this.settings.setSensibilidad(nivel));
      this.setUmbrales(await this.settings.getUmbrales());
      this.flash(true, `Sensibilidad ${nivel} aplicada. El motor ya usa los nuevos parámetros.`);
    } catch (e) {
      this.flash(false, apiErrorMessage(e, 'No se pudo aplicar la sensibilidad'));
    } finally {
      this.saving.set(false);
    }
  }

  async saveDeteccion(): Promise<void> {
    const d = this.deteccion();
    if (!d) return;
    for (const [k, r] of Object.entries(d.rangos) as [DeteccionNum, { min: number; max: number }][]) {
      const v = Number(this.detForm[k]);
      if (!Number.isFinite(v) || v < r.min || v > r.max) {
        this.flash(false, `Ingresa un valor entre ${r.min} y ${r.max} en todos los campos.`);
        return;
      }
    }
    this.saving.set(true);
    try {
      this.setDeteccion(await this.settings.saveDeteccion(this.detForm));
      this.flash(true, 'Parámetros guardados. El motor de detección ya los usa.');
    } catch (e) {
      this.flash(false, apiErrorMessage(e, 'No se pudieron guardar los parámetros'));
    } finally {
      this.saving.set(false);
    }
  }

  async resetDeteccion(): Promise<void> {
    if (!(await this.confirmDialog.ask('¿Volver a la sensibilidad media y a los pesos por defecto?'))) return;
    this.saving.set(true);
    try {
      this.setDeteccion(await this.settings.resetDeteccion());
      this.setUmbrales(await this.settings.getUmbrales());
      this.flash(true, 'Se restableció la sensibilidad media.');
    } catch (e) {
      this.flash(false, apiErrorMessage(e, 'No se pudo restablecer'));
    } finally {
      this.saving.set(false);
    }
  }

  private setInterfaz(i: InterfazResponse): void {
    this.interfaz.set(i);
    this.draft = JSON.parse(JSON.stringify(i.roles));
  }

  private flash(ok: boolean, text: string): void {
    this.msg.set({ ok, text });
    setTimeout(() => {
      if (this.msg()?.text === text) this.msg.set(null);
    }, 5000);
  }

  umbralesDirty(): boolean {
    const u = this.umbrales()?.valores;
    if (!u) return false;
    return (Object.keys(u) as (keyof Umbrales)[]).some((k) => Number(this.form[k]) !== u[k]);
  }

  async saveUmbrales(): Promise<void> {
    const u = this.umbrales();
    if (!u) return;
    for (const g of this.grupos) {
      for (const c of g.campos) {
        const v = Number(this.form[c.key]);
        const r = u.rangos[c.key];
        if (!Number.isFinite(v) || v < r.min || v > r.max) {
          this.flash(false, `${c.label}: ingresa un valor entre ${r.min} y ${r.max} ${c.unidad}.`);
          return;
        }
      }
    }
    if (Number(this.form.desvio_alto_m) <= Number(this.form.desvio_m)) {
      this.flash(false, 'El desvío grave debe ser mayor que la distancia de desvío.');
      return;
    }
    this.saving.set(true);
    try {
      this.setUmbrales(await this.settings.saveUmbrales(this.form));
      this.flash(true, 'Umbrales guardados. El motor de detección ya usa los nuevos valores.');
    } catch (e) {
      this.flash(false, apiErrorMessage(e, 'No se pudieron guardar los umbrales'));
    } finally {
      this.saving.set(false);
    }
  }

  async resetUmbrales(): Promise<void> {
    if (!(await this.confirmDialog.ask('¿Volver a los umbrales por defecto?'))) return;
    this.saving.set(true);
    try {
      this.setUmbrales(await this.settings.resetUmbrales());
      this.flash(true, 'Se restablecieron los valores por defecto.');
    } catch (e) {
      this.flash(false, apiErrorMessage(e, 'No se pudieron restablecer'));
    } finally {
      this.saving.set(false);
    }
  }

  esFijo(rol: Rol, key: string): boolean {
    return this.interfaz()?.fijos[rol]?.includes(key) ?? false;
  }

  toggle(rol: Rol, key: string): void {
    const conf = this.draft[rol];
    const order = this.interfaz()?.modulos.map((m) => m.key) ?? [];
    const set = new Set(conf.modulos);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    conf.modulos = order.filter((k) => set.has(k));
    if (!conf.modulos.includes(conf.inicio)) conf.inicio = conf.modulos[0];
  }

  interfazDirty(): boolean {
    const i = this.interfaz();
    return !!i && JSON.stringify(i.roles) !== JSON.stringify(this.draft);
  }

  restoreInterfaz(): void {
    const i = this.interfaz();
    if (i) this.draft = JSON.parse(JSON.stringify(i.roles));
  }

  async saveInterfaz(): Promise<void> {
    this.saving.set(true);
    try {
      this.setInterfaz(await this.settings.saveInterfaz(this.draft));
      this.flash(true, 'Interfaz guardada. Cada usuario verá el cambio al recargar o al volver a iniciar sesión.');
    } catch (e) {
      this.flash(false, apiErrorMessage(e, 'No se pudo guardar la interfaz'));
    } finally {
      this.saving.set(false);
    }
  }
}
