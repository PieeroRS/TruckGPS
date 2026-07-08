import { Injectable, inject, signal } from '@angular/core';
import {
  SEED_CHART_BARS,
  SEED_CHART_DONUT,
  SEED_CHART_TREND,
  SEED_HEATMAP
} from '../data/seed.data';
import { ChartBars, ChartDonut, ChartTrend, HeatmapPoint } from '../models/reports.model';
import { incidentsToHeatmap } from '../supabase/supabase.mappers';
import { SupabaseService } from '../supabase/supabase.service';
import { IncidentService } from './incident.service';
import { Incident } from '../models/incident.model';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly supabase = inject(SupabaseService);
  private readonly incidents = inject(IncidentService);

  readonly heatmap = signal<HeatmapPoint[]>(SEED_HEATMAP);
  readonly chartBars = signal<ChartBars>(SEED_CHART_BARS);
  readonly chartDonut = signal<ChartDonut>(SEED_CHART_DONUT);
  readonly chartTrend = signal<ChartTrend>(SEED_CHART_TREND);
  readonly loading = signal(false);

  async load(): Promise<void> {
    if (!this.supabase.client) return;

    this.loading.set(true);
    try {
      await this.incidents.load();
      const list = this.incidents.incidents();
      if (list.length === 0) return;

      this.heatmap.set(incidentsToHeatmap(list));
      this.chartDonut.set(this.buildDonut(list));
      this.chartBars.set(this.buildBars(list));
      this.chartTrend.set(this.buildTrend(list));
    } finally {
      this.loading.set(false);
    }
  }

  private buildDonut(list: readonly Incident[]): ChartDonut {
    const counts = new Map<string, number>();
    for (const inc of list) {
      counts.set(inc.categoria, (counts.get(inc.categoria) ?? 0) + 1);
    }
    const labels = [...counts.keys()];
    const data = labels.map((l) => counts.get(l) ?? 0);
    return { labels, data };
  }

  private buildBars(list: readonly Incident[]): ChartBars {
    const byMonth = new Map<string, Map<string, number>>();
    for (const inc of list) {
      const d = new Date(inc.creado);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!byMonth.has(key)) byMonth.set(key, new Map());
      const catMap = byMonth.get(key)!;
      catMap.set(inc.categoria, (catMap.get(inc.categoria) ?? 0) + 1);
    }

    const sortedKeys = [...byMonth.keys()].sort().slice(-7);
    const categories = [...new Set(list.map((i) => i.categoria))];

    return {
      labels: sortedKeys.map((k) => {
        const [, m] = k.split('-').map(Number);
        return MONTH_LABELS[m] ?? k;
      }),
      datasets: categories.map((cat) => ({
        label: cat,
        data: sortedKeys.map((k) => byMonth.get(k)?.get(cat) ?? 0)
      }))
    };
  }

  private buildTrend(list: readonly Incident[]): ChartTrend {
    const weeks = 8;
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const data: number[] = [];

    for (let i = weeks - 1; i >= 0; i--) {
      const start = now - (i + 1) * weekMs;
      const end = now - i * weekMs;
      const count = list.filter((inc) => {
        const t = new Date(inc.creado).getTime();
        return t >= start && t < end;
      }).length;
      data.push(count);
    }

    return {
      labels: data.map((_, i) => `Sem ${i + 1}`),
      data
    };
  }
}
