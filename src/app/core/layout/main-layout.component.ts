import { ConfirmService } from '../services/confirm.service';
import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { AiAlert } from '../models/dashboard.model';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  CloudUpload,
  FlaskConical,
  Fuel,
  LayoutDashboard,
  LogOut,
  LucideAngularModule,
  Map,
  MapPin,
  Menu,
  Navigation,
  Route,
  Search,
  Settings,
  Siren,
  ShieldAlert,
  Truck,
  User,
  Users,
  WifiOff,
  X
} from 'lucide-angular';
import { AuthService } from '../../auth/auth.service';
import { OfflineQueueService } from '../services/offline-queue.service';
import { LayoutService } from '../services/layout.service';
import { ZoneProximityService } from '../services/zone-proximity.service';
import { AlertWatcherService } from '../services/alert-watcher.service';
import { InactividadService } from '../services/inactividad.service';
import { LocationTrackingService } from '../services/location-tracking.service';
import { SettingsService } from '../services/settings.service';

const BASE_NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { key: 'rutas', label: 'Rutas', icon: Route, path: '/rutas' },
  { key: 'mapa-vivo', label: 'Mapa en Vivo', icon: Map, path: '/mapa-vivo' },
  { key: 'incidencias', label: 'Incidencias', icon: AlertTriangle, path: '/incidencias' },
  { key: 'flota', label: 'Flota', icon: Truck, path: '/flota' },
  { key: 'consumo', label: 'Consumo', icon: Fuel, path: '/consumo' },
  { key: 'reportes', label: 'Reportes', icon: BarChart3, path: '/reportes' }
] as const;

const STAFF_NAV = [
  { key: 'zonas', label: 'Zonas y avisos', icon: ShieldAlert, path: '/zonas' },
  { key: 'simulador', label: 'Simulador', icon: FlaskConical, path: '/simulador' },
  { key: 'equipo', label: 'Equipo', icon: Users, path: '/equipo' },
  { key: 'configuracion', label: 'Configuración', icon: Settings, path: '/configuracion' }
] as const;

