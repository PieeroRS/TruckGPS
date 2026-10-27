import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    canActivate: [() => import('./auth/auth.guard').then((m) => m.guestGuard)],
    loadComponent: () =>
      import('./auth/login-page.component').then((m) => m.LoginPageComponent)
  },
  {
    path: '',
    canActivate: [() => import('./auth/auth.guard').then((m) => m.authGuard)],
    canActivateChild: [() => import('./auth/auth.guard').then((m) => m.authGuard)],
    loadComponent: () =>
      import('./core/layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent)
      },
      {
        path: 'rutas',
        loadComponent: () =>
          import('./features/rutas/rutas-page.component').then((m) => m.RutasPageComponent)
      },
      {
        path: 'mapa-vivo',
        loadComponent: () =>
          import('./features/mapa-vivo/mapa-vivo-page.component').then((m) => m.MapaVivoPageComponent)
      },
      {
        path: 'incidencias',
        loadComponent: () =>
          import('./features/incidencias/incidencias-page.component').then((m) => m.IncidenciasPageComponent)
      },
      {
        path: 'flota',
        loadComponent: () =>
          import('./features/flota/flota-page.component').then((m) => m.FlotaPageComponent)
      },
      {
        path: 'consumo',
        loadComponent: () =>
          import('./features/consumo/consumo-page.component').then((m) => m.ConsumoPageComponent)
      },
      {
        path: 'zonas',
        canActivate: [() => import('./auth/supervisor.guard').then((m) => m.supervisorGuard)],
        loadComponent: () =>
          import('./features/zonas/zonas-page.component').then((m) => m.ZonasPageComponent)
      },
      {
        path: 'reportes',
        loadComponent: () =>
          import('./features/reportes/reportes-page.component').then((m) => m.ReportesPageComponent)
      },
      {
        path: 'reportar',
        loadComponent: () =>
          import('./features/reportar/reportar-page.component').then((m) => m.ReportarPageComponent)
      },
      {
        path: 'mi-ubicacion',
        loadComponent: () =>
          import('./features/mi-ubicacion/mi-ubicacion-page.component').then((m) => m.MiUbicacionPageComponent)
      },
      {
        path: 'equipo',
        canActivate: [() => import('./auth/supervisor.guard').then((m) => m.supervisorGuard)],
        loadComponent: () =>
          import('./features/equipo/equipo-page.component').then((m) => m.EquipoPageComponent)
      },
      {
        path: 'mi-perfil',
        loadComponent: () =>
          import('./features/mi-perfil/mi-perfil-page.component').then((m) => m.MiPerfilPageComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
