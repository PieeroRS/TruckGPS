import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  FlaskConical,
  Fuel,
  LayoutDashboard,
  LogOut,
  LucideAngularModule,
  Map,
  MapPin,
  Menu,
  Route,
  Search,
  ShieldAlert,
  Truck,
  User,
  Users,
  X
} from 'lucide-angular';
import { AuthService } from '../../auth/auth.service';
import { LayoutService } from '../services/layout.service';
import { ZoneProximityService } from '../services/zone-proximity.service';
import { AlertWatcherService } from '../services/alert-watcher.service';
import { LocationTrackingService } from '../services/location-tracking.service';

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
  { key: 'equipo', label: 'Equipo', icon: Users, path: '/equipo' }
] as const;

@Component({
  standalone: true,
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
  template: `
    <div class="app-shell">
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

          <a
            routerLink="/dashboard"
            class="relative p-2 rounded-md hover:bg-slate-100 transition"
            [attr.aria-label]="'Alertas: ' + watcher.unattended() + ' sin atender'"
            [title]="watcher.unattended() ? watcher.unattended() + ' alertas sin atender' : 'Sin alertas nuevas'"
          >
            <lucide-icon [img]="bellIcon" [size]="20" class="text-slate-600" />
            @if (watcher.unattended()) {
              <span class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center ring-2 ring-white tnum">{{ watcher.unattended() > 99 ? '99+' : watcher.unattended() }}</span>
            }
          </a>

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

        <main class="flex-1 min-h-0">
          <router-outlet />
        </main>
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
  readonly layout = inject(LayoutService);
  readonly auth = inject(AuthService);
  readonly proximity = inject(ZoneProximityService);
  readonly watcher = inject(AlertWatcherService);
  readonly tracking = inject(LocationTrackingService);
  readonly alertTriangleIcon = AlertTriangle;
  readonly closeIcon = X;

  metersToEdge(hit: { zone: { radioM: number }; distanceM: number }): string {
    const m = Math.max(0, Math.round(hit.distanceM - hit.zone.radioM));
    return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
  }
  private readonly router = inject(Router);

  readonly navItems = computed(() =>
    this.auth.isStaff() ? [...BASE_NAV, ...STAFF_NAV] : [...BASE_NAV]
  );
  readonly truckIcon = Truck;
  readonly alertCircleIcon = AlertCircle;
  readonly mapPinIcon = MapPin;
  readonly menuIcon = Menu;
  readonly searchIcon = Search;
  readonly bellIcon = Bell;
  readonly logoutIcon = LogOut;
  readonly userIcon = User;

  readonly drawerOpen = signal(false);
  readonly loggingOut = signal(false);

  constructor() {
    this.watcher.start();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
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
    if (!confirm('¿Cerrar sesión en TruckGPS?')) return;
    this.loggingOut.set(true);
    this.closeDrawer();
    try {
      this.watcher.stop();
      await this.auth.logout();
    } finally {
      this.loggingOut.set(false);
    }
  }
}
