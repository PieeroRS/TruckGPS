import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  Gauge,
  LucideAngularModule,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  User,
  X
} from 'lucide-angular';
import { AuthService } from '../../auth/auth.service';
import { Vehicle, VehicleStatus } from '../../core/models/vehicle.model';
import { FleetService, VehicleUpsert } from '../../core/services/fleet.service';
import { LayoutService } from '../../core/services/layout.service';
import { formatDate, formatKm, vehicleStatusInfo } from '../../core/utils/map.utils';

@Component({
  standalone: true,
  selector: 'app-flota-page',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">

      <!-- ═══════════ ENCABEZADO ═══════════ -->
      <div class="flex items-end justify-between flex-wrap gap-4 mb-6 anim-in">
        <div>
          <h2 class="text-[22px] font-bold text-slate-900 tracking-[-0.03em] leading-tight">Flota completa</h2>
          <p class="text-[13px] text-slate-500 mt-1.5">Alta, edición y baja de vehículos.</p>
        </div>
        @if (auth.isStaff()) {
          <button type="button" class="group inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0b1220] hover:bg-[#16233b] text-white text-[12.5px] font-semibold transition-all active:scale-[0.98] shadow-[0_1px_2px_rgba(11,18,32,0.25),0_6px_16px_-8px_rgba(11,18,32,0.5)]" (click)="openCreate()">
            <lucide-icon [img]="plusIcon" [size]="14" class="transition-transform duration-300 group-hover:rotate-90" />Agregar vehículo
          </button>
        }
      </div>

      <!-- ═══════════ RESUMEN ═══════════ -->
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        @for (s of summary(); track s.label; let i = $index) {
          <div class="kpi group anim-in" [style.animation-delay.ms]="i * 55">
            <div class="flex items-start justify-between">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center ring-1 transition-transform duration-200 group-hover:scale-105" [class]="s.iconCls">
                <lucide-icon [img]="s.icon" [size]="16" [strokeWidth]="2" />
              </div>
            </div>
            <div class="text-[26px] font-bold tracking-[-0.03em] leading-none mt-3 tnum" [class]="s.cls">{{ s.value }}</div>
            <div class="text-[11.5px] uppercase font-semibold tracking-wider text-slate-400 mt-1.5">{{ s.label }}</div>
          </div>
        }
      </section>

      <!-- ═══════════ FILTROS ═══════════ -->
      <div class="card p-4 mb-5 anim-in" style="animation-delay: 120ms">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div class="md:col-span-7">
            <label class="input-label">Buscar</label>
            <div class="relative">
              <lucide-icon [img]="searchIcon" [size]="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input type="text" class="input pl-9 pr-8" placeholder="Placa, conductor, modelo..." [(ngModel)]="busqueda" (ngModelChange)="refresh()" />
              @if (busqueda) {
                <button type="button" class="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition" (click)="clearSearch()" aria-label="Limpiar">
                  <lucide-icon [img]="closeIcon" [size]="12" />
                </button>
              }
            </div>
          </div>
          <div class="md:col-span-5">
            <label class="input-label">Estado</label>
            <select class="select" [(ngModel)]="estado" (ngModelChange)="refresh()">
              <option value="todos">Todos ({{ countFor('todos') }})</option>
              <option value="ok">En ruta ({{ countFor('ok') }})</option>
              <option value="warn">Detenido ({{ countFor('warn') }})</option>
              <option value="alert">Alerta ({{ countFor('alert') }})</option>
              <option value="offline">Offline ({{ countFor('offline') }})</option>
            </select>
          </div>
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

      <!-- ═══════════ TABLA ═══════════ -->
      <div class="card overflow-hidden anim-in" style="animation-delay: 180ms">
        <div class="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between gap-3">
          <p class="text-[12.5px] text-slate-500">
            <span class="font-semibold text-slate-700 tnum">{{ filtered().length }}</span>
            vehículo{{ filtered().length === 1 ? '' : 's' }}
          </p>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-slate-50/70 border-b border-slate-200 text-[10.5px] uppercase tracking-[0.08em] text-slate-400">
              <tr>
                <th class="px-4 py-3 font-semibold">Vehículo</th>
                <th class="px-4 py-3 font-semibold">Conductor</th>
                <th class="px-4 py-3 font-semibold">Estado</th>
                <th class="px-4 py-3 font-semibold">Ruta</th>
                <th class="px-4 py-3 font-semibold">Kilometraje</th>
                <th class="px-4 py-3 font-semibold">Próx. mant.</th>
                <th class="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-[13px]">
              @for (v of filtered(); track v.placa; let i = $index) {
                <tr class="fleet-row row-slide hover:bg-slate-50/70" [style.animation-delay.ms]="i * 35">
                  <td class="px-4 py-3.5">
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-1" [class]="iconCls(v.estado)">
                        <lucide-icon [img]="truckIcon" [size]="16" />
                      </div>
                      <div class="min-w-0">
                        <div class="font-semibold font-mono text-slate-900 tracking-tight">{{ v.placa }}</div>
                        <div class="text-[11.5px] text-slate-400 truncate">{{ v.modelo }}</div>
                      </div>
                    </div>
                  </td>

                  <td class="px-4 py-3.5">
                    <span class="flex items-center gap-1.5 text-slate-600">
                      <lucide-icon [img]="userIcon" [size]="12" class="text-slate-300 shrink-0" />
                      <span class="truncate">{{ v.conductor }}</span>
                    </span>
                  </td>

                  <td class="px-4 py-3.5">
                    <span class="badge inline-flex items-center gap-1.5" [class]="statusInfo(v.estado).badge">
                      <span class="w-1.5 h-1.5 rounded-full" [class]="statusInfo(v.estado).dot"></span>
                      {{ statusInfo(v.estado).label }}
                    </span>
                  </td>

                  <td class="px-4 py-3.5 text-slate-500">{{ v.ruta || '—' }}</td>

                  <td class="px-4 py-3.5">
                    <div class="font-mono tnum text-slate-700 font-medium">{{ fmtKm(v.km) }}</div>
                    <div class="h-1 w-20 rounded-full bg-slate-100 overflow-hidden mt-1.5">
                      <div class="h-full rounded-full transition-[width] duration-500" [class]="kmColor(v.km)" [style.width.%]="kmPct(v.km)"></div>
                    </div>
                  </td>

                  <td class="px-4 py-3.5">
                    <span class="inline-flex items-center gap-1.5 text-[12px] tnum" [class]="mantCls(v.proxMant)">
                      @if (mantSoon(v.proxMant)) {
                        <lucide-icon [img]="alertIcon" [size]="11" class="shrink-0" />
                      }
                      {{ fmtDate(v.proxMant) }}
                    </span>
                  </td>

                  <td class="px-4 py-3.5 text-right">
                    @if (auth.isStaff()) {
                      <div class="flex items-center justify-end gap-1.5">
                        <button type="button" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 transition active:scale-95" (click)="openEdit(v)">
                          <lucide-icon [img]="pencilIcon" [size]="11" />Editar
                        </button>
                        <button type="button" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold text-red-600 ring-1 ring-red-200 bg-red-50/60 hover:bg-red-100 hover:ring-red-300 transition active:scale-95" (click)="remove(v)">
                          <lucide-icon [img]="trashIcon" [size]="11" />Eliminar
                        </button>
                      </div>
                    } @else {
                      <span class="text-[11.5px] text-slate-300">—</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="px-6 py-16 text-center">
                    <div class="w-14 h-14 rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 flex items-center justify-center mx-auto mb-4">
                      <lucide-icon [img]="truckIcon" [size]="22" class="text-slate-300" />
                    </div>
                    <p class="text-[14px] font-semibold text-slate-700">Sin vehículos</p>
                    <p class="text-[12.5px] text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
                      {{ busqueda || estado !== 'todos' ? 'Ningún vehículo coincide con los filtros.' : 'Agrega tu primera unidad con el botón superior.' }}
                    </p>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ═══════════ MODAL ═══════════ -->
    @if (showForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] fade-in-up" (click)="closeForm()">
        <div class="card w-full max-w-md p-6 shadow-2xl" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between mb-5">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100 flex items-center justify-center">
                <lucide-icon [img]="truckIcon" [size]="16" />
              </div>
              <div>
                <h3 class="text-[15px] font-bold text-slate-900 tracking-tight">{{ editingId() ? 'Editar vehículo' : 'Nuevo vehículo' }}</h3>
                <p class="text-[11.5px] text-slate-500 mt-0.5">Datos de la unidad y su estado operativo.</p>
              </div>
            </div>
            <button type="button" class="p-1.5 -mr-1.5 -mt-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" (click)="closeForm()" aria-label="Cerrar">
              <lucide-icon [img]="closeIcon" [size]="18" />
            </button>
          </div>

          <form class="space-y-4" (ngSubmit)="save($event)">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="input-label">Placa</label>
                <input class="input font-mono uppercase" [(ngModel)]="form.placa" name="placa" placeholder="ABC-123" required />
              </div>
              <div>
                <label class="input-label">Modelo</label>
                <input class="input" [(ngModel)]="form.modelo" name="modelo" placeholder="Volvo FH16" required />
              </div>
            </div>

            <div>
              <label class="input-label">Estado operativo</label>
              <div class="grid grid-cols-4 gap-2">
                @for (e of estadoOpts; track e.value) {
                  <button type="button" (click)="form.estado = e.value" class="py-2 rounded-lg text-[11.5px] font-semibold ring-1 transition active:scale-95 flex flex-col items-center gap-1" [class]="form.estado === e.value ? e.active : 'ring-slate-200 text-slate-500 hover:bg-slate-50'">
                    <span class="w-1.5 h-1.5 rounded-full" [class]="form.estado === e.value ? e.dot : 'bg-slate-300'"></span>
                    {{ e.label }}
                  </button>
                }
              </div>
            </div>

            <div>
              <label class="input-label">Ruta asignada</label>
              <input class="input" [(ngModel)]="form.ruta" name="ruta" placeholder="Lima → Trujillo" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="input-label">Kilometraje</label>
                <input type="number" class="input tnum" [(ngModel)]="form.kilometraje" name="km" placeholder="0" required />
              </div>
              <div>
                <label class="input-label">Próx. mantenimiento</label>
                <input type="date" class="input tnum" [(ngModel)]="form.prox_mantenimiento" name="mant" required />
              </div>
            </div>

            <div class="flex gap-2.5 pt-1">
              <button type="button" class="flex-1 py-2.5 rounded-lg ring-1 ring-slate-200 text-slate-600 text-[13px] font-semibold hover:bg-slate-50 transition" (click)="closeForm()">
                Cancelar
              </button>
              <button type="submit" class="flex-[1.4] py-2.5 rounded-lg bg-[#0b1220] hover:bg-[#16233b] text-white text-[13px] font-semibold transition active:scale-[0.99] shadow-sm disabled:opacity-50 disabled:active:scale-100" [disabled]="saving()">
                {{ saving() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class FlotaPageComponent implements OnInit {
  readonly fleet = inject(FleetService);
  readonly auth = inject(AuthService);
  private readonly layout = inject(LayoutService);

  readonly plusIcon = Plus;
  readonly searchIcon = Search;
  readonly truckIcon = Truck;
  readonly pencilIcon = Pencil;
  readonly trashIcon = Trash2;
  readonly closeIcon = X;
  readonly userIcon = User;
  readonly alertIcon = AlertTriangle;
  readonly alertCircleIcon = AlertCircle;
  readonly gaugeIcon = Gauge;
  readonly calendarIcon = CalendarClock;

  readonly statusInfo = vehicleStatusInfo;
  readonly fmtKm = formatKm;
  readonly fmtDate = formatDate;

  readonly estadoOpts = [
    { value: 'ok' as VehicleStatus, label: 'En ruta', active: 'ring-emerald-300 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
    { value: 'warn' as VehicleStatus, label: 'Detenido', active: 'ring-amber-300 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
    { value: 'alert' as VehicleStatus, label: 'Alerta', active: 'ring-red-300 bg-red-50 text-red-700', dot: 'bg-red-500' },
    { value: 'offline' as VehicleStatus, label: 'Offline', active: 'ring-slate-300 bg-slate-100 text-slate-600', dot: 'bg-slate-400' }
  ];

  estado: VehicleStatus | 'todos' = 'todos';
  busqueda = '';
  readonly filteredList = signal<Vehicle[]>([]);
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  form: VehicleUpsert = this.emptyForm();

  ngOnInit(): void {
    this.layout.setPage('Flota', 'Gestión CRUD de vehículos');
    void this.fleet.load().then(() => this.refresh());
  }

  filtered(): Vehicle[] {
    return this.filteredList();
  }

  countFor(key: VehicleStatus | 'todos'): number {
    const all = this.fleet.vehicles();
    return key === 'todos' ? all.length : all.filter((v) => v.estado === key).length;
  }

  summary() {
    return [
      { label: 'Total flota', value: this.countFor('todos'), cls: 'text-slate-900', icon: Truck, iconCls: 'bg-slate-100 text-slate-600 ring-slate-200' },
      { label: 'En ruta', value: this.countFor('ok'), cls: 'text-emerald-600', icon: Gauge, iconCls: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
      { label: 'Con alerta', value: this.countFor('alert'), cls: 'text-red-600', icon: AlertTriangle, iconCls: 'bg-red-50 text-red-600 ring-red-100' },
      { label: 'Mant. próximo', value: this.mantCount(), cls: 'text-amber-600', icon: CalendarClock, iconCls: 'bg-amber-50 text-amber-600 ring-amber-100' }
    ];
  }

  private mantCount(): number {
    return this.fleet.vehicles().filter((v) => this.mantSoon(v.proxMant)).length;
  }

  mantSoon(iso: string): boolean {
    if (!iso) return false;
    const days = (new Date(iso).getTime() - Date.now()) / 86400000;
    return days <= 30;
  }

  mantCls(iso: string): string {
    if (!iso) return 'text-slate-300';
    const days = (new Date(iso).getTime() - Date.now()) / 86400000;
    if (days < 0) return 'text-red-600 font-semibold';
    if (days <= 30) return 'text-amber-600 font-semibold';
    return 'text-slate-500';
  }

  kmPct(km: number): number {
    return Math.min(100, Math.round((km / 200000) * 100));
  }

  kmColor(km: number): string {
    if (km > 150000) return 'bg-red-500';
    if (km > 100000) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  iconCls(estado: VehicleStatus): string {
    return ({
      ok: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
      warn: 'bg-amber-50 text-amber-600 ring-amber-100',
      alert: 'bg-red-50 text-red-600 ring-red-100',
      offline: 'bg-slate-100 text-slate-400 ring-slate-200'
    } as Record<string, string>)[estado] ?? 'bg-slate-100 text-slate-500 ring-slate-200';
  }

  clearSearch(): void {
    this.busqueda = '';
    this.refresh();
  }

  refresh(): void {
    this.filteredList.set(this.fleet.filter(this.estado, this.busqueda));
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form = this.emptyForm();
    this.showForm.set(true);
  }

  openEdit(v: Vehicle): void {
    if (!v.id) return;
    this.editingId.set(v.id);
    this.form = {
      placa: v.placa,
      modelo: v.modelo,
      estado: v.estado,
      ruta: v.ruta,
      kilometraje: v.km,
      prox_mantenimiento: v.proxMant,
      lat: v.lat,
      lng: v.lng
    };
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  async save(e: Event): Promise<void> {
    e.preventDefault();
    this.saving.set(true);
    this.error.set(null);
    try {
      const id = this.editingId();
      if (id) await this.fleet.update(id, this.form);
      else await this.fleet.create(this.form);
      this.closeForm();
      this.refresh();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(v: Vehicle): Promise<void> {
    if (!v.id || !confirm(`¿Eliminar vehículo ${v.placa}?`)) return;
    try {
      await this.fleet.delete(v.id);
      this.refresh();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  private emptyForm(): VehicleUpsert {
    return {
      placa: '',
      modelo: '',
      estado: 'ok',
      ruta: '',
      kilometraje: 0,
      prox_mantenimiento: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
    };
  }
}