import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  ChevronUp,
  LayoutDashboard,
  LucideAngularModule,
  Map,
  MapPin,
  Menu,
  Route,
  Search,
  Truck,
  Users
} from 'lucide-angular';
import { AuthService } from '../../auth/auth.service';
import { LayoutService } from '../services/layout.service';

const BASE_NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { key: 'rutas', label: 'Rutas', icon: Route, path: '/rutas' },
  { key: 'mapa-vivo', label: 'Mapa en Vivo', icon: Map, path: '/mapa-vivo' },
  { key: 'incidencias', label: 'Incidencias', icon: AlertTriangle, path: '/incidencias' },
  { key: 'flota', label: 'Flota', icon: Truck, path: '/flota' },
  { key: 'reportes', label: 'Reportes', icon: BarChart3, path: '/reportes' }
] as const;

const STAFF_NAV = {
  key: 'equipo',
  label: 'Equipo',
  icon: Users,
  path: '/equipo'
} as const;

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
          aria-label="Navegación principal"
        >
          <div class="px-5 pt-6 pb-4 flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
              <lucide-icon [img]="truckIcon" [size]="18" />
            </div>
            <div class="leading-tight">
              <div class="text-white font-semibold tracking-tight">TruckGPS</div>
              <div class="text-[11px] text-slate-400">Control Center · PE</div>
            </div>
          </div>

          <div class="px-3 pb-2 pt-2 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
            Navegación
          </div>
          <nav class="flex flex-col gap-1 px-3">
            @for (item of navItems(); track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="is-active"
                class="sidebar-link"
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

            <div
              class="mt-3 flex items-center gap-2.5 px-2 py-2.5 rounded-lg hover:bg-white/5 transition cursor-pointer"
              [routerLink]="auth.isStaff() ? '/equipo' : '/mi-perfil'"
              (click)="closeDrawer()"
            >
              <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white">{{ auth.initials() }}</div>
              <div class="flex-1 min-w-0">
                <div class="text-xs font-semibold text-slate-100 truncate">{{ auth.profile()?.full_name ?? 'Usuario' }}</div>
                <div class="text-[10px] text-slate-400 truncate">{{ auth.profile()?.email ?? '' }}</div>
              </div>
              <lucide-icon [img]="chevronUpIcon" [size]="14" class="text-slate-400" />
            </div>
          </div>
        </aside>

        @if (drawerOpen()) {
          <div class="drawer-backdrop is-open lg:hidden" (click)="closeDrawer()"></div>
        }
      </div>

      <div class="flex flex-col min-w-0">
        <header class="topbar">
          <button
            type="button"
            class="lg:hidden p-2 rounded-md hover:bg-slate-100 transition"
            aria-label="Abrir menú"
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

          <button type="button" class="relative p-2 rounded-md hover:bg-slate-100 transition" aria-label="Notificaciones">
            <lucide-icon [img]="bellIcon" [size]="20" class="text-slate-600" />
            <span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"></span>
          </button>

          <div class="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-slate-200">
            <div class="w-8 h-8 rounded-full bg-[#1e3a8a] text-white text-xs font-semibold flex items-center justify-center">{{ auth.initials() }}</div>
            <div class="leading-tight hidden lg:block">
              <div class="text-xs font-semibold text-slate-700">{{ auth.profile()?.full_name ?? 'Usuario' }}</div>
              <div class="text-[11px] text-slate-500">{{ auth.roleLabel() }}</div>
            </div>
          </div>
        </header>

        <main class="flex-1 min-h-0">
          <router-outlet />
        </main>
      </div>
    </div>
  `
})
export class MainLayoutComponent {
  readonly layout = inject(LayoutService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly navItems = computed(() =>
    this.auth.isStaff() ? [...BASE_NAV, STAFF_NAV] : [...BASE_NAV]
  );
  readonly truckIcon = Truck;
  readonly alertCircleIcon = AlertCircle;
  readonly mapPinIcon = MapPin;
  readonly chevronUpIcon = ChevronUp;
  readonly menuIcon = Menu;
  readonly searchIcon = Search;
  readonly bellIcon = Bell;

  readonly drawerOpen = signal(false);

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.closeDrawer();
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.closeDrawer();
      });
    }
  }

  openDrawer(): void {
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }
}
