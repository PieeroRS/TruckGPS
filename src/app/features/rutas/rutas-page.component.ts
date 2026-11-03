import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import {
  ArrowLeftRight,
  Crosshair,
  Loader2,
  LocateFixed,
  LucideAngularModule,
  MapPin,
  MousePointerClick,
  Navigation,
  Route,
  Truck,
  X
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
  TrafficStatus,
  statusBadge,
  statusLabel
} from '../../core/models/route.model';
import { FleetService } from '../../core/services/fleet.service';
import { LayoutService } from '../../core/services/layout.service';
import { NavRoutesService } from '../../core/services/nav-routes.service';
import { RoutingService } from '../../core/services/routing.service';
import { createOsmMap } from '../../core/utils/map.utils';
import { apiErrorMessage } from '../../core/utils/api-error.util';

@Component({
  standalone: true,
  selector: 'app-rutas-page',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="h-[calc(var(--app-h)-4rem-env(safe-area-inset-top,0px))] flex flex-col lg:flex-row">
      <!-- Panel estilo Uber / InDrive -->
      <aside class="w-full lg:w-[400px] xl:w-[420px] shrink-0 border-r border-slate-200 bg-white flex flex-col z-10 max-h-[52%] lg:max-h-none overflow-hidden">
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
                class="input pl-9 text-sm text-ellipsis"
                style="padding-right: 5.5rem"
                [placeholder]="locating() ? 'Buscando tu ubicación…' : 'Desde: tu ubicación o dirección'"
                [(ngModel)]="originQuery"
                (ngModelChange)="onOriginSearch($event)"
                (focus)="activeField.set('origin')"
                (blur)="closeSuggestionsSoon('origin')"
              />
              <button
                type="button"
                class="absolute right-12 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center text-blue-600 bg-white hover:bg-blue-50 disabled:opacity-50"
                title="Usar mi ubicación actual"
                aria-label="Usar mi ubicación actual"
                [disabled]="locating()"
                (mousedown)="$event.preventDefault()"
                (click)="useMyLocation()"
              >
                <lucide-icon [img]="locateIcon" [size]="15" [class.animate-pulse]="locating()" />
              </button>
              @if (activeField() === 'origin') {
                <div class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-56 overflow-y-auto">
                  <button type="button" class="w-full text-left px-3 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-2" (mousedown)="$event.preventDefault()" (click)="useMyLocation()">
                    <lucide-icon [img]="locateIcon" [size]="14" /> Usar mi ubicación actual
                  </button>
                  <button type="button" class="w-full text-left px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100" (mousedown)="$event.preventDefault()" (click)="startMapPick('origin')">
                    <lucide-icon [img]="pickIcon" [size]="14" /> Elegir el punto en el mapa
                  </button>
                  @for (p of originSuggestions(); track p.name) {
                    <button type="button" class="w-full text-left px-3 py-2 text-xs hover:bg-slate-50" (mousedown)="$event.preventDefault()" (click)="pickOrigin(p)">{{ p.name }}</button>
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
                class="input pl-9 pr-12 text-sm"
                placeholder="¿A dónde vas?"
                [(ngModel)]="destQuery"
                (ngModelChange)="onDestSearch($event)"
                (focus)="activeField.set('dest')"
                (blur)="closeSuggestionsSoon('dest')"
              />
              @if (activeField() === 'dest') {
                <div class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-56 overflow-y-auto">
                  <button type="button" class="w-full text-left px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2" [class.border-b]="destSuggestions().length" [class.border-slate-100]="destSuggestions().length" (mousedown)="$event.preventDefault()" (click)="startMapPick('dest')">
                    <lucide-icon [img]="pickIcon" [size]="14" /> Elegir el punto en el mapa
                  </button>
                  @for (p of destSuggestions(); track p.name) {
                    <button type="button" class="w-full text-left px-3 py-2 text-xs hover:bg-slate-50" (mousedown)="$event.preventDefault()" (click)="pickDest(p)">{{ p.name }}</button>
                  }
                </div>
              }
            </div>
          </div>

          @if (originInfo(); as info) {
            <p class="text-[11px] -mt-1 flex items-start gap-1.5" [class]="info.warn ? 'text-amber-700' : 'text-slate-500'">
              <lucide-icon [img]="crosshairIcon" [size]="12" class="mt-0.5 shrink-0" />
              <span>{{ info.text }}</span>
            </p>
          }
          @if (plan()) {
            <p class="text-[11px] text-slate-500 -mt-1">Puedes arrastrar los puntos verde y rojo en el mapa para ajustar el origen o el destino.</p>
          }

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
              <div class="flex items-start justify-between gap-2 mb-3">
                <div class="text-sm font-semibold">{{ p.label }}</div>
                @if (p.trafficLevel) {
                  <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" [class]="trafficPill(p.trafficLevel)">{{ trafficLabel(p.trafficLevel) }}</span>
                }
              </div>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div class="text-[10px] text-slate-400 uppercase">Distancia</div>
                  <div class="text-lg font-bold">{{ p.distanceKm }} <span class="text-xs font-normal">km</span></div>
                </div>
                <div>
                  <div class="text-[10px] text-slate-400 uppercase">{{ p.durationTrafficMin != null ? 'Con tráfico' : 'Tiempo est.' }}</div>
                  <div class="text-lg font-bold">{{ formatDuration(p.durationTrafficMin ?? p.durationMin) }}</div>
                </div>
                <div>
                  <div class="text-[10px] text-slate-400 uppercase">Tarifa ref.</div>
                  <div class="text-lg font-bold">S/ {{ fare() }}</div>
                </div>
              </div>
              @if (p.durationTrafficMin != null) {
                <p class="text-[10.5px] text-slate-400 mt-2 leading-snug">
                  Sin tráfico: {{ formatDuration(p.durationMin) }} · estimado para {{ p.franja }}@if (p.eventos?.length) {; pasa por {{ p.eventos!.length }} evento(s) de tráfico (+{{ eventDelay(p) }} min)}.
                </p>
              }
            </div>

            @if (plans().length > 1) {
              <div>
                <p class="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Rutas alternativas ({{ plans().length }})</p>
                <div class="space-y-1.5">
                  @for (alt of plans(); track $index; let i = $index) {
                    <button
                      type="button"
                      class="w-full text-left rounded-lg border px-3 py-2 transition flex items-center gap-3"
                      [class]="selectedPlan() === i ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300' : 'border-slate-200 hover:border-slate-300'"
                      (click)="selectPlan(i)"
                    >
                      <span class="w-3 h-3 rounded-full shrink-0" [style.background]="altColor(i)"></span>
                      <span class="flex-1 min-w-0">
                        <span class="block text-[12.5px] font-semibold text-slate-900">
                          {{ formatDuration(alt.durationTrafficMin ?? alt.durationMin) }} · {{ alt.distanceKm }} km
                          @if (alt.recomendada) {
                            <span class="ml-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Más rápida</span>
                          }
                        </span>
                        <span class="block text-[11px] text-slate-500">
                          {{ i === 0 ? 'Ruta principal' : 'Alternativa ' + i }}
                          @if (alt.trafficLevel) { · tráfico {{ trafficLabel(alt.trafficLevel).toLowerCase() }} }
                          @if (alt.eventos?.length) { · {{ alt.eventos!.length }} evento(s) }
                        </span>
                      </span>
                    </button>
                  }
                </div>
              </div>
            }
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

          @if (formError()) {
            <p class="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">{{ formError() }}</p>
          }

          @if (traffic(); as t) {
            <div class="rounded-lg border border-slate-200 px-3 py-2 text-[11.5px] text-slate-600 flex items-start gap-2">
              <span class="w-2 h-2 rounded-full mt-1 shrink-0" [class]="t.nivel === 'congestionado' ? 'bg-red-500' : t.nivel === 'moderado' ? 'bg-amber-500' : 'bg-emerald-500'"></span>
              <span>
                Tráfico estimado en Lima: <strong>{{ trafficLabel(t.nivel).toLowerCase() }}</strong> ({{ t.franja }})
                @if (t.eventos.length) { · {{ t.eventos.length }} evento(s) activos en el mapa }
              </span>
            </div>
          }

          <!-- Lista de rutas -->
          <div class="pt-2">
            <p class="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Rutas ({{ navRoutes.routes().length }})</p>
            @if (navRoutes.loading()) {
              <p class="text-xs text-slate-500">Cargando...</p>
            } @else if (navRoutes.routes().length === 0) {
              <p class="text-xs text-slate-500">No hay rutas creadas aún. Elige origen y destino arriba para crear la primera.</p>
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
                    @if (r.status === 'en-curso') {
                      <div class="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-2">
                        <div class="h-full bg-emerald-500 transition-all duration-700" [style.width.%]="r.progressPct"></div>
                      </div>
                    }
                    @if (isSimLoop(r)) {
                      <p class="text-[10.5px] text-violet-700">Circuito permanente de la unidad de prueba. Se controla desde el Simulador.</p>
                    } @else if (auth.isStaff()) {
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
      <div class="flex-1 relative min-h-[220px] lg:min-h-0">
        <div #mapEl class="absolute inset-0" [class.cursor-crosshair]="pickMode()"></div>
        @if (pickMode(); as mode) {
          <div class="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-slate-900 text-white px-4 py-2 rounded-full text-xs shadow-lg flex items-center gap-2">
            <lucide-icon [img]="pickIcon" [size]="14" />
            Toca el mapa para elegir el {{ mode === 'origin' ? 'origen' : 'destino' }}
            <button type="button" class="ml-1 p-0.5 rounded-full hover:bg-white/20" aria-label="Cancelar" (click)="pickMode.set(null)">
              <lucide-icon [img]="xIcon" [size]="13" />
            </button>
          </div>
        }
        @if (!plan() && !selectedRouteId() && !pickMode()) {
          <div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur px-4 py-2 rounded-full text-xs text-slate-600 shadow-lg border border-slate-200 flex items-center gap-2">
            <lucide-icon [img]="mapPinIcon" [size]="14" class="text-blue-600" />
            Elige origen y destino para ver la ruta
          </div>
        }
      </div>
    </div>
  `
})
export class RutasPageComponent implements OnInit, AfterViewInit, OnDestroy {
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
  readonly locateIcon = LocateFixed;
  readonly pickIcon = MousePointerClick;
  readonly crosshairIcon = Crosshair;
  readonly xIcon = X;

  readonly locating = signal(false);
  readonly pickMode = signal<'origin' | 'dest' | null>(null);
  readonly originInfo = signal<{ text: string; warn: boolean } | null>(null);
  private blurTimer: ReturnType<typeof setTimeout> | null = null;

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

  readonly plans = signal<RoutePlan[]>([]);
  readonly selectedPlan = signal(0);
  readonly plan = computed<RoutePlan | null>(() => this.plans()[this.selectedPlan()] ?? null);
  readonly traffic = signal<TrafficStatus | null>(null);
  readonly planning = signal(false);
  readonly creating = signal(false);
  readonly formError = signal<string | null>(null);
  readonly selectedRouteId = signal<string | null>(null);

  selectedVehicleId = '';

  private map: L.Map | null = null;
  private routeLine: L.Polyline | null = null;
  private altLines: L.Polyline[] = [];
  private trafficLayer: L.LayerGroup | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private originMarker: L.Marker | null = null;
  private destMarker: L.Marker | null = null;
  private myLocationLayer: L.LayerGroup | null = null;
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
    this.trafficLayer = L.layerGroup().addTo(this.map);
    this.myLocationLayer = L.layerGroup().addTo(this.map);
    this.map.on('click', (e: L.LeafletMouseEvent) => void this.onMapClick(e.latlng.lat, e.latlng.lng));
    setTimeout(() => this.map?.invalidateSize(), 100);
    // «Desde» parte de tu ubicación actual, como en las apps de transporte.
    void this.autoLocateOrigin();
    void this.loadTraffic();
    // Progreso de rutas en curso y eventos de tráfico.
    this.poll = setInterval(() => {
      if (document.hidden) return;
      void this.navRoutes.load();
      void this.loadTraffic();
    }, 15000);
  }

  ngOnDestroy(): void {
    if (this.poll) clearInterval(this.poll);
    this.map?.remove();
    this.map = null;
  }

  private async loadTraffic(): Promise<void> {
    const t = await this.routing.trafficStatus();
    this.traffic.set(t);
    if (!this.trafficLayer) return;
    this.trafficLayer.clearLayers();
    for (const ev of t?.eventos ?? []) {
      const color = ev.nivel === 'bloqueo' ? '#7f1d1d' : ev.nivel === 'congestionado' ? '#dc2626' : '#f59e0b';
      L.circle([ev.lat, ev.lng], { radius: ev.radioM, color, weight: 2, fillColor: color, fillOpacity: 0.2, dashArray: '4 4' })
        .bindTooltip(`<strong>${ev.descripcion}</strong><br/>${ev.nivel}${ev.simulado ? ' · simulado' : ''}`)
        .addTo(this.trafficLayer);
    }
  }

  /** Si el permiso ya está concedido (o se puede pedir), el origen se llena solo con tu ubicación. */
  private async autoLocateOrigin(): Promise<void> {
    if (this.origin()) return;
    try {
      const perm = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
      if (perm && perm.state === 'denied') {
        this.originInfo.set({ text: 'La ubicación está bloqueada en este navegador: escribe el origen o elígelo en el mapa.', warn: true });
        return;
      }
    } catch {
      /* Safari antiguo sin Permissions API: se intenta directo */
    }
    await this.useMyLocation(true);
  }

  async useMyLocation(silent = false): Promise<void> {
    this.activeField.set(null);
    this.locating.set(true);
    if (!silent) this.originInfo.set(null);
    try {
      const pos = await this.routing.currentPosition();
      const calle = await this.routing.reverseGeocode(pos.lat, pos.lng);
      const place: GeoPlace = { name: `Mi ubicación · ${calle}`, lat: pos.lat, lng: pos.lng };
      this.origin.set(place);
      this.originQuery = place.name;
      this.originSuggestions.set([]);
      const acc = pos.accuracy >= 1000 ? `${(pos.accuracy / 1000).toFixed(1)} km` : `${pos.accuracy} m`;
      this.originInfo.set(
        pos.accuracy > 100
          ? { text: `Ubicación aproximada (±${acc}). Si no es tu punto exacto, arrastra el marcador verde o elígelo en el mapa.`, warn: true }
          : { text: `Ubicación actual con precisión de ±${acc}.`, warn: false }
      );
      this.drawMyLocation(pos.lat, pos.lng, pos.accuracy);
      if (this.destination()) await this.tryPlan();
    } catch (e) {
      if (!silent) this.originInfo.set({ text: e instanceof Error ? e.message : 'No se pudo obtener tu ubicación.', warn: true });
    } finally {
      this.locating.set(false);
    }
  }

  private drawMyLocation(lat: number, lng: number, acc: number): void {
    if (!this.map || !this.myLocationLayer) return;
    this.myLocationLayer.clearLayers();
    L.circle([lat, lng], { radius: acc, color: '#2563eb', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.12, interactive: false }).addTo(this.myLocationLayer);
    if (!this.plan()) {
      this.map.setView([lat, lng], acc > 1000 ? 13 : 15);
      this.drawPins();
    }
  }

  startMapPick(field: 'origin' | 'dest'): void {
    this.activeField.set(null);
    this.pickMode.set(field);
    const o = this.origin();
    if (this.map && o && this.map.getZoom() < 12) this.map.setView([o.lat, o.lng], 14);
  }

  private async onMapClick(lat: number, lng: number): Promise<void> {
    const mode = this.pickMode();
    if (!mode) return;
    this.pickMode.set(null);
    await this.setPoint(mode, lat, lng);
  }

  /** Fija origen o destino en un punto exacto (clic en el mapa o marcador arrastrado). */
  private async setPoint(field: 'origin' | 'dest', lat: number, lng: number): Promise<void> {
    const name = await this.routing.reverseGeocode(lat, lng);
    const place: GeoPlace = { name, lat, lng };
    if (field === 'origin') {
      this.origin.set(place);
      this.originQuery = name;
      this.originInfo.set({ text: 'Origen elegido en el mapa.', warn: false });
    } else {
      this.destination.set(place);
      this.destQuery = name;
    }
    if (this.origin() && this.destination()) await this.tryPlan();
    else this.drawPins();
  }

  closeSuggestionsSoon(field: 'origin' | 'dest'): void {
    if (this.blurTimer) clearTimeout(this.blurTimer);
    // Sólo se cierra si el foco no pasó al otro campo.
    this.blurTimer = setTimeout(() => {
      if (this.activeField() === field) this.activeField.set(null);
    }, 150);
  }

  private pinIcon(color: string, label: string): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `<div title="${label}" style="width:22px;height:22px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(15,23,42,.35);cursor:grab"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
  }

  /** Marcadores de origen/destino arrastrables para ajustar el punto a mano. */
  private drawPins(): void {
    if (!this.map) return;
    this.originMarker?.remove();
    this.destMarker?.remove();
    this.originMarker = this.destMarker = null;
    const o = this.origin();
    const d = this.destination();
    if (o) {
      this.originMarker = L.marker([o.lat, o.lng], { icon: this.pinIcon('#10b981', 'Origen'), draggable: true, zIndexOffset: 500 })
        .bindTooltip('Origen · arrástralo para ajustar')
        .on('dragend', (e) => {
          const ll = (e.target as L.Marker).getLatLng();
          void this.setPoint('origin', ll.lat, ll.lng);
        })
        .addTo(this.map);
    }
    if (d) {
      this.destMarker = L.marker([d.lat, d.lng], { icon: this.pinIcon('#ef4444', 'Destino'), draggable: true, zIndexOffset: 500 })
        .bindTooltip('Destino · arrástralo para ajustar')
        .on('dragend', (e) => {
          const ll = (e.target as L.Marker).getLatLng();
          void this.setPoint('dest', ll.lat, ll.lng);
        })
        .addTo(this.map);
    }
  }

  isSimLoop(r: NavRoute): boolean {
    return (r.notes ?? '').startsWith('[circuito-sim]');
  }

  altColor(i: number): string {
    return ['#2563eb', '#7c3aed', '#0d9488'][i] ?? '#64748b';
  }

  trafficLabel(level: string): string {
    return ({ fluido: 'Fluido', moderado: 'Moderado', congestionado: 'Congestionado' } as Record<string, string>)[level] ?? level;
  }

  trafficPill(level: string): string {
    return (
      ({ fluido: 'bg-emerald-500/20 text-emerald-200', moderado: 'bg-amber-500/20 text-amber-200', congestionado: 'bg-red-500/25 text-red-200' } as Record<string, string>)[level] ??
      'bg-slate-700 text-slate-200'
    );
  }

  eventDelay(p: RoutePlan): number {
    return (p.eventos ?? []).reduce((acc, e) => acc + e.demora_min, 0);
  }

  selectPlan(i: number): void {
    this.selectedPlan.set(i);
    this.drawPlans();
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
    this.originInfo.set(null);
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
    if (!o || !d) {
      // Falta un punto: se muestra el que ya está para que el usuario lo vea y pueda ajustarlo.
      this.drawPins();
      const one = o ?? d;
      if (one && this.map) this.map.setView([one.lat, one.lng], Math.max(this.map.getZoom(), 13));
      return;
    }

    this.planning.set(true);
    this.formError.set(null);
    try {
      const list = await this.routing.planAlternatives(o, d);
      this.plans.set(list);
      this.selectedPlan.set(0);
      this.drawPlans();
    } catch (e) {
      this.plans.set([]);
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
      this.plans.set([]);
      this.selectedVehicleId = '';
      this.clearMapOverlays();
      // La siguiente ruta vuelve a partir de tu ubicación actual.
      void this.useMyLocation(true);
    } catch (e) {
      this.formError.set(apiErrorMessage(e, 'No se pudo crear la ruta'));
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
    try {
      await this.navRoutes.cancel(r.id);
    } catch (err) {
      this.formError.set(err instanceof Error ? err.message : 'Error');
    }
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

  /** Dibuja todas las alternativas; la seleccionada encima y resaltada. */
  private drawPlans(): void {
    const list = this.plans();
    const sel = list[this.selectedPlan()];
    if (!this.map || !sel) return;
    this.drawPlan(sel);
    list.forEach((alt, i) => {
      if (i === this.selectedPlan() || !this.map) return;
      const line = L.polyline(alt.coordinates, { color: this.altColor(i), weight: 4, opacity: 0.45, dashArray: '6 6' })
        .bindTooltip(`Alternativa: ${alt.distanceKm} km · ${this.formatDuration(alt.durationTrafficMin ?? alt.durationMin)}`)
        .on('click', () => this.selectPlan(i))
        .addTo(this.map);
      line.bringToBack();
      this.altLines.push(line);
    });
  }

  private drawPlan(p: RoutePlan): void {
    if (!this.map) return;
    this.clearMapOverlays();

    this.routeLine = L.polyline(p.coordinates, {
      color: this.altColor(this.plan() === p ? this.selectedPlan() : 0),
      weight: 5,
      opacity: 0.85
    }).addTo(this.map);

    if (this.plans().includes(p)) {
      // Planificación en curso: puntos arrastrables.
      this.drawPins();
    } else {
      // Ruta ya guardada: sólo referencia.
      this.originMarker = L.marker([p.origin.lat, p.origin.lng], { icon: this.pinIcon('#10b981', 'Origen') }).bindTooltip('Origen').addTo(this.map);
      this.destMarker = L.marker([p.destination.lat, p.destination.lng], { icon: this.pinIcon('#ef4444', 'Destino') }).bindTooltip('Destino').addTo(this.map);
    }

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
    this.altLines.forEach((l) => l.remove());
    this.altLines = [];
    this.routeLine?.remove();
    this.originMarker?.remove();
    this.destMarker?.remove();
    this.routeLine = null;
    this.originMarker = null;
    this.destMarker = null;
  }
}
