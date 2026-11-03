import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
import * as L from 'leaflet';
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
import { LocationTrackingService, VehicleOption, accuracyQuality } from '../../core/services/location-tracking.service';
import { createOsmMap } from '../../core/utils/map.utils';
import { NavRoute } from '../../core/models/route.model';
import { NavRoutesService } from '../../core/services/nav-routes.service';
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
              (ngModelChange)="selectedVehicleIdSig.set($event)"
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
              <p class="text-xs text-amber-700 mt-2">No hay vehículos disponibles. Vuelve a iniciar sesión e intenta de nuevo.</p>
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

        @if (myRoute(); as r) {
          <div class="card p-4 fade-in-up space-y-2">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Tu ruta</p>
                <p class="text-sm font-semibold text-slate-900 truncate">{{ r.routeLabel }}</p>
                <p class="text-[11px] text-slate-500">Destino: {{ r.destName }}</p>
              </div>
              <span class="badge shrink-0" [class]="r.status === 'en-curso' ? 'badge-success' : 'badge-warning'">{{ r.status === 'en-curso' ? 'En curso' : 'Por iniciar' }}</span>
            </div>
            @if (r.status === 'en-curso') {
              <div class="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div class="h-full bg-emerald-500 transition-all duration-700" [style.width.%]="r.progressPct"></div>
              </div>
              <p class="text-[11px] text-slate-500">Si te sales de la ruta, el centro de control recibe una alerta al instante. Al llegar al destino el GPS se apaga solo.</p>
            } @else {
              <button type="button" class="w-full py-2.5 rounded-lg bg-slate-900 text-white text-[13px] font-semibold disabled:opacity-50" [disabled]="startingRoute()" (click)="startRoute(r.id)">
                {{ startingRoute() ? 'Iniciando…' : 'Iniciar ruta' }}
              </button>
              <p class="text-[11px] text-slate-500">Inicia la ruta para que se vigilen los desvíos y se detecte la llegada.</p>
            }
          </div>
        }

        <div class="card p-4 fade-in-up" [class]="tracking.native ? 'bg-emerald-50/70 border-emerald-100' : 'bg-amber-50/70 border-amber-100'">
          @if (tracking.native) {
            <p class="text-[12.5px] font-semibold text-emerald-900">App TruckGPS · GPS en segundo plano</p>
            <p class="text-[11.5px] text-emerald-800 mt-1 leading-relaxed">
              La ubicación se sigue enviando con la pantalla apagada o si cambias de app, hasta que la desactives o llegues a tu destino.
              Verás una notificación fija de TruckGPS mientras esté activa. Para que el celular no la corte, en Ajustes → Batería
              deja TruckGPS «Sin restricciones».
            </p>
            @if (tracking.needsSettings()) {
              <button type="button" class="mt-2 text-[12px] font-semibold text-emerald-900 underline" (click)="tracking.openSettings()">Abrir ajustes de permisos</button>
            }
          } @else {
            <p class="text-[12.5px] font-semibold text-amber-900">Estás usando el navegador</p>
            <p class="text-[11.5px] text-amber-800 mt-1 leading-relaxed">
              Los navegadores pausan el GPS al bloquear el celular o cambiar de app (es una limitación de Android y iPhone, no de TruckGPS).
              Para que no se detenga, instala la app de Android:
            </p>
            <a [href]="apkUrl" class="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-[12px] font-semibold" rel="noopener">
              Descargar app Android (APK)
            </a>
            <p class="text-[11px] text-amber-800/90 mt-2 leading-relaxed">
              En iPhone, deja TruckGPS abierto en pantalla: la pantalla se mantiene encendida mientras compartes la ubicación.
            </p>
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
            <div #miniMap class="h-56 w-full rounded-lg overflow-hidden ring-1 ring-slate-200 bg-slate-100"></div>

            @if (tracking.accuracy() !== null) {
              <div class="rounded-lg px-3 py-2.5 ring-1" [class]="qualityBox()">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[12px] font-semibold">{{ qualityLabel() }}</span>
                  <span class="text-[12px] font-mono tnum font-semibold">± {{ accuracyLabel() }}</span>
                </div>
                @if (quality() === 'aproximada' || quality() === 'muy_aproximada') {
                  <p class="text-[11.5px] mt-1.5 leading-relaxed">
                    Este equipo está ubicándose por WiFi o por la red, no por GPS, y puede marcar otro lugar.
                    Para ubicación exacta como en Google Maps:
                  </p>
                  <ul class="text-[11.5px] mt-1 list-disc pl-4 space-y-0.5 leading-relaxed">
                    <li>Usa el <strong>celular</strong> (una PC o laptop no tiene GPS).</li>
                    <li>Android: Ajustes → Ubicación → activa <strong>Precisión de ubicación de Google</strong>, y en el permiso del navegador elige <strong>Precisa</strong>.</li>
                    <li>iPhone: Ajustes → Privacidad → Localización → Safari/Chrome → activa <strong>Ubicación exacta</strong>.</li>
                    <li>Cerca de una ventana o al aire libre el GPS fija en segundos.</li>
                  </ul>
                } @else {
                  <p class="text-[11.5px] mt-1 leading-relaxed">La posición que ve el centro de control es la de este equipo, con ese margen.</p>
                }
                @if (tracking.lastIgnored()) {
                  <p class="text-[11px] mt-1.5">El servidor mantuvo la lectura anterior porque la nueva era mucho menos precisa.</p>
                }
              </div>
            }

            @if (tracking.lat() !== null && tracking.lng() !== null) {
              <div class="flex items-center justify-between gap-2">
                <p class="text-[11px] text-slate-500 font-mono">
                  {{ tracking.lat()!.toFixed(6) }}, {{ tracking.lng()!.toFixed(6) }}
                </p>
                <button type="button" class="text-[11.5px] font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-50 inline-flex items-center gap-1" [disabled]="refreshing()" (click)="precisar()">
                  <lucide-icon [img]="locateIcon" [size]="12" [class.animate-pulse]="refreshing()" />Precisar ubicación
                </button>
              </div>
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

  readonly refreshing = signal(false);
  readonly apkUrl = 'https://github.com/PieeroRS/TruckGPS/releases/latest/download/TruckGPS.apk';
  readonly routes = signal<NavRoute[]>([]);
  readonly startingRoute = signal(false);
  /** Ruta en curso (o asignada) de la unidad elegida. */
  readonly myRoute = computed(() => {
    const vid = this.tracking.vehicleId() ?? this.selectedVehicleIdSig();
    if (!vid) return null;
    const list = this.routes().filter((r) => r.vehicleId === vid && !(r.notes ?? '').startsWith('[circuito-sim]'));
    return list.find((r) => r.status === 'en-curso') ?? list.find((r) => r.status === 'asignada') ?? null;
  });
  readonly selectedVehicleIdSig = signal('');
  private readonly navRoutes = inject(NavRoutesService);
  private routesTimer: ReturnType<typeof setInterval> | null = null;

  async loadRoutes(): Promise<void> {
    await this.navRoutes.load();
    this.routes.set(this.navRoutes.routes());
  }

  async startRoute(id: string): Promise<void> {
    this.startingRoute.set(true);
    try {
      await this.navRoutes.updateStatus(id, 'en-curso');
      this.routes.set(this.navRoutes.routes());
    } catch (e) {
      this.tracking.error.set(e instanceof Error ? e.message : 'No se pudo iniciar la ruta');
    } finally {
      this.startingRoute.set(false);
    }
  }
  readonly quality = computed(() => accuracyQuality(this.tracking.accuracy()));

  /** El mapa existe sólo mientras el GPS está activo (el contenedor está dentro del @if). */
  @ViewChild('miniMap') set miniMapEl(el: ElementRef<HTMLDivElement> | undefined) {
    if (!el) {
      this.map?.remove();
      this.map = null;
      this.dot = null;
      this.circle = null;
      return;
    }
    if (this.map) return;
    this.map = createOsmMap(el.nativeElement, [this.tracking.lat() ?? -12.0464, this.tracking.lng() ?? -77.0428], 17);
    setTimeout(() => {
      this.map?.invalidateSize();
      this.drawMe();
    }, 50);
  }

  private map: L.Map | null = null;
  private dot: L.CircleMarker | null = null;
  private circle: L.Circle | null = null;

  constructor() {
    effect(() => {
      this.tracking.lat();
      this.tracking.lng();
      this.tracking.accuracy();
      this.drawMe();
    });
  }

  /** Punto azul con su círculo de precisión, como Google Maps. */
  private drawMe(): void {
    const lat = this.tracking.lat();
    const lng = this.tracking.lng();
    if (!this.map || lat === null || lng === null) return;
    const acc = this.tracking.accuracy() ?? 0;
    const pos: L.LatLngTuple = [lat, lng];
    if (!this.circle) {
      this.circle = L.circle(pos, { radius: acc, color: '#2563eb', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.15 }).addTo(this.map);
      this.dot = L.circleMarker(pos, { radius: 7, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(this.map);
    } else {
      this.circle.setLatLng(pos).setRadius(acc);
      this.dot!.setLatLng(pos);
    }
    if (acc > 150) this.map.fitBounds(this.circle.getBounds(), { maxZoom: 17 });
    else this.map.setView(pos, Math.max(this.map.getZoom(), 16));
  }

  qualityLabel(): string {
    return (
      {
        gps: 'Precisión GPS',
        buena: 'Precisión buena',
        aproximada: 'Ubicación aproximada',
        muy_aproximada: 'Ubicación muy aproximada (por la red/IP)'
      } as Record<string, string>
    )[this.quality() ?? ''] ?? '';
  }

  qualityBox(): string {
    const q = this.quality();
    if (q === 'gps' || q === 'buena') return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    if (q === 'aproximada') return 'bg-amber-50 text-amber-800 ring-amber-200';
    return 'bg-red-50 text-red-800 ring-red-200';
  }

  accuracyLabel(): string {
    const m = this.tracking.accuracy() ?? 0;
    return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
  }

  async precisar(): Promise<void> {
    this.refreshing.set(true);
    await this.tracking.refreshNow();
    this.refreshing.set(false);
  }

  ngOnInit(): void {
    void this.loadRoutes();
    this.routesTimer = setInterval(() => {
      if (!document.hidden) void this.loadRoutes();
    }, 20_000);
    this.layout.setPage('Mi Ubicación', 'Comparte tu posición en vivo con el centro de control');
    void this.loadVehicles();
    void this.tracking.resumeIfNeeded();
  }

  ngOnDestroy(): void {
    // El tracking sigue activo al salir de la página (conductor en ruta).
    if (this.routesTimer) clearInterval(this.routesTimer);
    this.map?.remove();
    this.map = null;
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
      this.selectedVehicleIdSig.set(this.selectedVehicleId);
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