@Component({
  standalone: true,
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
  template: `
    <div class="app-shell" [class.has-bnav]="showBottomNav()">
      <div class="lg:contents">
        <aside
          class="sidebar"
          [class.is-open]="drawerOpen()"
          [attr.aria-hidden]="isMobile() && !drawerOpen() ? 'true' : null"
          aria-label="Navegación principal"
        >
          <div class="px-5 pt-6 pb-4 flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
              <lucide-icon [img]="truckIcon" [size]="18" />
            </div>
            <div class="leading-tight flex-1 min-w-0">
              <div class="text-white font-semibold tracking-tight">TruckGPS</div>
              <div class="text-[11px] text-slate-400">Control Center · PE</div>
            </div>
            <button
              type="button"
              class="lg:hidden w-9 h-9 -mr-1 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition"
              aria-label="Cerrar menú"
              (click)="closeDrawer()"
            >
              <lucide-icon [img]="closeIcon" [size]="18" />
            </button>
          </div>

          <div class="px-3 pb-2 pt-2 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
            Navegación
          </div>
          <nav class="flex flex-col gap-1 px-3">
            @for (item of navItems(); track item.path; let i = $index) {
              <a
                [routerLink]="item.path"
                routerLinkActive="is-active"
                class="sidebar-link"
                [style.--i]="i"
                (click)="closeDrawer()"
              >
                <lucide-icon [img]="item.icon" [size]="18" />
                <span>{{ item.label }}</span>
              </a>
            }
          </nav>

          <div class="mt-auto p-3">
            @if (settings.puedeVer('mi-ubicacion')) {
            <a
              routerLink="/mi-ubicacion"
              routerLinkActive="ring-2 ring-emerald-500/40 rounded"
              class="block rounded-lg p-3 mb-2 bg-emerald-500/10 hover:bg-emerald-500/15 transition border border-emerald-500/20"
              (click)="closeDrawer()"
            >
              <div class="flex items-center gap-2 text-emerald-300">
                <lucide-icon [img]="mapPinIcon" [size]="16" />
                <span class="text-xs font-semibold">Mi ubicación en vivo</span>
              </div>
              <p class="text-[11px] text-slate-400 mt-1.5 leading-snug">
                Activa el GPS y selecciona tu unidad para aparecer en el mapa.
              </p>
            </a>
            }
            @if (settings.puedeVer('reportar')) {
            <a
              routerLink="/reportar"
              routerLinkActive="ring-2 ring-red-500/40 rounded"
              class="block rounded-lg p-3 bg-red-500/10 hover:bg-red-500/15 transition border border-red-500/20"
              (click)="closeDrawer()"
            >
              <div class="flex items-center gap-2 text-red-300">
                <lucide-icon [img]="alertCircleIcon" [size]="16" />
                <span class="text-xs font-semibold">Reportar incidencia</span>
              </div>
              <p class="text-[11px] text-slate-400 mt-1.5 leading-snug">
                Vista mobile optimizada para conductores en ruta.
              </p>
            </a>
            }

            <div class="mt-3 rounded-lg border border-white/10 overflow-hidden">
              <a
                routerLink="/mi-perfil"
                class="flex items-center gap-2.5 px-2 py-2.5 hover:bg-white/5 transition"
                (click)="closeDrawer()"
              >
                <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white">{{ auth.initials() }}</div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-semibold text-slate-100 truncate">{{ auth.profile()?.full_name ?? 'Usuario' }}</div>
                  <div class="text-[10px] text-slate-400 truncate">{{ auth.profile()?.email ?? '' }}</div>
                </div>
                <lucide-icon [img]="userIcon" [size]="14" class="text-slate-400" />
              </a>
              <button
                type="button"
                class="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-red-300 hover:bg-red-500/15 transition border-t border-white/10"
                [disabled]="loggingOut()"
                (click)="onLogout()"
              >
                <lucide-icon [img]="logoutIcon" [size]="14" />
                {{ loggingOut() ? 'Cerrando sesión...' : 'Cerrar sesión' }}
              </button>
            </div>
          </div>
        </aside>

        <div class="drawer-backdrop lg:hidden" [class.is-open]="drawerOpen()" (click)="closeDrawer()"></div>
      </div>

      <div class="flex flex-col min-w-0">
        <header class="topbar">
          <button
            type="button"
            class="lg:hidden -ml-1 w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 active:scale-95 transition"
            [class.hidden]="showBottomNav()"
            aria-label="Abrir menú"
            [attr.aria-expanded]="drawerOpen()"
            (click)="openDrawer()"
          >
            <lucide-icon [img]="menuIcon" [size]="20" />
          </button>

          <div class="flex-1 min-w-0">
            <h1 class="text-base sm:text-lg font-semibold text-slate-900 truncate">
              {{ layout.pageMeta().title }}
            </h1>
            <p class="text-xs text-slate-500 truncate hidden sm:block">
              {{ layout.pageMeta().subtitle }}
            </p>
          </div>

          <div class="hidden md:flex items-center gap-2 flex-1 max-w-md">
            <div class="relative w-full">
              <lucide-icon [img]="searchIcon" [size]="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar placa, conductor, incidencia..."
                class="input pl-9 bg-slate-50 border-slate-200 focus:bg-white"
              />
            </div>
          </div>

          <div class="relative">
            <button
              type="button"
              class="relative p-2 rounded-md hover:bg-slate-100 transition"
              [class.bg-slate-100]="notifOpen()"
              [attr.aria-label]="'Notificaciones: ' + watcher.unattended() + ' alertas sin atender'"
              [attr.aria-expanded]="notifOpen()"
              aria-haspopup="dialog"
              (click)="toggleNotif($event)"
            >
              <lucide-icon [img]="bellIcon" [size]="20" class="text-slate-600" />
              @if (watcher.unattended()) {
                <span class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center ring-2 ring-white tnum">{{ watcher.unattended() > 99 ? '99+' : watcher.unattended() }}</span>
              }
            </button>

            @if (notifOpen()) {
              <div class="absolute right-0 top-full mt-2 z-[1200] w-[min(360px,calc(100vw-24px))] rounded-xl bg-white shadow-[0_12px_40px_-12px_rgba(15,23,42,0.35)] ring-1 ring-slate-200 overflow-hidden" role="dialog" aria-label="Notificaciones" (click)="$event.stopPropagation()">
                <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
                  <div>
                    <p class="text-[13.5px] font-semibold text-slate-900">Notificaciones</p>
                    <p class="text-[11.5px] text-slate-500">{{ watcher.unattended() ? watcher.unattended() + ' alertas sin atender' : 'No tienes alertas pendientes' }}</p>
                  </div>
                  <button type="button" class="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" (click)="notifOpen.set(false)" aria-label="Cerrar notificaciones">
                    <lucide-icon [img]="closeIcon" [size]="15" />
                  </button>
                </div>
                <ul class="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
                  @for (a of notifItems(); track a.id) {
                    <li>
                      <button type="button" class="w-full text-left flex items-start gap-2.5 px-4 py-3 hover:bg-slate-50 transition-colors" (click)="abrirAlerta(a)">
                        <span class="mt-1.5 w-2 h-2 rounded-full shrink-0" [class]="a.severidad === 'high' ? 'bg-red-500' : a.severidad === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'"></span>
                        <span class="min-w-0 flex-1">
                          <span class="block text-[12.5px] font-semibold text-slate-900 leading-snug">{{ a.titulo }}</span>
                          <span class="block text-[11.5px] text-slate-500 leading-snug mt-0.5 line-clamp-2">{{ a.descripcion }}</span>
                          <span class="block text-[11px] text-slate-400 mt-1">{{ a.afecta.join(', ') }}{{ a.afecta.length ? ' · ' : '' }}{{ a.tiempo }}{{ (a.estado ?? 'activa') === 'en_atencion' ? ' · en atención' : '' }}</span>
                        </span>
                      </button>
                    </li>
                  } @empty {
                    <li class="px-4 py-8 text-center text-[12.5px] text-slate-500">Sin alertas por ahora.</li>
                  }
                </ul>
                @if (auth.isStaff()) {
                  <a routerLink="/dashboard" class="block px-4 py-2.5 text-center text-[12.5px] font-semibold text-blue-600 hover:bg-blue-50 border-t border-slate-100" (click)="notifOpen.set(false)">Ver todas las alertas</a>
                }
              </div>
            }
          </div>

          <div class="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-slate-200">
            <div class="w-8 h-8 rounded-full bg-[#1e3a8a] text-white text-xs font-semibold flex items-center justify-center">{{ auth.initials() }}</div>
            <div class="leading-tight hidden lg:block">
              <div class="text-xs font-semibold text-slate-700">{{ auth.profile()?.full_name ?? 'Usuario' }}</div>
              <div class="text-[11px] text-slate-500">{{ auth.roleLabel() }}</div>
            </div>
            <button
              type="button"
              class="ml-1 p-2 rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              [disabled]="loggingOut()"
              (click)="onLogout()"
            >
              <lucide-icon [img]="logoutIcon" [size]="18" />
            </button>
          </div>
        </header>

        @if (tracking.arrived(); as llego) {
          <div class="flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white" role="status">
            <lucide-icon [img]="mapPinIcon" [size]="18" class="shrink-0" />
            <p class="text-[13px] leading-snug flex-1 min-w-0">
              <strong>Llegaste a {{ llego.destino }}.</strong> La ruta «{{ llego.ruta }}» se completó y el GPS se apagó solo.
            </p>
            <button type="button" class="shrink-0 p-1 rounded-md hover:bg-emerald-500" (click)="tracking.arrived.set(null)" aria-label="Ocultar aviso">
              <lucide-icon [img]="closeIcon" [size]="16" />
            </button>
          </div>
        }
        @if (!auth.isStaff() && watcher.myDeviation(); as dev) {
          <div class="flex items-start gap-3 px-4 py-3 bg-amber-500 text-white" role="alert">
            <lucide-icon [img]="alertTriangleIcon" [size]="18" class="mt-0.5 shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="text-[13.5px] font-bold leading-snug">Te saliste de tu ruta</p>
              <p class="text-[12px] leading-snug mt-0.5">{{ dev.descripcion }}</p>
              <p class="text-[11.5px] mt-1 opacity-90">El centro de control ya fue avisado. Vuelve a la ruta o espera indicaciones.</p>
            </div>
          </div>
        }

        @if (proximity.inside(); as hit) {
          @if (proximity.dismissedId() !== hit.zone.id) {
            <div class="flex items-start gap-3 px-4 py-3 bg-red-600 text-white shadow-md" role="alert" aria-live="assertive">
              <lucide-icon [img]="alertTriangleIcon" [size]="20" class="mt-0.5 shrink-0" />
              <div class="min-w-0 flex-1">
                <p class="text-[13.5px] font-bold leading-snug">Estás en zona peligrosa: {{ hit.zone.nombre }}</p>
                <p class="text-[12px] text-red-50 leading-snug mt-0.5">{{ hit.zone.tipoLabel }}{{ hit.zone.notas ? ' · ' + hit.zone.notas : '' }}</p>
                <p class="text-[11.5px] text-red-100 mt-1">No te detengas, mantén puertas cerradas y usa el botón de pánico si es necesario.</p>
              </div>
              <button type="button" class="shrink-0 p-1 rounded-md hover:bg-red-500 transition" (click)="proximity.dismiss()" aria-label="Ocultar aviso">
                <lucide-icon [img]="closeIcon" [size]="16" />
              </button>
            </div>
          }
        } @else if (proximity.near(); as hit) {
          @if (proximity.dismissedId() !== hit.zone.id) {
            <div class="flex items-center gap-3 px-4 py-2.5 bg-amber-100 text-amber-900 border-b border-amber-200" role="status">
              <lucide-icon [img]="alertTriangleIcon" [size]="16" class="shrink-0 text-amber-600" />
              <p class="text-[12.5px] leading-snug flex-1 min-w-0">
                Te acercas a <strong>{{ hit.zone.nombre }}</strong> ({{ hit.zone.tipoLabel }}), a {{ metersToEdge(hit) }} del borde.
              </p>
              <button type="button" class="shrink-0 p-1 rounded-md hover:bg-amber-200 transition" (click)="proximity.dismiss()" aria-label="Ocultar aviso">
                <lucide-icon [img]="closeIcon" [size]="14" />
              </button>
            </div>
          }
        }

        <!-- Sin señal: lo que no se pudo enviar queda guardado y se manda solo -->
        @if (!queue.online() || queue.hasPending()) {
          <div class="flex items-center gap-2.5 px-4 py-2 text-[12px] leading-snug" [class]="queue.online() ? 'bg-blue-50 text-blue-900 border-b border-blue-100' : 'bg-slate-800 text-white'" role="status">
            <lucide-icon [img]="queue.online() ? cloudUpIcon : wifiOffIcon" [size]="15" class="shrink-0" />
            <p class="flex-1 min-w-0">
              @if (!queue.online()) {
                <strong>Sin conexión.</strong>
                @if (queue.hasPending()) { Guardado en tu celular: {{ pendingText() }}. Se envía solo al volver la señal. } @else { Lo que registres se guarda y se envía solo al volver la señal. }
              } @else {
                {{ queue.flushing() ? 'Enviando' : 'Por enviar' }}: {{ pendingText() }}.
              }
            </p>
          </div>
        } @else if (sentNotice(); as n) {
          <div class="flex items-center gap-2.5 px-4 py-2 text-[12px] bg-emerald-50 text-emerald-900 border-b border-emerald-100" role="status">
            <lucide-icon [img]="cloudUpIcon" [size]="15" class="shrink-0" />
            <p class="flex-1">Volvió la señal: se envió {{ n }}.</p>
          </div>
        }
        @for (f of queue.failedReports(); track f.id) {
          <div class="flex items-center gap-2.5 px-4 py-2 text-[12px] bg-red-50 text-red-900 border-b border-red-100" role="alert">
            <lucide-icon [img]="alertTriangleIcon" [size]="15" class="shrink-0" />
            <p class="flex-1 min-w-0"><strong>No se pudo enviar «{{ f.label }}»:</strong> {{ f.error }}</p>
            <button type="button" class="shrink-0 font-semibold underline" (click)="queue.retryFailed()">Reintentar</button>
            <button type="button" class="shrink-0 font-semibold underline" (click)="queue.discard(f.id)">Descartar</button>
          </div>
        }

        <main class="flex-1 min-h-0" [class.page-in-a]="pageTick() % 2 === 0" [class.page-in-b]="pageTick() % 2 === 1">
          <router-outlet />

          @if (layout.aviso(); as av) {
            <div class="fixed bottom-5 left-1/2 -translate-x-1/2 z-[1300] w-[min(520px,calc(100vw-24px))] flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-[0_12px_40px_-12px_rgba(15,23,42,0.45)] ring-1 msg-in"
              [class]="av.error ? 'bg-red-50 text-red-800 ring-red-200' : 'bg-emerald-600 text-white ring-emerald-700'" role="status">
              <p class="text-[13px] leading-snug flex-1">{{ av.texto }}</p>
              <button type="button" class="shrink-0 p-0.5 rounded-md opacity-80 hover:opacity-100" (click)="layout.aviso.set(null)" aria-label="Cerrar aviso">
                <lucide-icon [img]="closeIcon" [size]="15" />
              </button>
            </div>
          }
        </main>

        <!-- Conductor en el celular: lo principal siempre a un toque, con una mano -->
        @if (showBottomNav()) {
          <nav class="bnav" aria-label="Accesos del conductor">
            @for (it of bottomItems(); track it.path) {
              @if (it.panic) {
                <a routerLink="/reportar" [queryParams]="{ panico: 1 }" class="bnav-panic" aria-label="Botón de pánico">
                  <span class="bnav-panic-dot"><lucide-icon [img]="it.icon" [size]="24" /></span>
                  <span class="bnav-label">Pánico</span>
                </a>
              } @else {
                <a [routerLink]="it.path" routerLinkActive="is-active" class="bnav-item">
                  <lucide-icon [img]="it.icon" [size]="22" />
                  <span class="bnav-label">{{ it.label }}</span>
                </a>
              }
            }
            <button type="button" class="bnav-item" [class.is-active]="drawerOpen()" aria-label="Más opciones" (click)="openDrawer()">
              <lucide-icon [img]="menuIcon" [size]="22" />
              <span class="bnav-label">Más</span>
            </button>
          </nav>
        }
      </div>
    </div>

    <!-- Alertas nuevas en tiempo real (cualquier pantalla) -->
    <div class="alert-toasts" aria-live="assertive">
      @for (t of watcher.toasts(); track t.alert.id) {
        <div class="alert-toast" [class]="'alert-toast sev-' + t.alert.severidad" role="alert">
          <lucide-icon [img]="alertTriangleIcon" [size]="18" class="shrink-0 mt-0.5" />
          <div class="min-w-0 flex-1">
            <p class="text-[13px] font-bold leading-snug">{{ t.alert.titulo }}</p>
            <p class="text-[12px] leading-snug mt-0.5 line-clamp-3 opacity-90">{{ t.alert.descripcion }}</p>
            <div class="flex items-center gap-3 mt-2">
              @if (auth.isStaff()) {
                <a routerLink="/dashboard" class="text-[12px] font-semibold underline underline-offset-2" (click)="watcher.dismissToast(t.alert.id)">Atender</a>
                @if (t.alert.vehicleId) {
                  <a routerLink="/mapa-vivo" [queryParams]="{ vehiculo: t.alert.vehicleId }" class="text-[12px] font-semibold underline underline-offset-2" (click)="watcher.dismissToast(t.alert.id)">Ver en el mapa</a>
                }
              }
              @if (watcher.notifPermission() === 'default') {
                <button type="button" class="text-[12px] font-semibold underline underline-offset-2" (click)="watcher.enableNotifications()">Avisarme aunque no esté en la página</button>
              }
            </div>
          </div>
          <button type="button" class="shrink-0 p-1 rounded-md hover:bg-black/10" (click)="watcher.dismissToast(t.alert.id)" aria-label="Cerrar">
            <lucide-icon [img]="closeIcon" [size]="14" />
          </button>
        </div>
      }
    </div>
  `
})
export class MainLayoutComponent {
  private readonly confirmDialog = inject(ConfirmService);
  readonly layout = inject(LayoutService);
  readonly auth = inject(AuthService);
  readonly proximity = inject(ZoneProximityService);
  readonly watcher = inject(AlertWatcherService);
  private readonly inactividad = inject(InactividadService);
  readonly tracking = inject(LocationTrackingService);
  readonly queue = inject(OfflineQueueService);
  readonly wifiOffIcon = WifiOff;
  readonly cloudUpIcon = CloudUpload;
  readonly pendingText = computed(() => this.countText(this.queue.pendingPositions(), this.queue.pendingReports()));
  private readonly sentTick = signal(0);
  /** Aviso corto después de enviar lo pendiente (se oculta a los 8 segundos). */
  readonly sentNotice = computed(() => {
    this.sentTick();
    const s = this.queue.lastSent();
    return s && Date.now() - s.at < 8000 ? this.countText(s.posiciones, s.reportes) : null;
  });
  private readonly sentEffect = effect(() => {
    if (this.queue.lastSent()) setTimeout(() => this.sentTick.update((n) => n + 1), 8200);
  });

