export type ZoneType = 'robo' | 'sin_senal' | 'peligro_vial' | 'riesgo';

export interface RiskZone {
  id: string;
  nombre: string;
  tipo: ZoneType;
  tipoLabel: string;
  lat: number;
  lng: number;
  radioM: number;
  activa: boolean;
  notas: string | null;
  createdAt: string | null;
}

export interface RiskZoneUpsert {
  nombre: string;
  tipo: ZoneType;
  lat: number;
  lng: number;
  radio_m: number;
  activa: boolean;
  notas?: string | null;
}

export interface NotificationLogRow {
  id: string;
  tipo: 'panico' | 'incidente' | 'zona' | 'prueba';
  titulo: string;
  mensaje: string;
  canal: 'email' | 'sms';
  destinatarios: string;
  estado: 'enviado' | 'fallido' | 'sin_configurar';
  error: string | null;
  createdAt: string | null;
}

export interface ChannelStatus {
  configurado: boolean;
  destinatarios: string[];
  faltan: string[];
}

export interface NotificationStatus {
  email: ChannelStatus;
  sms: ChannelStatus;
  cooldownMin: number;
}

export const ZONE_TYPES: { value: ZoneType; label: string; color: string }[] = [
  { value: 'robo', label: 'Zona de robos', color: '#dc2626' },
  { value: 'peligro_vial', label: 'Peligro vial', color: '#ea580c' },
  { value: 'sin_senal', label: 'Sin señal', color: '#7c3aed' },
  { value: 'riesgo', label: 'Zona de riesgo', color: '#d97706' }
];

export function zoneColor(tipo: string): string {
  return ZONE_TYPES.find((t) => t.value === tipo)?.color ?? '#d97706';
}
