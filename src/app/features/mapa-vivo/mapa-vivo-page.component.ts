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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import { fromEvent } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import { LucideAngularModule, MapPin } from 'lucide-angular';
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
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="p-3 sm:p-4 lg:p-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <aside class="lg:col-span-4 xl:col-span-3 card flex flex-col" style="max-height: calc(100vh - 9rem)">
          <div class="p-4 border-b border-slate-200">
            <div class="flex items-center justify-between mb-3">
              <div>
                <h2 class="text-sm font-semibold text-slate-900">Flota en vivo</h2>
                <p class="text-[11px] text-slate-500">{{ fleet.count() }} vehículos</p>
              </div>
              @if (fleet.loading()) {
                <span class="text-[10px] text-blue-600 animate-pulse">Actualizando...</span>
              }
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
              @for (f of filters; track f.key) {
                <button
                  type="button"
                  class="text-[11px] font-semibold px-2.5 py-1 rounded-full transition"
                  [class]="activeFilter() === f.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
                  (click)="setFilter(f.key)"
                >{{ f.label }}</button>
              }
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-2 space-y-1">
            @for (v of filteredVehicles(); track v.placa) {
              <button
                type="button"
                class="w-full text-left p-3 rounded-lg hover:bg-slate-50 transition border border-transparent hover:border-slate-200 fade-in-up"
                (click)="focusVehicle(v)"
              >
                <div class="flex items-start justify-between gap-2 mb-1">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full" [class]="statusInfo(v.estado).dot"></span>
                    <strong class="text-sm font-semibold text-slate-900">{{ v.placa }}</strong>
                    @if (v.velocidad > 0) {
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="GPS en vivo"></span>
                    }
                  </div>
                  <span class="badge" [class]="statusInfo(v.estado).badge">{{ statusInfo(v.estado).label }}</span>
                </div>
                <div class="text-xs text-slate-600 mb-1">{{ v.conductor }}</div>
                <div class="flex items-center justify-between text-[11px] text-slate-500">
                  <span class="flex items-center gap-1">
                    <lucide-icon [img]="mapPinIcon" [size]="11" />
                    {{ v.ruta }}
                  </span>
                  <span class="font-semibold" [class]="v.velocidad > 0 ? 'text-emerald-600' : 'text-slate-500'">{{ v.velocidad }} km/h</span>
                </div>
                <div class="text-[10px] text-slate-400 font-mono mt-1">{{ v.lat.toFixed(4) }}, {{ v.lng.toFixed(4) }}</div>
              </button>
            }
            @if (filteredVehicles().length === 0) {
              <div class="text-xs text-slate-500 text-center py-8">Sin vehículos en este filtro.</div>
            }
          </div>

          <div class="p-3 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between gap-2">
            <span class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Tiempo real
            </span>
            <button type="button" class="text-blue-700 font-semibold hover:underline" (click)="refreshNow()">Actualizar</button>
          </div>
        </aside>

        <div class="lg:col-span-8 xl:col-span-9 card overflow-hidden relative">
          @if (fleet.loadError()) {
            <div class="absolute top-3 left-3 right-3 z-[1000] rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs p-2">
              {{ fleet.loadError() }}
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
  readonly statusInfo = vehicleStatusInfo;

  readonly filters: { key: LiveFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'ok', label: 'En ruta' },
    { key: 'warn', label: 'Detenidos' },
    { key: 'alert', label: 'Alertas' }
  ];

  readonly activeFilter = signal<LiveFilter>('all');

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

  filteredVehicles(): Vehicle[] {
    return this.fleet.filterLive(this.activeFilter());
  }

  focusVehicle(v: Vehicle): void {
    if (!this.map) return;
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
