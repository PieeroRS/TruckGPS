export type IncidentSeverity = 'high' | 'medium' | 'low';
export type IncidentStatus = 'reportado' | 'asignado' | 'en-atencion' | 'resuelto';

export interface Incident {
  id: string;
  titulo: string;
  placa: string;
  conductor: string;
  categoria: string;
  severidad: IncidentSeverity;
  estado: IncidentStatus;
  ubicacion: string;
  lat: number;
  lng: number;
  descripcion: string;
  creado: string;
  actualizado: string;
  asignadoA: string | null;
  foto: boolean;
  audio: boolean;
}
