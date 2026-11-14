import { authGuard, guestGuard } from './auth/auth.guard';
import { homeGuard, moduleGuard } from './auth/module.guard';
import { supervisorGuard } from './auth/supervisor.guard';
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./auth/login-page.component').then((m) => m.LoginPageComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () =>
      import('./core/layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [homeGuard],
        loadComponent: () =>
          import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent)
      },
      {
        path: 'dashboard',
        data: { modulo: 'dashboard' },
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent)
      },
      {
        path: 'rutas',
        data: { modulo: 'rutas' },
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/rutas/rutas-page.component').then((m) => m.RutasPageComponent)
      },
      {
        path: 'mapa-vivo',
        data: { modulo: 'mapa-vivo' },
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/mapa-vivo/mapa-vivo-page.component').then((m) => m.MapaVivoPageComponent)
      },
      {
        path: 'incidencias',
        data: { modulo: 'incidencias' },
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/incidencias/incidencias-page.component').then((m) => m.IncidenciasPageComponent)
      },
      {
        path: 'flota',
        data: { modulo: 'flota' },
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/flota/flota-page.component').then((m) => m.FlotaPageComponent)
      },
      {
        path: 'consumo',
        data: { modulo: 'consumo' },
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/consumo/consumo-page.component').then((m) => m.ConsumoPageComponent)
      },
      {
        path: 'zonas',
        data: { modulo: 'zonas' },
        canActivate: [supervisorGuard, moduleGuard],
        loadComponent: () =>
          import('./features/zonas/zonas-page.component').then((m) => m.ZonasPageComponent)
      },
      {
        path: 'reportes',
        data: { modulo: 'reportes' },
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/reportes/reportes-page.component').then((m) => m.ReportesPageComponent)
      },
      {
        path: 'reportar',
        data: { modulo: 'reportar' },
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/reportar/reportar-page.component').then((m) => m.ReportarPageComponent)
      },
      {
        path: 'mi-ubicacion',
        data: { modulo: 'mi-ubicacion' },
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/mi-ubicacion/mi-ubicacion-page.component').then((m) => m.MiUbicacionPageComponent)
      },
      {
        path: 'simulador',
        data: { modulo: 'simulador' },
        canActivate: [supervisorGuard, moduleGuard],
        loadComponent: () =>
          import('./features/simulador/simulador-page.component').then((m) => m.SimuladorPageComponent)
      },
      {
        path: 'equipo',
        data: { modulo: 'equipo' },
        canActivate: [supervisorGuard, moduleGuard],
        loadComponent: () =>
          import('./features/equipo/equipo-page.component').then((m) => m.EquipoPageComponent)
      },
      {
        path: 'configuracion',
        data: { modulo: 'configuracion' },
        canActivate: [supervisorGuard, moduleGuard],
        loadComponent: () =>
          import('./features/configuracion/configuracion-page.component').then((m) => m.ConfiguracionPageComponent)
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
