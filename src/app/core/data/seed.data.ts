import { AiAlert, ActivityItem, Kpi, RouteProgress } from '../models/dashboard.model';
import { Incident } from '../models/incident.model';
import { ChartBars, ChartDonut, ChartTrend, HeatmapPoint } from '../models/reports.model';
import { Vehicle } from '../models/vehicle.model';

/** Fallback demo (máx. 3 registros) cuando Supabase no está configurado. */
export const SEED_VEHICLES: Vehicle[] = [
  { placa: 'ABC-123', conductor: 'Sin asignar', modelo: 'Volvo FH 540', estado: 'ok', ruta: 'Lima → Trujillo', lat: -12.0464, lng: -77.0428, velocidad: 78, km: 142850, proxMant: '2026-06-12' },
  { placa: 'DGR-456', conductor: 'Sin asignar', modelo: 'Scania R 450', estado: 'warn', ruta: 'Arequipa → Cusco', lat: -16.409, lng: -71.537, velocidad: 0, km: 98430, proxMant: '2026-05-18' },
  { placa: 'PER-789', conductor: 'Sin asignar', modelo: 'Mercedes Actros', estado: 'alert', ruta: 'Lima → Huancayo', lat: -11.9404, lng: -76.2356, velocidad: 12, km: 215120, proxMant: '2026-05-09' }
];

export const SEED_INCIDENTS: Incident[] = [
  { id: 'INC-DEMO-001', titulo: 'Falla en frenos', placa: 'PER-789', conductor: '—', categoria: 'Mecánico', severidad: 'high', estado: 'en-atencion', ubicacion: 'Carretera Central km 78', lat: -11.94, lng: -76.24, descripcion: 'Pérdida de presión en frenos.', creado: '2026-05-06T08:42:00', actualizado: '2026-05-06T11:15:00', asignadoA: 'Equipo Mecánico', foto: false, audio: false },
  { id: 'INC-DEMO-002', titulo: 'Detenido sin reportar', placa: 'DGR-456', conductor: '—', categoria: 'Operativo', severidad: 'medium', estado: 'reportado', ubicacion: 'Arequipa', lat: -16.41, lng: -71.54, descripcion: 'Detención prolongada.', creado: '2026-05-06T10:05:00', actualizado: '2026-05-06T10:05:00', asignadoA: null, foto: false, audio: false }
];

export const SEED_AI_ALERTS: AiAlert[] = [
  { id: 'ai-1', titulo: 'Retraso Carretera Central', descripcion: 'Retrasos estimados 35-50 min.', severidad: 'high', icon: 'alert-triangle', tiempo: 'hace 6 min', afecta: ['PER-789', 'ABC-123'] },
  { id: 'ai-2', titulo: 'Mantenimiento DGR-456', descripcion: 'Revisión de transmisión recomendada.', severidad: 'medium', icon: 'wrench', tiempo: 'hace 22 min', afecta: ['DGR-456'] },
  { id: 'ai-3', titulo: 'Optimización de ruta', descripcion: 'Ruta alternativa reduce 28 min.', severidad: 'low', icon: 'route', tiempo: 'hace 2 h', afecta: ['ABC-123'] }
];

export const SEED_KPIS: Kpi[] = [
  { label: 'Vehículos activos', value: '2 / 3', trend: '+0', icon: 'truck', color: 'blue' },
  { label: 'Incidencias', value: '2', trend: '—', icon: 'alert-triangle', color: 'red' },
  { label: 'Tiempo respuesta', value: '—', trend: '—', icon: 'clock', color: 'green' },
  { label: 'Alertas IA', value: '3', trend: '+0', icon: 'sparkles', color: 'violet' }
];

export const SEED_ACTIVITY: ActivityItem[] = [
  { dot: 'emerald', html: '<strong class="text-slate-900">ABC-123</strong> en ruta Lima → Trujillo' },
  { dot: 'red', html: '<strong class="text-slate-900">PER-789</strong> reportó falla de frenos' },
  { dot: 'amber', html: '<strong class="text-slate-900">DGR-456</strong> detenido en Arequipa' }
];

export const SEED_ROUTES: RouteProgress[] = [
  { ruta: 'Lima → Trujillo', pct: 68, color: 'emerald' }
];

export const SEED_HEATMAP: HeatmapPoint[] = [
  [-12.0464, -77.0428, 0.7], [-16.409, -71.537, 0.5], [-11.9404, -76.2356, 0.8]
];

export const SEED_CHART_BARS: ChartBars = {
  labels: ['Ene', 'Feb', 'Mar'],
  datasets: [{ label: 'Alta', data: [1, 0, 1] }, { label: 'Media', data: [0, 1, 0] }, { label: 'Baja', data: [0, 0, 0] }]
};

export const SEED_CHART_DONUT: ChartDonut = {
  labels: ['Mecánico', 'Operativo'],
  data: [1, 1]
};

export const SEED_CHART_TREND: ChartTrend = {
  labels: ['Sem 1', 'Sem 2', 'Sem 3'],
  data: [1, 2, 2]
};

export const SAMPLE_ROUTES: { coords: [number, number][]; color: string }[] = [
  { coords: [[-12.0464, -77.0428], [-8.1116, -79.0288]], color: '#2563eb' }
];
