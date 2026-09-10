import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '../api/api.service';
import { ActivityItem, AiAlert, Kpi, RouteProgress } from '../models/dashboard.model';
import { SEED_ACTIVITY, SEED_AI_ALERTS, SEED_KPIS, SEED_ROUTES } from '../data/seed.data';
import { FleetService } from './fleet.service';
import { IncidentService } from './incident.service';

type DashboardPayload = {
  alerts: AiAlert[];
  routes: RouteProgress[];
  activity: ActivityItem[];
};

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);
  private readonly fleet = inject(FleetService);
  private readonly incidents = inject(IncidentService);

  readonly kpis = signal<Kpi[]>(SEED_KPIS);
  readonly aiAlerts = signal<AiAlert[]>(SEED_AI_ALERTS);
  readonly activity = signal<ActivityItem[]>(SEED_ACTIVITY);
  readonly routes = signal<RouteProgress[]>(SEED_ROUTES);
  readonly loading = signal(false);

  readonly daySummary = signal({
    distancia: '—',
    entregas: '—',
    combustible: '—',
    resueltas: '—',
    eficiencia: '—'
  });

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      await Promise.all([this.fleet.load(), this.incidents.load()]);
      const data = await this.api.get<DashboardPayload>('/dashboard');
      this.aiAlerts.set(data.alerts ?? []);
      this.routes.set(data.routes ?? []);
      this.activity.set(data.activity ?? []);
      this.recomputeKpis();
      this.recomputeSummary();
    } catch {
      this.aiAlerts.set([]);
      this.routes.set([]);
      this.activity.set([]);
      this.recomputeKpis();
      this.recomputeSummary();
    } finally {
      this.loading.set(false);
    }
  }

  private recomputeKpis(): void {
    const fleetTotal = this.fleet.count();
    const active = this.fleet.vehicles().filter((v) => v.estado === 'ok').length;
    const incTotal = this.incidents.incidents().length;
    const pendingAi = this.aiAlerts().length;
    const resolved = this.incidents.incidents().filter((i) => i.estado === 'resuelto').length;

    this.kpis.set([
      { label: 'Vehículos activos', value: `${active} / ${fleetTotal}`, trend: '+0', icon: 'truck', color: 'blue' },
      { label: 'Incidencias', value: String(incTotal), trend: '—', icon: 'alert-triangle', color: 'red' },
      {
        label: 'Resueltas',
        value: `${resolved} / ${incTotal}`,
        trend: '—',
        icon: 'clock',
        color: 'green'
      },
      { label: 'Alertas IA', value: String(pendingAi), trend: '+0', icon: 'sparkles', color: 'violet' }
    ]);
  }

  private recomputeSummary(): void {
    const fleet = this.fleet.vehicles();
    const totalKm = fleet.reduce((s, v) => s + v.km, 0);
    const inc = this.incidents.incidents();
    const resolved = inc.filter((i) => i.estado === 'resuelto').length;
    const routes = this.routes().length;
    const active = fleet.filter((v) => v.estado === 'ok').length;

    this.daySummary.set({
      distancia: `${Math.round(totalKm / 1000).toLocaleString('es-PE')} km`,
      entregas: `${routes} rutas activas`,
      combustible: `${Math.round(totalKm * 0.35).toLocaleString('es-PE')} L est.`,
      resueltas: `${resolved} / ${inc.length}`,
      eficiencia: fleet.length ? `${Math.round((active / fleet.length) * 100)}%` : '—'
    });
  }
}
