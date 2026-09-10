import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  effect,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import { fromEvent } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import {
  AlertTriangle,
  Crosshair,
  Gauge,
  LucideAngularModule,
  MapPin,
  RefreshCw,
  Search,
  Truck,
  User,
  X
} from 'lucide-angular';
import { SAMPLE_ROUTES } from '../../core/data/seed.data';
import { FleetService } from '../../core/services/fleet.service';
import { LayoutService } from '../../core/services/layout.service';
import { Vehicle } from '../../core/models/vehicle.model';
import {
  bindVehicleTooltip,
  buildTruckIcon,
  createOsmMap,
  vehicleStatusInfo
} from '../../core/utils/map.utils';

type LiveFilter = 'all' | 'ok' | 'warn' | 'alert';

@Component({
  standalone: true,
  selector: 'app-mapa-vivo-page',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="p-3 sm:p-4 lg:p-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">

        <!-- ═══════════ PANEL LATERAL ═══════════ -->
        <aside class="lg:col-span-4 xl:col-span-3 card flex flex-col overflow-hidden anim-in" style="max-height: calc(100vh - 9rem)">

          <div class="p-4 border-b border-slate-200/80">
            <div class="flex items-start justify-between gap-2 mb-3.5">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100 flex items-center justify-center shrink-0">
                  <lucide-icon [img]="truckIcon" [size]="17" />
                </div>
                <div class="min-w-0">
                  <h2 class="text-[15px] font-semibold text-slate-900 tracking-tight">Flota en vivo</h2>
                  <p class="text-[11.5px] text-slate-500 mt-0.5">
                    <span class="tnum font-medium text-slate-600">{{ fleet.count() }}</span> vehículos monitoreados
                  </p>
                </div>
              </div>
              @if (fleet.loading()) {
                <span class="shrink-0 inline-flex items-center gap-1 text-[10.5px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                  <lucide-icon [img]="refreshIcon" [size]="10" class="animate-spin" />Sync
                </span>
              }
            </div>

            <!-- Buscador -->
            <div class="relative mb-3">
              <lucide-icon [img]="searchIcon" [size]="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                class="w-full h-9 pl-9 pr-8 rounded-lg text-[12.5px] text-slate-900 bg-slate-50/70
                       border border-slate-200/90 placeholder:text-slate-400 transition-all duration-200 outline-none
                       hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/[0.09]"
                placeholder="Buscar placa, conductor o ruta..."
                [(ngModel)]="query"
                name="query"
              />
              @if (query) {
                <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition" (click)="query = ''" aria-label="Limpiar">
                  <lucide-icon [img]="closeIcon" [size]="12" />
                </button>
              }
            </div>

            <!-- Filtros -->
            <div class="flex items-center gap-1.5 flex-wrap">
              @for (f of filters; track f.key) {
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1.5 rounded-lg transition-all duration-150 active:scale-95"
                  [class]="activeFilter() === f.key
                    ? 'bg-[#0b1220] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
                  (click)="setFilter(f.key)"
                >
                  @if (f.dot) {
                    <span class="w-1.5 h-1.5 rounded-full" [class]="activeFilter() === f.key ? f.dot : f.dot + ' opacity-70'"></span>
                  }
                  {{ f.label }}
                  <span class="tnum text-[10.5px] px-1 rounded"
                        [class]="activeFilter() === f.key ? 'bg-white/15' : 'bg-white/70 text-slate-500'">
                    {{ countFor(f.key) }}
                  </span>
                </button>
              }
            </div>
          </div>

          <!-- Lista -->
          <div class="flex-1 overflow-y-auto p-2 space-y-1">
            @for (v of filteredVehicles(); track v.placa; let i = $index) {
              <button
                type="button"
                class="vehicle-item list-in w-full text-left p-3 pl-3.5 rounded-xl border border-transparent
                       hover:bg-slate-50 hover:border-slate-200"
                [class.is-selected]="selectedPlaca() === v.placa"
                [class.bg-blue-50/60]="selectedPlaca() === v.placa"
                [class.border-blue-200]="selectedPlaca() === v.placa"
                [style.animation-delay.ms]="i * 35"
                (click)="focusVehicle(v)"
              >
                <div class="flex items-start justify-between gap-2 mb-1.5">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="w-2 h-2 rounded-full shrink-0 ring-2 ring-white" [class]="statusInfo(v.estado).dot"></span>
                    <strong class="text-[13.5px] font-semibold text-slate-900 tracking-tight truncate">{{ v.placa }}</strong>
                    @if (v.velocidad > 0) {
                      <span class="relative flex w-1.5 h-1.5 shrink-0" title="GPS en vivo">
                        <span class="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                        <span class="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      </span>
                    }
                  </div>
                  <span class="badge shrink-0" [class]="statusInfo(v.estado).badge">{{ statusInfo(v.estado).label }}</span>
                </div>

                <div class="flex items-center gap-1.5 text-[12px] text-slate-600 mb-1.5">
                  <lucide-icon [img]="userIcon" [size]="11" class="text-slate-400 shrink-0" />
                  <span class="truncate">{{ v.conductor }}</span>
                </div>

                <div class="flex items-center justify-between gap-2 text-[11.5px] mb-2">
                  <span class="flex items-center gap-1 text-slate-500 min-w-0">
                    <lucide-icon [img]="mapPinIcon" [size]="11" class="shrink-0" />
                    <span class="truncate">{{ v.ruta }}</span>
                  </span>
                  <span class="font-semibold tnum shrink-0 tabular-nums" [class]="v.velocidad > 0 ? 'text-emerald-600' : 'text-slate-400'">
                    {{ v.velocidad }} km/h
                  </span>
                </div>

                <!-- Barra de velocidad -->
                <div class="h-1 rounded-full bg-slate-100 overflow-hidden mb-2">
                  <div class="h-full rounded-full speed-bar transition-[width] duration-500"
                       [class]="speedColor(v.velocidad)"
                       [style.width.%]="speedPct(v.velocidad)"></div>
                </div>

                <div class="text-[10.5px] text-slate-400 font-mono tnum">{{ v.lat.toFixed(4) }}, {{ v.lng.toFixed(4) }}</div>
              </button>
            } @empty {
              <div class="py-14 text-center">
                <div class="w-12 h-12 rounded-xl bg-slate-50 ring-1 ring-slate-200/70 flex items-center justify-center mx-auto mb-3">
                  <lucide-icon [img]="searchIcon" [size]="19" class="text-slate-300" />
                </div>
                <p class="text-[13px] font-medium text-slate-600">Sin resultados</p>
                <p class="text-[11.5px] text-slate-400 mt-1 px-6 leading-relaxed">
                  {{ query ? 'Prueba con otro término de búsqueda.' : 'No hay vehículos en este filtro.' }}
                </p>
              </div>
            }
          </div>

          <!-- Footer -->
          <div class="px-3.5 py-3 border-t border-slate-200/80 bg-slate-50/50 flex items-center justify-between gap-2">
            <span class="flex items-center gap-2 text-[11.5px] text-slate-500">
              <span class="relative flex w-1.5 h-1.5">
                <span class="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                <span class="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              </span>
              <span class="font-medium">Tiempo real</span>
            </span>
            <button
              type="button"
              class="group inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-blue-600 hover:text-blue-800
                     px-2 py-1 rounded-md hover:bg-blue-50 transition disabled:opacity-50"
              [disabled]="fleet.loading()"
              (click)="refreshNow()"
            >
              <lucide-icon [img]="refreshIcon" [size]="12"
                           class="transition-transform duration-500 group-hover:rotate-180"
                           [class.animate-spin]="fleet.loading()" />
              Actualizar
            </button>
          </div>
        </aside>

        <!-- ═══════════ MAPA ═══════════ -->
        <div class="lg:col-span-8 xl:col-span-9 card overflow-hidden relative anim-in" style="animation-delay: 90ms">

          @if (fleet.loadError()) {
            <div class="absolute top-3 left-3 right-3 z-[1000] flex items-start gap-2 rounded-lg bg-red-50 ring-1 ring-red-200 text-red-700 text-[12.5px] p-3 msg-in">
              <lucide-icon [img]="alertIcon" [size]="14" class="mt-0.5 shrink-0" />
              <p class="leading-snug">{{ fleet.loadError() }}</p>
            </div>
          }

          <!-- Leyenda flotante -->
          <div class="absolute top-3 right-3 z-[500] flex items-center gap-1 p-1 rounded-lg bg-white/90 backdrop-blur ring-1 ring-slate-200 shadow-sm">
            @for (l of legend; track l.label) {
              <span class="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-slate-600">
                <span class="w-1.5 h-1.5 rounded-full" [class]="l.dot"></span>{{ l.label }}
              </span>
            }
          </div>

          <!-- Vehículo enfocado -->
          @if (selectedVehicle(); as sv) {
            <div class="absolute bottom-3 left-3 z-[500] max-w-[280px] rounded-xl bg-white/95 backdrop-blur ring-1 ring-slate-200 shadow-lg p-3.5 msg-in">
              <div class="flex items-start justify-between gap-3 mb-2">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-2 h-2 rounded-full shrink-0" [class]="statusInfo(sv.estado).dot"></span>
                  <strong class="text-[13.5px] font-bold text-slate-900 tracking-tight truncate">{{ sv.placa }}</strong>
                </div>
                <button type="button" class="shrink-0 w-5 h-5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition" (click)="clearSelection()" aria-label="Cerrar">
                  <lucide-icon [img]="closeIcon" [size]="12" />
                </button>
              </div>
              <p class="text-[12px] text-slate-600 truncate">{{ sv.conductor }}</p>
              <p class="text-[11.5px] text-slate-400 truncate mt-0.5">{{ sv.ruta }}</p>
              <div class="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-slate-100 text-[11.5px]">
                <span class="flex items-center gap-1 text-slate-500">
                  <lucide-icon [img]="gaugeIcon" [size]="11" />
                  <span class="font-semibold tnum text-slate-700">{{ sv.velocidad }}</span> km/h
                </span>
                <button type="button" class="ml-auto inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 transition" (click)="focusVehicle(sv)">
                  <lucide-icon [img]="crosshairIcon" [size]="11" />Centrar
                </button>
              </div>
            </div>
          }

          <div #mapEl class="w-full" style="height: calc(100vh - 9rem); min-height: 480px"></div>
        </div>
      </div>
    </div>
  `
})
export class MapaVivoPageComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly fleet = inject(FleetService);
  private readonly layout = inject(LayoutService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;

  readonly mapPinIcon = MapPin;
  readonly truckIcon = Truck;
  readonly searchIcon = Search;
  readonly refreshIcon = RefreshCw;
  readonly closeIcon = X;
  readonly userIcon = User;
  readonly gaugeIcon = Gauge;
  readonly crosshairIcon = Crosshair;
  readonly alertIcon = AlertTriangle;

  readonly statusInfo = vehicleStatusInfo;

  readonly filters: { key: LiveFilter; label: string; dot: string }[] = [
    { key: 'all', label: 'Todos', dot: '' },
    { key: 'ok', label: 'En ruta', dot: 'bg-emerald-500' },
    { key: 'warn', label: 'Detenidos', dot: 'bg-amber-500' },
    { key: 'alert', label: 'Alertas', dot: 'bg-red-500' }
  ];

  readonly legend = [
    { label: 'En ruta', dot: 'bg-emerald-500' },
    { label: 'Detenido', dot: 'bg-amber-500' },
    { label: 'Alerta', dot: 'bg-red-500' }
  ];

  readonly activeFilter = signal<LiveFilter>('all');
  readonly selectedPlaca = signal<string | null>(null);
  query = '';

  private map: L.Map | null = null;
  private readonly markers = new Map<string, L.Marker>();
  private unsubscribeRealtime: (() => void) | null = null;
  private stopPolling: (() => void) | null = null;
  private didFitBounds = false;

  constructor() {
    effect(() => {
      this.fleet.vehicles();
      this.refreshMarkers();
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeRealtime?.();
    this.stopPolling?.();
    this.fleet.stopPolling();
    this.map?.remove();
    this.map = null;
  }

  ngOnInit(): void {
    this.layout.setPage('Mapa en Vivo', 'Posición y telemetría de la flota en tiempo real');
  }

  async ngAfterViewInit(): Promise<void> {
    await this.fleet.load(true);
    this.initMap();
    this.unsubscribeRealtime = this.fleet.subscribeToPositions(() => {
      this.refreshMarkers();
    });
    this.stopPolling = this.fleet.startPolling(8_000);
    fromEvent(window, 'resize')
      .pipe(startWith(null), debounceTime(150), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.map?.invalidateSize());
  }

  async refreshNow(): Promise<void> {
    await this.fleet.load(true);
  }

  setFilter(key: LiveFilter): void {
    this.activeFilter.set(key);
  }

  countFor(key: LiveFilter): number {
    return this.fleet.filterLive(key).length;
  }

  filteredVehicles(): Vehicle[] {
    const base = this.fleet.filterLive(this.activeFilter());
    const q = this.query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (v) =>
        v.placa.toLowerCase().includes(q) ||
        (v.conductor ?? '').toLowerCase().includes(q) ||
        (v.ruta ?? '').toLowerCase().includes(q)
    );
  }

  selectedVehicle(): Vehicle | null {
    const placa = this.selectedPlaca();
    if (!placa) return null;
    return this.fleet.vehicles().find((v) => v.placa === placa) ?? null;
  }

  clearSelection(): void {
    this.selectedPlaca.set(null);
  }

  speedPct(velocidad: number): number {
    return Math.min(100, Math.round((velocidad / 100) * 100));
  }

  speedColor(velocidad: number): string {
    if (velocidad === 0) return 'bg-slate-300';
    if (velocidad > 90) return 'bg-red-500';
    if (velocidad > 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  focusVehicle(v: Vehicle): void {
    if (!this.map) return;
    this.selectedPlaca.set(v.placa);
    this.map.flyTo([v.lat, v.lng], 14, { duration: 1.2 });
    this.markers.get(v.placa)?.openTooltip();
  }

  private initMap(): void {
    const vehicles = this.fleet.vehicles();
    const center: [number, number] =
      vehicles.length > 0 ? [vehicles[0].lat, vehicles[0].lng] : [-9.19, -75.0];
    const zoom = vehicles.length > 0 ? 6 : 5;

    this.map = createOsmMap(this.mapEl.nativeElement, center, zoom);
    this.refreshMarkers();

    for (const r of SAMPLE_ROUTES) {
      L.polyline(r.coords, { color: r.color, weight: 3, opacity: 0.6, dashArray: '6 8' }).addTo(this.map);
    }

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private refreshMarkers(): void {
    if (!this.map) return;

    const vehicles = this.fleet.vehicles();
    const activePlacas = new Set(vehicles.map((v) => v.placa));

    for (const [placa, marker] of this.markers) {
      if (!activePlacas.has(placa)) {
        marker.remove();
        this.markers.delete(placa);
      }
    }

    for (const v of vehicles) {
      const pos: L.LatLngExpression = [v.lat, v.lng];
      const existing = this.markers.get(v.placa);
      if (existing) {
        existing.setLatLng(pos);
        existing.setIcon(buildTruckIcon(v.estado));
        bindVehicleTooltip(existing, v);
      } else {
        const m = L.marker(pos, { icon: buildTruckIcon(v.estado) }).addTo(this.map);
        bindVehicleTooltip(m, v);
        this.markers.set(v.placa, m);
      }
    }

    if (!this.didFitBounds && vehicles.length > 0) {
      const bounds = L.latLngBounds(vehicles.map((v) => [v.lat, v.lng] as L.LatLngTuple));
      this.map.fitBounds(bounds.pad(0.15));
      this.didFitBounds = true;
    }
  }
}