  private countText(pos: number, rep: number): string {
    const partes: string[] = [];
    if (rep) partes.push(`${rep} ${rep === 1 ? 'reporte' : 'reportes'}`);
    if (pos) partes.push(`${pos} ${pos === 1 ? 'posición' : 'posiciones'} del recorrido`);
    return partes.join(' y ');
  }
  readonly alertTriangleIcon = AlertTriangle;
  readonly closeIcon = X;

  metersToEdge(hit: { zone: { radioM: number }; distanceM: number }): string {
    const m = Math.max(0, Math.round(hit.distanceM - hit.zone.radioM));
    return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
  }
  private readonly router = inject(Router);

  readonly settings = inject(SettingsService);

  /** Menú según el rol y la interfaz que configuró el administrador. */
  readonly navItems = computed(() => {
    const items = this.auth.isStaff() ? [...BASE_NAV, ...STAFF_NAV] : [...BASE_NAV];
    const mods = this.settings.misModulos();
    return mods ? items.filter((i) => mods.has(i.key)) : items;
  });
  readonly truckIcon = Truck;
  readonly alertCircleIcon = AlertCircle;
  readonly mapPinIcon = MapPin;
  readonly menuIcon = Menu;
  readonly searchIcon = Search;
  readonly bellIcon = Bell;
  readonly logoutIcon = LogOut;
  readonly userIcon = User;

