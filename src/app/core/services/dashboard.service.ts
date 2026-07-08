import { Injectable, inject, signal } from '@angular/core';
import { ActivityItem, AiAlert, Kpi, RouteProgress } from '../models/dashboard.model';
import { AiAlertRow, mapAiAlertRow, TripRow } from '../supabase/supabase.mappers';
import { SEED_ACTIVITY, SEED_AI_ALERTS, SEED_KPIS, SEED_ROUTES } from '../data/seed.data';
import { isSupabaseConfigured } from '../supabase/supabase.config';
import { SupabaseService } from '../supabase/supabase.service';
import { FleetService } from './fleet.service';
import { IncidentService } from './incident.service';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly supabase = inject(SupabaseService);
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
    if (!this.supabase.client) return;

    this.loading.set(true);
    try {
      await Promise.all([this.fleet.load(), this.incidents.load()]);

      const [{ data: alerts }, { data: trips }, { data: navRoutes }, { data: events }] =
        await Promise.all([
          this.supabase.client.from('ai_alerts').select('*').eq('activa', true).order('created_at', { ascending: false }),
          this.supabase.client.from('trips').select('ruta, progress_pct').eq('status', 'active'),
          this.supabase.client
            .from('nav_routes')
            .select('route_label, progress_pct, status')
            .in('status', ['en-curso', 'asignada', 'solicitada'])
            .order('created_at', { ascending: false })
            .limit(6),
          this.supabase.client
            .from('incident_events')
            .select('estado, notas, created_at, incidents ( id, titulo, vehicles ( placa ) )')
            .order('created_at', { ascending: false })
            .limit(8)
        ]);

      this.aiAlerts.set(
        alerts?.length ? (alerts as AiAlertRow[]).map(mapAiAlertRow) : []
      );

      if (navRoutes?.length) {
        this.routes.set(
          navRoutes.map((t: { route_label: string; progress_pct: number; status: string }) => ({
            ruta: t.route_label,
            pct: t.progress_pct ?? (t.status === 'en-curso' ? 35 : 5),
            color: (t.progress_pct ?? 0) >= 60 ? 'emerald' : 'amber'
          })) as RouteProgress[]
        );
      } else if (trips?.length) {
        this.routes.set(
          (trips as TripRow[]).map((t) => ({
            ruta: t.ruta,
            pct: t.progress_pct,
            color: t.progress_pct >= 60 ? 'emerald' : 'amber'
          })) as RouteProgress[]
        );
      } else {
        this.routes.set([]);
      }

      this.activity.set(this.buildActivity(events ?? []));
      this.recomputeKpis();
      this.recomputeSummary();
    } finally {
      this.loading.set(false);
    }
  }

  private buildActivity(events: unknown[]): ActivityItem[] {
    if (!events.length) {
      return isSupabaseConfigured() ? [] : SEED_ACTIVITY;
    }

    return events.map((raw) => {
      const e = raw as {
        estado: string;
        notas: string | null;
        created_at: string;
        incidents:
          | { id: string; titulo: string; vehicles: { placa: string } | { placa: string }[] | null }
          | { id: string; titulo: string; vehicles: { placa: string } | { placa: string }[] | null }[]
          | null;
      };
      const rawInc = e.incidents;
      const inc = Array.isArray(rawInc) ? rawInc[0] : rawInc;
      const rawVehicle = inc?.vehicles;
      const vehicle = Array.isArray(rawVehicle) ? rawVehicle[0] : rawVehicle;
      const placa = vehicle?.placa ?? '—';
      const titulo = inc?.titulo ?? e.notas ?? 'Evento';
      const dot =
        e.estado === 'resuelto' ? 'emerald' : e.estado === 'reportado' ? 'red' : ('amber' as const);
      return {
        dot,
        html: `<strong class="text-slate-900">${placa}</strong> · ${titulo} <span class="text-slate-400">(${e.estado})</span>`
      };
    });
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
