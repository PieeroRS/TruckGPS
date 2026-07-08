import { Incident, IncidentSeverity, IncidentStatus } from '../models/incident.model';
import { Vehicle, VehicleStatus } from '../models/vehicle.model';
import { AiAlert } from '../models/dashboard.model';
import { HeatmapPoint } from '../models/reports.model';

export type VehicleLiveRow = {
  id: string;
  placa: string;
  modelo: string;
  estado: VehicleStatus;
  ruta: string | null;
  kilometraje: number;
  prox_mantenimiento: string | null;
  conductor: string;
  lat: number;
  lng: number;
  velocidad: number;
};

export type IncidentRow = {
  id: string;
  vehicle_id: string;
  reported_by: string | null;
  titulo: string;
  categoria: string;
  severidad: IncidentSeverity;
  estado: IncidentStatus;
  ubicacion: string;
  lat: number | null;
  lng: number | null;
  descripcion: string;
  asignado_a: string | null;
  es_panico: boolean;
  created_at: string;
  updated_at: string;
  vehicles: { placa: string; conductor: string | null } | null;
  incident_attachments: { type: string }[] | null;
};

export type AiAlertRow = {
  id: string;
  titulo: string;
  descripcion: string;
  severidad: IncidentSeverity;
  icon: string;
  placas_afectadas: string[];
  created_at: string;
};

export type TripRow = {
  ruta: string;
  progress_pct: number;
};

export function mapVehicleRow(row: VehicleLiveRow): Vehicle {
  return {
    id: row.id,
    placa: row.placa,
    conductor: row.conductor,
    modelo: row.modelo,
    estado: row.estado,
    ruta: row.ruta ?? '—',
    lat: row.lat,
    lng: row.lng,
    velocidad: row.velocidad,
    km: row.kilometraje,
    proxMant: row.prox_mantenimiento ?? ''
  };
}

export function mapIncidentRow(row: IncidentRow): Incident {
  const attachments = row.incident_attachments ?? [];
  return {
    id: row.id,
    titulo: row.titulo,
    placa: row.vehicles?.placa ?? '—',
    conductor: row.vehicles?.conductor ?? '—',
    categoria: row.categoria,
    severidad: row.severidad,
    estado: row.estado,
    ubicacion: row.ubicacion,
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
    descripcion: row.descripcion,
    creado: row.created_at,
    actualizado: row.updated_at,
    asignadoA: row.asignado_a,
    foto: attachments.some((a) => a.type === 'photo'),
    audio: attachments.some((a) => a.type === 'audio')
  };
}

export function mapAiAlertRow(row: AiAlertRow): AiAlert {
  const mins = Math.floor((Date.now() - new Date(row.created_at).getTime()) / 60000);
  let tiempo = `hace ${mins} min`;
  if (mins >= 60) tiempo = `hace ${Math.floor(mins / 60)} h`;
  if (mins >= 1440) tiempo = `hace ${Math.floor(mins / 1440)} d`;

  return {
    id: row.id,
    titulo: row.titulo,
    descripcion: row.descripcion,
    severidad: row.severidad,
    icon: row.icon,
    tiempo,
    afecta: row.placas_afectadas ?? []
  };
}

export function incidentsToHeatmap(incidents: readonly Incident[]): HeatmapPoint[] {
  return incidents
    .filter((i) => i.lat && i.lng)
    .map((i) => [i.lat, i.lng, i.severidad === 'high' ? 0.9 : i.severidad === 'medium' ? 0.6 : 0.35] as HeatmapPoint);
}

export function generateIncidentId(): string {
  const year = new Date().getFullYear();
  const num = String(Math.floor(Math.random() * 900) + 100);
  return `INC-${year}-${num}`;
}
