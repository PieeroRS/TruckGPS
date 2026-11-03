export interface Kpi {
  label: string;
  value: string;
  trend: string;
  icon: string;
  color: 'blue' | 'red' | 'green' | 'violet';
}

export type AlertTipo =
  | 'manual'
  | 'desvio'
  | 'spoofing'
  | 'jamming'
  | 'salida_zona'
  | 'parada_riesgo'
  | 'trafico'
  | 'sabotaje';

export type AlertEstado = 'activa' | 'en_atencion' | 'resuelta' | 'descartada';

export interface AlertAction {
  codigo: string;
  label: string;
  descripcion: string;
  recomendada: boolean;
  ejecutada: boolean;
}

export interface AlertHistoryEntry {
  codigo: string;
  label: string;
  usuario: string;
  fecha: string;
  resultado: string;
  nota?: string;
}

export interface AlertAlternative {
  geometry: [number, number][];
  distance_km: number;
  duration_traffic_min: number;
  ahorro_min: number;
}

export interface AiAlert {
  id: string;
  titulo: string;
  descripcion: string;
  severidad: 'high' | 'medium' | 'low';
  icon: string;
  tiempo: string;
  afecta: string[];
  tipo?: AlertTipo;
  origen?: 'manual' | 'motor' | 'simulacion';
  estado?: AlertEstado;
  vehicleId?: string | null;
  navRouteId?: string | null;
  lat?: number | null;
  lng?: number | null;
  creado?: string;
  actualizado?: string;
  payload?: {
    alternativa?: AlertAlternative | null;
    demora_min?: number;
    tiempo_actual_min?: number;
    distancia_m?: number;
    salto_km?: number;
    kmh?: number;
    segundos_sin_senal?: number;
    puntaje?: number;
    umbral?: number;
    factores?: { tipo: string; label: string; cantidad: number; puntos: number }[];
    incidente_id?: string;
    [key: string]: unknown;
  };
  historial?: AlertHistoryEntry[];
  acciones?: AlertAction[];
}

export interface AlertActionResult {
  ok: boolean;
  resultado: string;
  navegar: string | null;
  alerta: AiAlert;
}

export interface ActivityItem {
  dot: 'emerald' | 'red' | 'amber';
  html: string;
}

export interface RouteProgress {
  ruta: string;
  pct: number;
  color: 'emerald' | 'amber';
}
