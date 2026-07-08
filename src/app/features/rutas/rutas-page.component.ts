import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import {
  ArrowLeftRight,
  Loader2,
  LucideAngularModule,
  MapPin,
  Navigation,
  Route,
  Truck
} from 'lucide-angular';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';
import {
  GeoPlace,
  NavRoute,
  NavRouteStatus,
  PERU_CITIES,
  RoutePlan,
  statusBadge,
  statusLabel
} from '../../core/models/route.model';
import { FleetService } from '../../core/services/fleet.service';
import { LayoutService } from '../../core/services/layout.service';
import { NavRoutesService } from '../../core/services/nav-routes.service';
import { RoutingService } from '../../core/services/routing.service';
import { createOsmMap } from '../../core/utils/map.utils';
import { supabaseErrorMessage } from '../../core/utils/supabase-error.util';

@Component({
  standalone: true,
  selector: 'app-rutas-page',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
      <!-- Panel estilo Uber / InDrive -->
      <aside class="w-full lg:w-[400px] xl:w-[420px] shrink-0 border-r border-slate-200 bg-white flex flex-col z-10 max-h-[45vh] lg:max-h-none overflow-hidden">
        <div class="p-4 border-b border-slate-100">
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <lucide-icon [img]="routeIcon" [size]="20" class="text-blue-600" />
            Planificar ruta
          </h2>
          <p class="text-xs text-slate-500 mt-1">Origen, destino y asignación de unidad — como InDrive o Uber.</p>
        </div>

        <div class="p-4 space-y-3 overflow-y-auto flex-1">
          <!-- Origen / Destino -->
          <div class="card p-3 space-y-2 relative">
            <div class="absolute left-[1.35rem] top-8 bottom-8 w-0.5 bg-slate-200"></div>

            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white z-10"></span>
              <input
                type="text"
                class="input pl-9 text-sm"
                placeholder="¿Desde dónde?"
                [(ngModel)]="originQuery"
                (ngModelChange)="onOriginSearch($event)"
                (focus)="activeField.set('origin')"
              />
              @if (originSuggestions().length && activeField() === 'origin') {
                <div class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
                  @for (p of originSuggestions(); track p.name) {
                    <button type="button" class="w-full text-left px-3 py-2 text-xs hover:bg-slate-50" (click)="pickOrigin(p)">{{ p.name }}</button>
                  }
                </div>
              }
            </div>

            <button
              type="button"
              class="absolute right-6 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center border border-slate-200"
              title="Intercambiar"
              (click)="swapPlaces()"
            >
              <lucide-icon [img]="swapIcon" [size]="14" />
            </button>

            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white z-10"></span>
              <input
                type="text"
                class="input pl-9 text-sm"
                placeholder="¿A dónde vas?"
                [(ngModel)]="destQuery"
                (ngModelChange)="onDestSearch($event)"
                (focus)="activeField.set('dest')"
              />
              @if (destSuggestions().length && activeField() === 'dest') {
                <div class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
                  @for (p of destSuggestions(); track p.name) {
                    <button type="button" class="w-full text-left px-3 py-2 text-xs hover:bg-slate-50" (click)="pickDest(p)">{{ p.name }}</button>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Ciudades rápidas -->
          <div>
            <p class="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Ciudades frecuentes</p>
            <div class="flex flex-wrap gap-1.5">
              @for (c of quickCities; track c.name) {
                <button
                  type="button"
                  class="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-100 hover:text-blue-800 text-slate-700 transition"
                  (click)="pickQuickCity(c)"
                >{{ c.name.split(',')[0] }}</button>
              }
            </div>
          </div>

          @if (planning()) {
            <div class="text-xs text-blue-600 flex items-center gap-2 py-2">
              <lucide-icon [img]="loaderIcon" [size]="14" class="animate-spin" /> Calculando ruta...
            </div>
          }

          @if (plan(); as p) {
            <div class="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 fade-in-up">
              <div class="text-sm font-semibold mb-3">{{ p.label }}</div>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div class="text-[10px] text-slate-400 uppercase">Distancia</div>
                  <div class="text-lg font-bold">{{ p.distanceKm }} <span class="text-xs font-normal">km</span></div>
                </div>
                <div>
                  <div class="text-[10px] text-slate-400 uppercase">Tiempo est.</div>
                  <div class="text-lg font-bold">{{ formatDuration(p.durationMin) }}</div>
                </div>
                <div>
                  <div class="text-[10px] text-slate-400 uppercase">Tarifa ref.</div>
                  <div class="text-lg font-bold">S/ {{ fare() }}</div>
                </div>
              </div>
            </div>
          }

          @if (plan()) {
            <div>
              <label class="input-label flex items-center gap-1">
                <lucide-icon [img]="truckIcon" [size]="14" /> Asignar vehículo (opcional)
              </label>
              <select class="select text-sm" [(ngModel)]="selectedVehicleId" name="vehicle">
                <option value="">Sin asignar — queda solicitada</option>
                @for (v of fleet.vehicles(); track v.placa) {
                  @if (v.id) {
                    <option [value]="v.id">{{ v.placa }} · {{ v.modelo }}</option>
                  }
                }
              </select>
            </div>

            <button
              type="button"
              class="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
              [disabled]="creating()"
              (click)="createRoute()"
            >
              @if (creating()) {
                <lucide-icon [img]="loaderIcon" [size]="18" class="animate-spin" />
              } @else {
                <lucide-icon [img]="navIcon" [size]="18" />
              }
              Solicitar ruta
            </button>
          }

          @if (navRoutes.tableMissing()) {
            <div class="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs p-3 leading-relaxed">
              <strong>Falta configurar Supabase:</strong> ejecuta el archivo
              <code class="text-[10px] bg-amber-100 px-1 rounded">supabase/migrations/006_nav_routes.sql</code>
              en Dashboard → SQL Editor → Run.
            </div>
          }

          @if (formError()) {
            <p class="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">{{ formError() }}</p>
          }

          <!-- Lista de rutas -->
          <div class="pt-2">
            <p class="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Rutas activas</p>
            @if (navRoutes.loading()) {
              <p class="text-xs text-slate-500">Cargando...</p>
            } @else if (navRoutes.routes().length === 0) {
              <p class="text-xs text-slate-500">No hay rutas creadas aún.</p>
            } @else {
              <div class="space-y-2">
                @for (r of navRoutes.routes(); track r.id) {
                  <div
                    class="rounded-lg border border-slate-200 p-3 hover:border-blue-300 transition cursor-pointer"
                    [class.ring-2]="selectedRouteId() === r.id"
                    [class.ring-blue-400]="selectedRouteId() === r.id"
                    (click)="showRouteOnMap(r)"
                  >
                    <div class="flex items-start justify-between gap-2 mb-1">
                      <strong class="text-sm text-slate-900">{{ r.routeLabel }}</strong>
                      <span class="badge text-[10px]" [class]="statusBadgeFn(r.status)">{{ statusLabelFn(r.status) }}</span>
                    </div>
                    <div class="text-[11px] text-slate-500 mb-2">
                      {{ r.distanceKm ?? '—' }} km · {{ formatDuration(r.durationMin ?? 0) }}
                      @if (r.vehiclePlaca) { · {{ r.vehiclePlaca }} }
                    </div>
                    @if (auth.isStaff()) {
                      <div class="flex flex-wrap gap-1.5">
                        @if (r.status === 'solicitada' || r.status === 'asignada') {
                          <button type="button" class="text-[10px] font-semibold px-2 py-1 rounded bg-emerald-100 text-emerald-800" (click)="setStatus(r, 'en-curso', $event)">Iniciar</button>
                        }
                        @if (r.status === 'en-curso') {
                          <button type="button" class="text-[10px] font-semibold px-2 py-1 rounded bg-blue-100 text-blue-800" (click)="setStatus(r, 'completada', $event)">Completar</button>
                        }
                        @if (r.status !== 'completada' && r.status !== 'cancelada') {
                          <button type="button" class="text-[10px] font-semibold px-2 py-1 rounded bg-red-100 text-red-800" (click)="cancelRoute(r, $event)">Cancelar</button>
                        }
                        <button type="button" class="text-[10px] font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700" (click)="deleteRoute(r, $event)">Eliminar</button>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </aside>

      <!-- Mapa -->
      <div class="flex-1 relative min-h-[55vh] lg:min-h-0">
        <div #mapEl class="absolute inset-0"></div>
        @if (!plan() && !selectedRouteId()) {
          <div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur px-4 py-2 rounded-full text-xs text-slate-600 shadow-lg border border-slate-200 flex items-center gap-2">
            <lucide-icon [img]="mapPinIcon" [size]="14" class="text-blue-600" />
            Elige origen y destino para ver la ruta
          </div>
        }
      </div>
    </div>
  `
})
export class RutasPageComponent implements OnInit, AfterViewInit {
  readonly auth = inject(AuthService);
  readonly fleet = inject(FleetService);
  readonly navRoutes = inject(NavRoutesService);
  private readonly routing = inject(RoutingService);
  private readonly layout = inject(LayoutService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;

  readonly routeIcon = Route;
  readonly swapIcon = ArrowLeftRight;
  readonly loaderIcon = Loader2;
  readonly navIcon = Navigation;
  readonly truckIcon = Truck;
  readonly mapPinIcon = MapPin;

  readonly quickCities = PERU_CITIES;
  readonly statusLabelFn = statusLabel;
  readonly statusBadgeFn = statusBadge;

  originQuery = '';
  destQuery = '';
  origin = signal<GeoPlace | null>(null);
  destination = signal<GeoPlace | null>(null);
  originSuggestions = signal<GeoPlace[]>([]);
  destSuggestions = signal<GeoPlace[]>([]);
  activeField = signal<'origin' | 'dest' | null>(null);

  readonly plan = signal<RoutePlan | null>(null);
  readonly planning = signal(false);
  readonly creating = signal(false);
  readonly formError = signal<string | null>(null);
  readonly selectedRouteId = signal<string | null>(null);

  selectedVehicleId = '';

  private map: L.Map | null = null;
  private routeLine: L.Polyline | null = null;
  private originMarker: L.CircleMarker | null = null;
  private destMarker: L.CircleMarker | null = null;
  private readonly originSearch$ = new Subject<string>();
  private readonly destSearch$ = new Subject<string>();

  ngOnInit(): void {
    this.layout.setPage('Rutas', 'Crea viajes de origen a destino y asígnalos a la flota');
    void this.fleet.load();
    void this.navRoutes.load();

    this.originSearch$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => void this.searchOrigin(q));

    this.destSearch$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => void this.searchDest(q));
  }

  async ngAfterViewInit(): Promise<void> {
    this.map = createOsmMap(this.mapEl.nativeElement, [-9.19, -75.0], 6);
    setTimeout(() => this.map?.invalidateSize(), 100);
  }

  onOriginSearch(q: string): void {
    this.originSearch$.next(q);
  }

  onDestSearch(q: string): void {
    this.destSearch$.next(q);
  }

  async searchOrigin(q: string): Promise<void> {
    if (q.length < 2) {
      this.originSuggestions.set([]);
      return;
    }
    try {
      this.originSuggestions.set(await this.routing.searchPlaces(q));
    } catch {
      this.originSuggestions.set([]);
    }
  }

  async searchDest(q: string): Promise<void> {
    if (q.length < 2) {
      this.destSuggestions.set([]);
      return;
    }
    try {
      this.destSuggestions.set(await this.routing.searchPlaces(q));
    } catch {
      this.destSuggestions.set([]);
    }
  }

  pickOrigin(p: GeoPlace): void {
    this.origin.set(p);
    this.originQuery = p.name;
    this.originSuggestions.set([]);
    this.activeField.set(null);
    void this.tryPlan();
  }

  pickDest(p: GeoPlace): void {
    this.destination.set(p);
    this.destQuery = p.name;
    this.destSuggestions.set([]);
    this.activeField.set(null);
    void this.tryPlan();
  }

  pickQuickCity(c: GeoPlace): void {
    if (!this.origin()) {
      this.pickOrigin(c);
    } else if (!this.destination()) {
      this.pickDest(c);
    } else {
      this.pickDest(c);
    }
  }

  swapPlaces(): void {
    const o = this.origin();
    const d = this.destination();
    if (!o || !d) return;
    this.origin.set(d);
    this.destination.set(o);
    this.originQuery = d.name;
    this.destQuery = o.name;
    void this.tryPlan();
  }

  async tryPlan(): Promise<void> {
    const o = this.origin();
    const d = this.destination();
    if (!o || !d) return;

    this.planning.set(true);
    this.formError.set(null);
    try {
      const p = await this.routing.planRoute(o, d);
      this.plan.set(p);
      this.drawPlan(p);
    } catch (e) {
      this.plan.set(null);
      this.formError.set(e instanceof Error ? e.message : 'Error al calcular ruta');
    } finally {
      this.planning.set(false);
    }
  }

  fare(): number {
    const p = this.plan();
    if (!p) return 0;
    return Math.round(p.distanceKm * 2.8 * 100) / 100;
  }

  formatDuration(min: number): string {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  async createRoute(): Promise<void> {
    const p = this.plan();
    const o = this.origin();
    const d = this.destination();
    if (!p || !o || !d) return;

    this.creating.set(true);
    this.formError.set(null);
    try {
      await this.auth.refreshProfile();

      const vehicleId = this.selectedVehicleId || null;

      const route = await this.navRoutes.create({
        origin: o,
        destination: d,
        plan: p,
        vehicleId
      });
      this.selectedRouteId.set(route.id);
      this.showRouteOnMap(route);
      await this.navRoutes.load();
      await this.fleet.load(true);
      this.origin.set(null);
      this.destination.set(null);
      this.originQuery = '';
      this.destQuery = '';
      this.plan.set(null);
      this.selectedVehicleId = '';
      this.clearMapOverlays();
    } catch (e) {
      this.formError.set(supabaseErrorMessage(e, 'No se pudo crear la ruta'));
    } finally {
      this.creating.set(false);
    }
  }

  showRouteOnMap(r: NavRoute): void {
    this.selectedRouteId.set(r.id);
    if (!this.map || !r.geometry?.length) {
      this.drawSimpleRoute(r);
      return;
    }
    this.drawPlan({
      origin: { name: r.originName, lat: r.originLat, lng: r.originLng },
      destination: { name: r.destName, lat: r.destLat, lng: r.destLng },
      label: r.routeLabel,
      distanceKm: r.distanceKm ?? 0,
      durationMin: r.durationMin ?? 0,
      coordinates: r.geometry
    });
  }

  async setStatus(r: NavRoute, status: NavRouteStatus, e: Event): Promise<void> {
    e.stopPropagation();
    try {
      await this.navRoutes.updateStatus(r.id, status);
    } catch (err) {
      this.formError.set(err instanceof Error ? err.message : 'Error');
    }
  }

  async cancelRoute(r: NavRoute, e: Event): Promise<void> {
    e.stopPropagation();
    await this.navRoutes.cancel(r.id);
  }

  async deleteRoute(r: NavRoute, e: Event): Promise<void> {
    e.stopPropagation();
    if (!confirm(`¿Eliminar ruta ${r.routeLabel}?`)) return;
    try {
      await this.navRoutes.delete(r.id);
      if (this.selectedRouteId() === r.id) {
        this.selectedRouteId.set(null);
        this.clearMapOverlays();
      }
    } catch (err) {
      this.formError.set(err instanceof Error ? err.message : 'Error');
    }
  }

  private drawPlan(p: RoutePlan): void {
    if (!this.map) return;
    this.clearMapOverlays();

    this.routeLine = L.polyline(p.coordinates, {
      color: '#2563eb',
      weight: 5,
      opacity: 0.85
    }).addTo(this.map);

    this.originMarker = L.circleMarker([p.origin.lat, p.origin.lng], {
      radius: 8,
      fillColor: '#10b981',
      color: '#fff',
      weight: 2,
      fillOpacity: 1
    }).addTo(this.map).bindTooltip('Origen', { permanent: false });

    this.destMarker = L.circleMarker([p.destination.lat, p.destination.lng], {
      radius: 8,
      fillColor: '#ef4444',
      color: '#fff',
      weight: 2,
      fillOpacity: 1
    }).addTo(this.map).bindTooltip('Destino', { permanent: false });

    this.map.fitBounds(this.routeLine.getBounds().pad(0.12));
  }

  private drawSimpleRoute(r: NavRoute): void {
    if (!this.map) return;
    this.clearMapOverlays();
    const coords: [number, number][] = [
      [r.originLat, r.originLng],
      [r.destLat, r.destLng]
    ];
    this.routeLine = L.polyline(coords, { color: '#2563eb', weight: 4, dashArray: '8 8' }).addTo(this.map);
    this.map.fitBounds(L.latLngBounds(coords).pad(0.2));
  }

  private clearMapOverlays(): void {
    this.routeLine?.remove();
    this.originMarker?.remove();
    this.destMarker?.remove();
    this.routeLine = null;
    this.originMarker = null;
    this.destMarker = null;
  }
}
