import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Pencil, Plus, Search, Trash2, Truck, X } from 'lucide-angular';
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
    <div class="p-4 sm:p-6 lg:p-8">
      <div class="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 class="text-lg sm:text-xl font-bold text-slate-900">Flota completa</h2>
          <p class="text-xs text-slate-500 mt-1">Alta, edición y baja de vehículos.</p>
        </div>
        @if (auth.isStaff()) {
          <button type="button" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition" (click)="openCreate()">
            <lucide-icon [img]="plusIcon" [size]="14" />Agregar vehículo
          </button>
        }
      </div>

      <div class="card p-4 mb-5">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div class="md:col-span-7">
            <label class="input-label">Buscar</label>
            <div class="relative">
              <lucide-icon [img]="searchIcon" [size]="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" class="input pl-9" placeholder="Placa, conductor, modelo..." [(ngModel)]="busqueda" (ngModelChange)="refresh()" />
            </div>
          </div>
          <div class="md:col-span-5">
            <label class="input-label">Estado</label>
            <select class="select" [(ngModel)]="estado" (ngModelChange)="refresh()">
              <option value="todos">Todos</option>
              <option value="ok">En ruta</option>
              <option value="warn">Detenido</option>
              <option value="alert">Alerta</option>
              <option value="offline">Offline</option>
            </select>
          </div>
        </div>
      </div>

      @if (error()) {
        <p class="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2 mb-4">{{ error() }}</p>
      }

      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-4 py-3 font-semibold">Vehículo</th>
                <th class="px-4 py-3 font-semibold">Conductor</th>
                <th class="px-4 py-3 font-semibold">Estado</th>
                <th class="px-4 py-3 font-semibold">Ruta</th>
                <th class="px-4 py-3 font-semibold">Km</th>
                <th class="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-sm">
              @if (filtered().length === 0) {
                <tr><td colspan="6" class="px-6 py-10 text-center text-sm text-slate-500">Sin vehículos. Agrega uno con el botón superior.</td></tr>
              }
              @for (v of filtered(); track v.placa) {
                <tr class="hover:bg-slate-50 transition">
                  <td class="px-4 py-3.5">
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center"><lucide-icon [img]="truckIcon" [size]="16" /></div>
                      <div>
                        <div class="font-semibold font-mono">{{ v.placa }}</div>
                        <div class="text-[11px] text-slate-500">{{ v.modelo }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3.5">{{ v.conductor }}</td>
                  <td class="px-4 py-3.5"><span class="badge" [class]="statusInfo(v.estado).badge">{{ statusInfo(v.estado).label }}</span></td>
                  <td class="px-4 py-3.5 text-slate-600">{{ v.ruta }}</td>
                  <td class="px-4 py-3.5 font-mono">{{ fmtKm(v.km) }}</td>
                  <td class="px-4 py-3.5 text-right">
                    @if (auth.isStaff()) {
                      <div class="flex items-center justify-end gap-2">
                        <button type="button" class="text-blue-700 text-xs font-semibold flex items-center gap-1" (click)="openEdit(v)">
                          <lucide-icon [img]="pencilIcon" [size]="12" />Editar
                        </button>
                        <button type="button" class="text-red-600 text-xs font-semibold flex items-center gap-1" (click)="remove(v)">
                          <lucide-icon [img]="trashIcon" [size]="12" />Eliminar
                        </button>
                      </div>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    @if (showForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" (click)="closeForm()">
        <div class="card w-full max-w-md p-5" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold">{{ editingId() ? 'Editar vehículo' : 'Nuevo vehículo' }}</h3>
            <button type="button" (click)="closeForm()"><lucide-icon [img]="closeIcon" [size]="18" /></button>
          </div>
          <form class="space-y-3" (ngSubmit)="save($event)">
            <div><label class="input-label">Placa</label><input class="input font-mono" [(ngModel)]="form.placa" name="placa" required /></div>
            <div><label class="input-label">Modelo</label><input class="input" [(ngModel)]="form.modelo" name="modelo" required /></div>
            <div><label class="input-label">Estado</label>
              <select class="select" [(ngModel)]="form.estado" name="estado">
                <option value="ok">En ruta</option><option value="warn">Detenido</option><option value="alert">Alerta</option><option value="offline">Offline</option>
              </select>
            </div>
            <div><label class="input-label">Ruta</label><input class="input" [(ngModel)]="form.ruta" name="ruta" placeholder="Lima → Trujillo" /></div>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="input-label">Kilometraje</label><input type="number" class="input" [(ngModel)]="form.kilometraje" name="km" required /></div>
              <div><label class="input-label">Próx. mant.</label><input type="date" class="input" [(ngModel)]="form.prox_mantenimiento" name="mant" required /></div>
            </div>
            <button type="submit" class="w-full py-2.5 rounded-md bg-slate-900 text-white text-sm font-semibold" [disabled]="saving()">
              {{ saving() ? 'Guardando...' : 'Guardar' }}
            </button>
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
  readonly statusInfo = vehicleStatusInfo;
  readonly fmtKm = formatKm;

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
