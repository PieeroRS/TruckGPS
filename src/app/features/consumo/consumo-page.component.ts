import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertCircle,
  AlertTriangle,
  Coins,
  Fuel,
  Gauge,
  Info,
  LucideAngularModule,
  Pencil,
  Plus,
  Route,
  Trash2,
  X
} from 'lucide-angular';

import { AuthService } from '../../auth/auth.service';
import { FuelLog, FuelRouteRow, FuelVehicleRow } from '../../core/models/fuel.model';
import { FleetService } from '../../core/services/fleet.service';
import { FuelService } from '../../core/services/fuel.service';
import { apiErrorMessage } from '../../core/utils/api-error.util';

type LogForm = {
  vehicle_id: string;
  fecha: string;
  galones: number | null;
  monto: number | null;
  odometro_km: number | null;
  tanque_lleno: boolean;
  grifo: string;
  nav_route_id: string;
  notas: string;
};

function nowLocalInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

@Component({
  standalone: true,
  selector: 'app-consumo-page',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">

      <!-- ═══════════ ENCABEZADO ═══════════ -->
      <div class="flex items-end justify-between flex-wrap gap-4 mb-6 anim-in">
        <div>
          <h2 class="text-[22px] font-bold text-slate-900 tracking-[-0.03em] leading-tight">Consumo de combustible</h2>
          <p class="text-[13px] text-slate-500 mt-1.5">Rendimiento real por unidad, costo por kilómetro y estimado por ruta.</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <select class="select !w-auto" [ngModel]="days()" (ngModelChange)="setDays($event)" aria-label="Periodo">
            <option [ngValue]="7">Últimos 7 días</option>
            <option [ngValue]="30">Últimos 30 días</option>
            <option [ngValue]="90">Últimos 90 días</option>
          </select>
          <button type="button" class="group inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0b1220] hover:bg-[#16233b] text-white text-[12.5px] font-semibold transition-all active:scale-[0.98] shadow-[0_1px_2px_rgba(11,18,32,0.25),0_6px_16px_-8px_rgba(11,18,32,0.5)]" (click)="openLogForm()">
            <lucide-icon [img]="plusIcon" [size]="14" class="transition-transform duration-300 group-hover:rotate-90" />Registrar carga
          </button>
        </div>
      </div>

      @if (error()) {
        <div class="flex items-start gap-2 p-3 rounded-lg bg-red-50 ring-1 ring-red-200 text-red-700 mb-4 msg-in">
          <lucide-icon [img]="alertCircleIcon" [size]="14" class="mt-0.5 shrink-0" />
          <p class="text-[12.5px] leading-snug flex-1">{{ error() }}</p>
          <button type="button" class="shrink-0 w-5 h-5 rounded-md text-red-400 hover:text-red-700 hover:bg-red-100 flex items-center justify-center transition" (click)="error.set(null)" aria-label="Cerrar">
            <lucide-icon [img]="closeIcon" [size]="12" />
          </button>
        </div>
      }

      <!-- ═══════════ KPIs ═══════════ -->
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        @for (k of kpis(); track k.label; let i = $index) {
          <div class="kpi group anim-in" [style.animation-delay.ms]="i * 55">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center ring-1" [class]="k.iconCls">
              <lucide-icon [img]="k.icon" [size]="16" [strokeWidth]="2" />
            </div>
            <div class="text-[24px] font-bold tracking-[-0.03em] leading-none mt-3 tnum text-slate-900">{{ k.value }}</div>
            <div class="text-[11.5px] uppercase font-semibold tracking-wider text-slate-400 mt-1.5">{{ k.label }}</div>
            @if (k.hint) {
              <div class="text-[11px] text-slate-400 mt-1">{{ k.hint }}</div>
            }
          </div>
        }
      </section>

      <!-- ═══════════ ALERTAS DE RENDIMIENTO ═══════════ -->
      @for (v of lowRows(); track v.vehicleId) {
        <div class="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 ring-1 ring-amber-200 text-amber-800 mb-3 msg-in">
          <lucide-icon [img]="alertIcon" [size]="15" class="mt-0.5 shrink-0" />
          <p class="text-[12.5px] leading-snug">
            <span class="font-mono font-semibold">{{ v.placa }}</span> rinde {{ v.rendimientoReal }} km/gal,
            un {{ abs(v.desviacionPct) }}% menos que su referencia ({{ v.rendimientoRef }} km/gal).
            Revisa mantenimiento (filtros, inyectores, llantas), la forma de manejo o posibles pérdidas de combustible.
          </p>
        </div>
      }

      <!-- ═══════════ RENDIMIENTO POR UNIDAD ═══════════ -->
      <div class="card overflow-hidden mb-5 anim-in" style="animation-delay: 120ms">
        <div class="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between gap-3 flex-wrap">
          <h3 class="text-[14px] font-bold text-slate-900 tracking-tight">Rendimiento por unidad</h3>
          <p class="text-[11.5px] text-slate-400">Real = km entre llenados (odómetro) ÷ galones cargados</p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-slate-50/70 border-b border-slate-200 text-[10.5px] uppercase tracking-[0.08em] text-slate-400">
              <tr>
                <th class="px-4 py-3 font-semibold">Unidad</th>
                <th class="px-4 py-3 font-semibold text-right">Cargas</th>
                <th class="px-4 py-3 font-semibold text-right">Galones</th>
                <th class="px-4 py-3 font-semibold text-right">Gasto</th>
                <th class="px-4 py-3 font-semibold text-right">Km</th>
                <th class="px-4 py-3 font-semibold">Rendimiento</th>
                <th class="px-4 py-3 font-semibold text-right">Costo / km</th>
                <th class="px-4 py-3 font-semibold">Estado</th>
                @if (auth.isStaff()) {
                  <th class="px-4 py-3 font-semibold text-right">Referencia</th>
                }
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-[13px]">
              @for (v of rows(); track v.vehicleId; let i = $index) {
                <tr class="row-slide hover:bg-slate-50/70" [style.animation-delay.ms]="i * 35">
                  <td class="px-4 py-3.5">
                    <div class="font-semibold font-mono text-slate-900 tracking-tight">{{ v.placa }}</div>
                    <div class="text-[11.5px] text-slate-400">{{ v.modelo }}</div>
                  </td>
                  <td class="px-4 py-3.5 text-right tnum text-slate-600">{{ v.cargas }}</td>
                  <td class="px-4 py-3.5 text-right tnum text-slate-600">{{ num(v.galones) }}</td>
                  <td class="px-4 py-3.5 text-right tnum text-slate-700 font-medium">{{ money(v.gasto) }}</td>
                  <td class="px-4 py-3.5 text-right tnum text-slate-600">
                    {{ num(v.km, 0) }}
                    @if (!v.kmOdometro && v.kmGps) {
                      <div class="text-[10.5px] text-slate-400">por GPS</div>
                    }
                  </td>
                  <td class="px-4 py-3.5">
                    @if (v.rendimientoReal) {
                      <div class="tnum font-semibold text-slate-900">{{ v.rendimientoReal }} <span class="text-[11px] font-normal text-slate-400">km/gal</span></div>
                      <div class="text-[11px] text-slate-400">
                        ref. {{ v.rendimientoRef ?? '—' }}
                        @if (v.desviacionPct !== null) {
                          · <span [class]="v.desviacionPct < 0 ? 'text-red-600' : 'text-emerald-600'">{{ v.desviacionPct > 0 ? '+' : '' }}{{ v.desviacionPct }}%</span>
                        }
                        @if (v.metodo === 'gps') { · aprox. GPS }
                      </div>
                    } @else {
                      <div class="text-[12px] text-slate-400">Faltan 2 llenados con odómetro</div>
                      <div class="text-[11px] text-slate-400">ref. {{ v.rendimientoRef ?? 'sin definir' }}</div>
                    }
                  </td>
                  <td class="px-4 py-3.5 text-right tnum text-slate-700">{{ v.costoKm !== null ? money(v.costoKm) : '—' }}</td>
                  <td class="px-4 py-3.5">
                    <span class="badge" [class]="estadoBadge(v)">{{ estadoLabel(v) }}</span>
                  </td>
                  @if (auth.isStaff()) {
                    <td class="px-4 py-3.5 text-right">
                      <button type="button" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 transition active:scale-95" (click)="openRefForm(v)">
                        <lucide-icon [img]="pencilIcon" [size]="11" />Editar
                      </button>
                    </td>
                  }
                </tr>
              } @empty {
                <tr><td colspan="9" class="px-6 py-12 text-center text-[13px] text-slate-400">{{ fuel.loading() ? 'Cargando...' : 'No hay unidades registradas.' }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">

        <!-- ═══════════ ESTIMADO POR RUTA ═══════════ -->
        <div class="card overflow-hidden anim-in" style="animation-delay: 180ms">
          <div class="px-5 py-3.5 border-b border-slate-200/80">
            <h3 class="text-[14px] font-bold text-slate-900 tracking-tight">Estimado por ruta</h3>
            <p class="text-[11.5px] text-slate-400 mt-0.5">
              Distancia ÷ rendimiento de la unidad
              @if (summary()?.precioGalonRef) {
                × S/ {{ summary()!.precioGalonRef }} por galón
              }
            </p>
          </div>
          <div class="px-5 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
            <label class="text-[12px] text-slate-500" for="precio">Precio del galón (S/)</label>
            <input id="precio" type="number" min="0" step="0.01" class="input !w-28 tnum" [(ngModel)]="precioManual" placeholder="{{ summary()?.precioGalonRef ?? '16.50' }}" (change)="reload()" />
            <span class="text-[11px] text-slate-400">{{ precioManual ? 'precio manual' : 'promedio de tus cargas' }}</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead class="bg-slate-50/70 border-b border-slate-200 text-[10.5px] uppercase tracking-[0.08em] text-slate-400">
                <tr>
                  <th class="px-4 py-3 font-semibold">Ruta</th>
                  <th class="px-4 py-3 font-semibold text-right">Km</th>
                  <th class="px-4 py-3 font-semibold text-right">Galones</th>
                  <th class="px-4 py-3 font-semibold text-right">Costo</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-[13px]">
                @for (r of routes(); track r.id) {
                  <tr class="hover:bg-slate-50/70">
                    <td class="px-4 py-3">
                      <div class="font-medium text-slate-800">{{ r.routeLabel }}</div>
                      <div class="text-[11px] text-slate-400 font-mono">{{ r.placa ?? 'sin unidad' }}</div>
                    </td>
                    <td class="px-4 py-3 text-right tnum text-slate-600">{{ r.distanceKm !== null ? num(r.distanceKm, 0) : '—' }}</td>
                    <td class="px-4 py-3 text-right tnum text-slate-600">{{ r.galonesEstimados ?? '—' }}</td>
                    <td class="px-4 py-3 text-right tnum font-medium text-slate-800">{{ r.costoEstimado !== null ? money(r.costoEstimado) : '—' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="px-6 py-10 text-center text-[12.5px] text-slate-400">Sin rutas en este periodo. Crea una en Rutas para ver su consumo estimado.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- ═══════════ ÚLTIMAS CARGAS ═══════════ -->
        <div class="card overflow-hidden anim-in" style="animation-delay: 220ms">
          <div class="px-5 py-3.5 border-b border-slate-200/80">
            <h3 class="text-[14px] font-bold text-slate-900 tracking-tight">Últimas cargas</h3>
            <p class="text-[11.5px] text-slate-400 mt-0.5">Vales de grifo registrados</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead class="bg-slate-50/70 border-b border-slate-200 text-[10.5px] uppercase tracking-[0.08em] text-slate-400">
                <tr>
                  <th class="px-4 py-3 font-semibold">Fecha</th>
                  <th class="px-4 py-3 font-semibold">Unidad</th>
                  <th class="px-4 py-3 font-semibold text-right">Galones</th>
                  <th class="px-4 py-3 font-semibold text-right">Monto</th>
                  <th class="px-4 py-3 font-semibold text-right">Odómetro</th>
                  @if (auth.isStaff()) { <th class="px-4 py-3"></th> }
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-[13px]">
                @for (l of fuel.logs(); track l.id) {
                  <tr class="hover:bg-slate-50/70">
                    <td class="px-4 py-3 tnum text-slate-600 whitespace-nowrap">{{ l.fecha | date: 'dd/MM HH:mm' }}</td>
                    <td class="px-4 py-3">
                      <div class="font-mono font-semibold text-slate-800">{{ l.placa }}</div>
                      <div class="text-[11px] text-slate-400 truncate max-w-[180px]">{{ l.grifo || '—' }}{{ l.tanqueLleno ? '' : ' · parcial' }}</div>
                    </td>
                    <td class="px-4 py-3 text-right tnum text-slate-600">{{ num(l.galones) }}</td>
                    <td class="px-4 py-3 text-right tnum">
                      <div class="font-medium text-slate-800">{{ money(l.monto) }}</div>
                      @if (l.precioGalon) { <div class="text-[10.5px] text-slate-400">S/ {{ l.precioGalon }}/gal</div> }
                    </td>
                    <td class="px-4 py-3 text-right tnum text-slate-600">{{ l.odometroKm !== null ? num(l.odometroKm, 0) : '—' }}</td>
                    @if (auth.isStaff()) {
                      <td class="px-4 py-3 text-right">
                        <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition" (click)="removeLog(l)" aria-label="Eliminar carga">
                          <lucide-icon [img]="trashIcon" [size]="13" />
                        </button>
                      </td>
                    }
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="px-6 py-10 text-center text-[12.5px] text-slate-400">Aún no hay cargas. Registra la primera con el botón superior.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="flex items-start gap-2 mt-5 text-[11.5px] text-slate-400 leading-relaxed">
        <lucide-icon [img]="infoIcon" [size]="13" class="mt-0.5 shrink-0" />
        <p>
          Para el rendimiento real registra cada carga con el <strong class="font-semibold text-slate-500">odómetro</strong> y marcando
          <strong class="font-semibold text-slate-500">tanque lleno</strong>. Las cargas parciales se suman al siguiente llenado.
          Si no hay odómetro, se usa la distancia de las posiciones GPS como aproximación.
        </p>
      </div>
    </div>

    <!-- ═══════════ MODAL: REGISTRAR CARGA ═══════════ -->
    @if (showLogForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] fade-in-up" (click)="showLogForm.set(false)">
        <div class="card w-full max-w-md p-6 shadow-2xl max-h-[92dvh] overflow-y-auto" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between mb-5">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-100 flex items-center justify-center">
                <lucide-icon [img]="fuelIcon" [size]="16" />
              </div>
              <div>
                <h3 class="text-[15px] font-bold text-slate-900 tracking-tight">Registrar carga</h3>
                <p class="text-[11.5px] text-slate-500 mt-0.5">Datos del vale o ticket del grifo.</p>
              </div>
            </div>
            <button type="button" class="p-1.5 -mr-1.5 -mt-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" (click)="showLogForm.set(false)" aria-label="Cerrar">
              <lucide-icon [img]="closeIcon" [size]="18" />
            </button>
          </div>

          <form class="space-y-4" (ngSubmit)="saveLog()">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="input-label" for="veh">Unidad</label>
                <select id="veh" class="select" [(ngModel)]="logForm.vehicle_id" (ngModelChange)="logVehicle.set($event); logForm.nav_route_id = ''" name="vehicle" required>
                  @for (v of vehicleOptions(); track v.id) {
                    <option [value]="v.id">{{ v.placa }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="input-label" for="fecha">Fecha y hora</label>
                <input id="fecha" type="datetime-local" class="input tnum" [(ngModel)]="logForm.fecha" name="fecha" required />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="input-label" for="gal">Galones</label>
                <input id="gal" type="number" min="0.1" step="0.01" class="input tnum" [(ngModel)]="logForm.galones" name="galones" placeholder="60" required />
              </div>
              <div>
                <label class="input-label" for="monto">Monto total (S/)</label>
                <input id="monto" type="number" min="0" step="0.01" class="input tnum" [(ngModel)]="logForm.monto" name="monto" placeholder="990.00" required />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="input-label" for="odo">Odómetro (km)</label>
                <input id="odo" type="number" min="0" step="1" class="input tnum" [(ngModel)]="logForm.odometro_km" name="odometro" placeholder="142850" />
              </div>
              <div>
                <label class="input-label" for="grifo">Grifo</label>
                <input id="grifo" class="input" [(ngModel)]="logForm.grifo" name="grifo" placeholder="Primax Panamericana" />
              </div>
            </div>
            @if (routesForVehicle().length) {
              <div>
                <label class="input-label" for="ruta">Ruta (opcional)</label>
                <select id="ruta" class="select" [(ngModel)]="logForm.nav_route_id" name="ruta">
                  <option value="">Sin ruta</option>
                  @for (r of routesForVehicle(); track r.id) {
                    <option [value]="r.id">{{ r.routeLabel }}</option>
                  }
                </select>
              </div>
            }
            <label class="flex items-start gap-2.5 p-3 rounded-lg ring-1 ring-slate-200 cursor-pointer hover:bg-slate-50 transition">
              <input type="checkbox" class="mt-0.5 accent-[#0b1220]" [(ngModel)]="logForm.tanque_lleno" name="lleno" />
              <span>
                <span class="block text-[12.5px] font-semibold text-slate-700">Tanque lleno</span>
                <span class="block text-[11.5px] text-slate-400">Necesario para medir el rendimiento real entre dos llenados.</span>
              </span>
            </label>
            @if (logForm.galones && logForm.monto) {
              <p class="text-[11.5px] text-slate-500 tnum">Precio por galón: S/ {{ (logForm.monto / logForm.galones) | number: '1.2-2' }}</p>
            }
            <div class="flex gap-2.5 pt-1">
              <button type="button" class="flex-1 py-2.5 rounded-lg ring-1 ring-slate-200 text-slate-600 text-[13px] font-semibold hover:bg-slate-50 transition" (click)="showLogForm.set(false)">Cancelar</button>
              <button type="submit" class="flex-[1.4] py-2.5 rounded-lg bg-[#0b1220] hover:bg-[#16233b] text-white text-[13px] font-semibold transition active:scale-[0.99] shadow-sm disabled:opacity-50" [disabled]="saving()">
                {{ saving() ? 'Guardando...' : 'Guardar carga' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- ═══════════ MODAL: RENDIMIENTO DE REFERENCIA ═══════════ -->
    @if (refVehicle(); as rv) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] fade-in-up" (click)="refVehicle.set(null)">
        <div class="card w-full max-w-sm p-6 shadow-2xl" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between mb-5">
            <div>
              <h3 class="text-[15px] font-bold text-slate-900 tracking-tight">Rendimiento de <span class="font-mono">{{ rv.placa }}</span></h3>
              <p class="text-[11.5px] text-slate-500 mt-0.5">Se usa para estimar el consumo de cada ruta.</p>
            </div>
            <button type="button" class="p-1.5 -mr-1.5 -mt-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" (click)="refVehicle.set(null)" aria-label="Cerrar">
              <lucide-icon [img]="closeIcon" [size]="18" />
            </button>
          </div>
          <form class="space-y-4" (ngSubmit)="saveRef()">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="input-label" for="rend">Km por galón</label>
                <input id="rend" type="number" min="0.1" step="0.1" class="input tnum" [(ngModel)]="refForm.rendimiento" name="rend" placeholder="9.5" />
              </div>
              <div>
                <label class="input-label" for="tank">Tanque (gal)</label>
                <input id="tank" type="number" min="1" step="1" class="input tnum" [(ngModel)]="refForm.tanque" name="tank" placeholder="110" />
              </div>
            </div>
            @if (rv.rendimientoReal) {
              <button type="button" class="text-[12px] font-semibold text-blue-600 hover:text-blue-700" (click)="refForm.rendimiento = rv.rendimientoReal">
                Usar el rendimiento real medido ({{ rv.rendimientoReal }} km/gal)
              </button>
            }
            <div class="flex gap-2.5 pt-1">
              <button type="button" class="flex-1 py-2.5 rounded-lg ring-1 ring-slate-200 text-slate-600 text-[13px] font-semibold hover:bg-slate-50 transition" (click)="refVehicle.set(null)">Cancelar</button>
              <button type="submit" class="flex-[1.4] py-2.5 rounded-lg bg-[#0b1220] hover:bg-[#16233b] text-white text-[13px] font-semibold transition disabled:opacity-50" [disabled]="saving()">
                {{ saving() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class ConsumoPageComponent implements OnInit {
  readonly fuel = inject(FuelService);
  readonly auth = inject(AuthService);
  private readonly fleet = inject(FleetService);

  readonly plusIcon = Plus;
  readonly fuelIcon = Fuel;
  readonly closeIcon = X;
  readonly pencilIcon = Pencil;
  readonly trashIcon = Trash2;
  readonly alertIcon = AlertTriangle;
  readonly alertCircleIcon = AlertCircle;
  readonly infoIcon = Info;

  readonly days = signal(30);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly showLogForm = signal(false);
  readonly refVehicle = signal<FuelVehicleRow | null>(null);
  precioManual: number | null = null;

  logForm: LogForm = this.emptyLogForm();
  refForm: { rendimiento: number | null; tanque: number | null } = { rendimiento: null, tanque: null };

  readonly summary = this.fuel.summary;
  readonly rows = computed<FuelVehicleRow[]>(() => this.summary()?.vehiculos ?? []);
  readonly routes = computed<FuelRouteRow[]>(() => this.summary()?.rutas ?? []);
  readonly lowRows = computed(() => this.rows().filter((v) => v.estado === 'bajo'));
  readonly vehicleOptions = computed(() => this.rows().map((v) => ({ id: v.vehicleId, placa: v.placa })));
  readonly logVehicle = signal('');
  readonly routesForVehicle = computed(() => {
    const placa = this.rows().find((v) => v.vehicleId === this.logVehicle())?.placa;
    return this.routes().filter((r) => !placa || r.placa === placa);
  });

  readonly kpis = computed(() => {
    const t = this.summary()?.totales;
    const precio = this.summary()?.precioGalonRef;
    return [
      { label: 'Gasto en combustible', value: t ? this.money(t.gasto) : '—', hint: t ? `${t.cargas} cargas` : '', icon: Coins, iconCls: 'bg-amber-50 text-amber-600 ring-amber-100' },
      { label: 'Galones', value: t ? this.num(t.galones, 0) : '—', hint: precio ? `S/ ${precio} por galón` : '', icon: Fuel, iconCls: 'bg-blue-50 text-blue-600 ring-blue-100' },
      { label: 'Km recorridos', value: t ? this.num(t.km, 0) : '—', hint: 'odómetro o GPS', icon: Route, iconCls: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
      { label: 'Costo por km', value: t?.costoKm ? this.money(t.costoKm) : '—', hint: 'solo combustible', icon: Gauge, iconCls: 'bg-slate-100 text-slate-600 ring-slate-200' }
    ];
  });

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  setDays(d: number): void {
    this.days.set(Number(d));
    void this.reload();
  }

  async reload(): Promise<void> {
    try {
      await this.fuel.load(this.days(), this.precioManual);
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo cargar el consumo'));
    }
  }

  openLogForm(): void {
    this.logForm = this.emptyLogForm();
    this.logForm.vehicle_id = this.rows()[0]?.vehicleId ?? '';
    this.logVehicle.set(this.logForm.vehicle_id);
    this.showLogForm.set(true);
  }

  async saveLog(): Promise<void> {
    const f = this.logForm;
    this.logVehicle.set(f.vehicle_id);
    if (!f.vehicle_id || !f.galones || f.galones <= 0 || f.monto === null || f.monto < 0) {
      this.error.set('Completa unidad, galones y monto.');
      return;
    }
    this.saving.set(true);
    try {
      await this.fuel.createLog({
        vehicle_id: f.vehicle_id,
        galones: Number(f.galones),
        monto: Number(f.monto),
        fecha: f.fecha ? new Date(f.fecha).toISOString() : undefined,
        odometro_km: f.odometro_km !== null && f.odometro_km !== undefined && `${f.odometro_km}` !== '' ? Number(f.odometro_km) : null,
        tanque_lleno: f.tanque_lleno,
        grifo: f.grifo.trim() || undefined,
        nav_route_id: f.nav_route_id || null,
        notas: f.notas.trim() || undefined
      });
      this.showLogForm.set(false);
      await this.reload();
      void this.fleet.load(true);
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo registrar la carga'));
    } finally {
      this.saving.set(false);
    }
  }

  async removeLog(l: FuelLog): Promise<void> {
    if (!window.confirm(`¿Eliminar la carga de ${l.placa} por ${this.money(l.monto)}?`)) return;
    try {
      await this.fuel.deleteLog(l.id);
      await this.reload();
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo eliminar la carga'));
    }
  }

  openRefForm(v: FuelVehicleRow): void {
    this.refForm = { rendimiento: v.rendimientoRef, tanque: v.tanqueGal };
    this.refVehicle.set(v);
  }

  async saveRef(): Promise<void> {
    const v = this.refVehicle();
    if (!v) return;
    const rend = this.refForm.rendimiento ? Number(this.refForm.rendimiento) : null;
    const tank = this.refForm.tanque ? Number(this.refForm.tanque) : null;
    this.saving.set(true);
    try {
      await this.fuel.updateEfficiency(v.vehicleId, rend, tank);
      this.refVehicle.set(null);
      await this.reload();
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo guardar el rendimiento'));
    } finally {
      this.saving.set(false);
    }
  }

  estadoLabel(v: FuelVehicleRow): string {
    if (v.estado === 'bajo') return 'Bajo rendimiento';
    if (v.estado === 'ok') return 'Normal';
    return 'Sin datos';
  }

  estadoBadge(v: FuelVehicleRow): string {
    if (v.estado === 'bajo') return 'badge-danger';
    if (v.estado === 'ok') return 'badge-success';
    return 'badge-neutral';
  }

  money(n: number): string {
    return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  num(n: number, decimals = 1): string {
    return n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
  }

  abs(n: number | null): number {
    return Math.abs(n ?? 0);
  }

  private emptyLogForm(): LogForm {
    return {
      vehicle_id: '',
      fecha: nowLocalInput(),
      galones: null,
      monto: null,
      odometro_km: null,
      tanque_lleno: true,
      grifo: '',
      nav_route_id: '',
      notas: ''
    };
  }
}
