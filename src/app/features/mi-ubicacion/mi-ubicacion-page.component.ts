import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertCircle,
  Check,
  Loader2,
  LocateFixed,
  LucideAngularModule,
  MapPin,
  Navigation,
  Power,
  Truck,
  User
} from 'lucide-angular';
import { AuthService } from '../../auth/auth.service';
import { LocationTrackingService, VehicleOption } from '../../core/services/location-tracking.service';
import { LayoutService } from '../../core/services/layout.service';

@Component({
  standalone: true,
  selector: 'app-mi-ubicacion-page',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="p-3 sm:p-6 lg:p-8 flex justify-center">
      <div class="w-full max-w-md space-y-5">
        <div class="bg-[#0f172a] text-white rounded-xl p-5 fade-in-up">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
              <lucide-icon [img]="userIcon" [size]="20" />
            </div>
            <div class="min-w-0">
              <div class="text-sm font-semibold truncate">{{ displayName() }}</div>
              <div class="text-[11px] text-slate-400">{{ roleLabel() }}</div>
            </div>
            @if (tracking.active()) {
              <span class="ml-auto badge badge-success shrink-0">En vivo</span>
            } @else {
              <span class="ml-auto badge shrink-0">GPS apagado</span>
            }
          </div>
          @if (tracking.active() && tracking.vehiclePlaca()) {
            <div class="text-[11px] text-slate-300 flex items-center gap-1.5">
              <lucide-icon [img]="truckIcon" [size]="12" />
              <span class="font-mono">{{ tracking.vehiclePlaca() }}</span>
              <span class="text-slate-500">·</span>
              <span>{{ selectedRuta() }}</span>
            </div>
          }
        </div>

        <div class="card p-4 fade-in-up">
          <label class="input-label flex items-center gap-1.5 mb-2">
            <lucide-icon [img]="truckIcon" [size]="14" />
            Vehículo en el que viajas
          </label>
          @if (loadingVehicles()) {
            <div class="text-xs text-slate-500 flex items-center gap-2 py-2">
              <lucide-icon [img]="loaderIcon" [size]="14" class="animate-spin" />
              Cargando flota...
            </div>
          } @else {
            <select
              class="select"
              [(ngModel)]="selectedVehicleId"
              name="vehicle"
              [disabled]="tracking.active() || vehicles().length === 0"
              required
            >
              <option value="">Selecciona tu unidad...</option>
              @for (v of vehicles(); track v.id) {
                <option [value]="v.id" [disabled]="v.ocupado">
                  {{ v.placa }} · {{ v.modelo }}{{ v.ocupado ? ' (ocupado)' : '' }}
                </option>
              }
            </select>
            @if (vehicles().length === 0) {
              <p class="text-xs text-amber-700 mt-2">No hay vehículos disponibles. Verifica tu sesión en Supabase.</p>
            }
            @if (selectedVehicle(); as sel) {
              <p class="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                <lucide-icon [img]="mapPinIcon" [size]="11" />
                Ruta: {{ sel.ruta }}
                @if (sel.conductorNombre && !sel.esMio) {
                  · Asignado a {{ sel.conductorNombre }}
                }
              </p>
            }
          }
        </div>

        @if (tracking.active()) {
          <div class="card p-4 fade-in-up space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-700">Ubicación compartida</span>
              @if (tracking.syncing()) {
                <span class="text-[11px] text-blue-600 flex items-center gap-1">
                  <lucide-icon [img]="loaderIcon" [size]="12" class="animate-spin" /> Enviando...
                </span>
              } @else if (tracking.lastSync()) {
                <span class="text-[11px] text-emerald-600 flex items-center gap-1">
                  <lucide-icon [img]="checkIcon" [size]="12" /> Sincronizado
                </span>
              }
            </div>
            <div class="grid grid-cols-2 gap-3 text-center">
              <div class="rounded-lg bg-slate-50 p-3">
                <div class="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Velocidad</div>
                <div class="text-lg font-semibold text-slate-900">{{ tracking.speedKmh() }} <span class="text-xs font-normal text-slate-500">km/h</span></div>
              </div>
              <div class="rounded-lg bg-slate-50 p-3">
                <div class="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Último envío</div>
                <div class="text-sm font-semibold text-slate-900">{{ lastSyncLabel() }}</div>
              </div>
            </div>
            @if (tracking.lat() !== null && tracking.lng() !== null) {
              <p class="text-[11px] text-slate-500 font-mono text-center">
                {{ tracking.lat()!.toFixed(5) }}, {{ tracking.lng()!.toFixed(5) }}
              </p>
            }
            <div class="flex flex-wrap items-center justify-center gap-2 text-[11px]">
              @if (tracking.background()) {
                <span class="badge badge-warning">Segundo plano</span>
              } @else {
                <span class="badge badge-success">Pestaña activa</span>
              }
              @if (tracking.wakeLockHeld()) {
                <span class="badge badge-info">Pantalla activa</span>
              }
            </div>
            <p class="text-[11px] text-slate-500 text-center leading-relaxed">
              Tu posición aparece en <strong>Mapa en Vivo</strong>. Puedes salir a otras pantallas de TruckGPS:
              el GPS sigue enviando. En el celular, deja la app abierta o en segundo plano con permiso de ubicación.
            </p>
          </div>

          <button
            type="button"
            class="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 font-semibold py-4 hover:bg-red-100 transition"
            [disabled]="stopping()"
            (click)="deactivate()"
          >
            @if (stopping()) {
              <lucide-icon [img]="loaderIcon" [size]="18" class="animate-spin" />
            } @else {
              <lucide-icon [img]="powerIcon" [size]="18" />
            }
            Detener ubicación en vivo
          </button>
        } @else {
          <button
            type="button"
            class="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white font-semibold py-4 hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            [disabled]="!selectedVehicleId || starting()"
            (click)="activate()"
          >
            @if (starting()) {
              <lucide-icon [img]="loaderIcon" [size]="20" class="animate-spin" />
              Activando GPS...
            } @else {
              <lucide-icon [img]="navIcon" [size]="20" />
              Activar ubicación en vivo
            }
          </button>
          <p class="text-center text-[11px] text-slate-500 -mt-2 leading-relaxed">
            Se pedirá permiso de ubicación. Elige <strong>Permitir mientras se usa la app</strong>
            (o siempre) para que el seguimiento continúe al cambiar de pantalla.
          </p>
        }

        @if (tracking.error()) {
          <div class="rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs p-3 flex items-start gap-2 fade-in-up">
            <lucide-icon [img]="alertIcon" [size]="16" class="shrink-0 mt-0.5" />
            <span>{{ tracking.error() }}</span>
          </div>
        }

        <div class="card p-4 bg-blue-50/60 border-blue-100 fade-in-up">
          <div class="flex items-start gap-2 text-xs text-blue-900">
            <lucide-icon [img]="locateIcon" [size]="16" class="shrink-0 mt-0.5 text-blue-600" />
            <div class="leading-relaxed space-y-1.5">
              <p>
                <strong>Conductor en ruta:</strong> elige el camión y activa el GPS.
                El seguimiento sigue al navegar dentro de TruckGPS y se reanuda al volver a la app.
              </p>
              <p class="text-blue-800/80">
                Si cierras por completo el navegador, al abrir TruckGPS de nuevo se reactivará
                automáticamente (mismo teléfono y misma cuenta).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class MiUbicacionPageComponent implements OnInit, OnDestroy {
  readonly tracking = inject(LocationTrackingService);
  private readonly layout = inject(LayoutService);
  private readonly auth = inject(AuthService);

  readonly userIcon = User;
  readonly truckIcon = Truck;
  readonly mapPinIcon = MapPin;
  readonly navIcon = Navigation;
  readonly powerIcon = Power;
  readonly loaderIcon = Loader2;
  readonly checkIcon = Check;
  readonly alertIcon = AlertCircle;
  readonly locateIcon = LocateFixed;

  readonly vehicles = signal<VehicleOption[]>([]);
  readonly loadingVehicles = signal(true);
  readonly starting = signal(false);
  readonly stopping = signal(false);

  selectedVehicleId = '';

  ngOnInit(): void {
    this.layout.setPage('Mi Ubicación', 'Comparte tu posición en vivo con el centro de control');
    void this.loadVehicles();
    void this.tracking.resumeIfNeeded();
  }

  ngOnDestroy(): void {
    // El tracking sigue activo al salir de la página (conductor en ruta).
  }

  displayName(): string {
    return this.auth.profile()?.full_name ?? 'Conductor';
  }

  roleLabel(): string {
    const role = this.auth.profile()?.role;
    if (role === 'supervisor') return 'Supervisor · modo conductor';
    if (role === 'admin') return 'Administrador';
    return 'Conductor';
  }

  selectedVehicle(): VehicleOption | undefined {
    return this.vehicles().find((v) => v.id === this.selectedVehicleId);
  }

  selectedRuta(): string {
    return this.selectedVehicle()?.ruta ?? '—';
  }

  lastSyncLabel(): string {
    const d = this.tracking.lastSync();
    if (!d) return '—';
    return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  async loadVehicles(): Promise<void> {
    this.loadingVehicles.set(true);
    try {
      const list = await this.tracking.loadVehicleOptions();
      this.vehicles.set(list);

      const activeId = this.tracking.vehicleId();
      if (activeId) {
        this.selectedVehicleId = activeId;
      } else {
        const mine = list.find((v) => v.esMio);
        if (mine) this.selectedVehicleId = mine.id;
      }
    } catch (e) {
      this.tracking.error.set(e instanceof Error ? e.message : 'Error al cargar vehículos');
    } finally {
      this.loadingVehicles.set(false);
    }
  }

  async activate(): Promise<void> {
    const v = this.selectedVehicle();
    if (!v || v.ocupado) return;

    this.starting.set(true);
    const result = await this.tracking.start(v.id, v.placa);
    this.starting.set(false);

    if (!result.ok && result.error) {
      this.tracking.error.set(result.error);
    }
  }

  async deactivate(): Promise<void> {
    this.stopping.set(true);
    await this.tracking.stop(true);
    this.stopping.set(false);
    await this.loadVehicles();
  }
}
