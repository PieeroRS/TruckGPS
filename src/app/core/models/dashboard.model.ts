export interface Kpi {
  label: string;
  value: string;
  trend: string;
  icon: string;
  color: 'blue' | 'red' | 'green' | 'violet';
}

export interface AiAlert {
  id: string;
  titulo: string;
  descripcion: string;
  severidad: 'high' | 'medium' | 'low';
  icon: string;
  tiempo: string;
  afecta: string[];
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