  readonly drawerOpen = signal(false);

  private readonly url = signal(this.router.url);
  readonly pageTick = signal(0);
  /** Accesos fijos del conductor en el celular (respetan los módulos que ocultó el administrador). */
  readonly bottomItems = computed(() => {
    const ve = (k: string) => this.settings.puedeVer(k);
    const items: { path: string; label: string; icon: typeof Menu; panic?: boolean }[] = [];
    if (ve('mi-ubicacion')) items.push({ path: '/mi-ubicacion', label: 'Mi GPS', icon: MapPin });
    if (ve('rutas')) items.push({ path: '/rutas', label: 'Rutas', icon: Navigation });
    if (ve('reportar')) {
      items.push({ path: '/reportar?panico', label: 'Pánico', icon: Siren, panic: true });
      items.push({ path: '/reportar', label: 'Reportar', icon: AlertCircle });
    }
    return items;
  });
  /** Solo para conductores, en pantallas chicas y fuera de la navegación a pantalla completa. */
  readonly showBottomNav = computed(
    () => this.isMobile() && !!this.auth.profile() && !this.auth.isStaff() && this.bottomItems().length >= 2 && !this.url().startsWith('/navegar')
  );
  readonly loggingOut = signal(false);

  // CP026: panel de notificaciones de la campana.
  readonly notifOpen = signal(false);
  readonly notifItems = computed(() =>
    [...this.watcher.mine()]
      .sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.severidad] - ({ high: 0, medium: 1, low: 2 })[b.severidad])
      .slice(0, 8)
  );

  toggleNotif(ev: Event): void {
    ev.stopPropagation();
    this.notifOpen.update((v) => !v);
  }

  @HostListener('document:click')
  cerrarNotifFuera(): void {
    this.notifOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  cerrarNotifEsc(): void {
    this.notifOpen.set(false);
  }

  abrirAlerta(a: AiAlert): void {
    this.notifOpen.set(false);
    if (this.auth.isStaff()) void this.router.navigate(['/dashboard'], { queryParams: { alerta: a.id } });
    else if (a.vehicleId) void this.router.navigate(['/mapa-vivo'], { queryParams: { vehiculo: a.vehicleId } });
  }

  constructor() {
    this.watcher.start();
    this.inactividad.start();
    void this.settings.loadInterfaz();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      // Cambió de pantalla (no solo de parámetros): se repite la entrada suave del contenido.
      const ruta = this.router.url.split('?')[0];
      if (ruta !== this.url().split('?')[0]) this.pageTick.update((n) => n + 1);
      this.url.set(this.router.url);
      this.closeDrawer();
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.closeDrawer();
      });
      const mq = window.matchMedia('(max-width: 1023px)');
      mq.addEventListener('change', (e) => {
        this.isMobile.set(e.matches);
        if (!e.matches) this.closeDrawer();
      });
    }
  }

  /** Menú lateral como panel (móvil/tablet) o fijo (escritorio). */
  readonly isMobile = signal(typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches);

  openDrawer(): void {
    this.drawerOpen.set(true);
    // Bloquea el scroll del fondo mientras el menú está abierto (iOS lo arrastraba).
    document.body.classList.add('drawer-locked');
  }

  closeDrawer(): void {
    if (!this.drawerOpen()) return;
    this.drawerOpen.set(false);
    document.body.classList.remove('drawer-locked');
    // Los mapas pueden quedar mal medidos tras abrir/cerrar el panel o rotar el teléfono.
    setTimeout(() => window.dispatchEvent(new Event('resize')), 560);
  }

  async onLogout(): Promise<void> {
    if (this.loggingOut()) return;
    if (!(await this.confirmDialog.ask('¿Cerrar sesión en TruckGPS?', { okLabel: 'Cerrar sesión' }))) return;
    this.loggingOut.set(true);
    this.closeDrawer();
    try {
      this.watcher.stop();
      await this.auth.logout('salida');
    } finally {
      this.loggingOut.set(false);
    }
  }
}
