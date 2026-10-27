export type FuelEstado = 'ok' | 'bajo' | 'sin_datos';
export type FuelMetodo = 'odometro' | 'gps' | null;

export interface FuelLog {
  id: string;
  vehicleId: string;
  placa: string;
  navRouteId: string | null;
  fecha: string;
  galones: number;
  monto: number;
  precioGalon: number | null;
  odometroKm: number | null;
  tanqueLleno: boolean;
  grifo: string | null;
  notas: string | null;
}

export interface FuelLogCreate {
  vehicle_id: string;
  galones: number;
  monto: number;
  fecha?: string;
  odometro_km?: number | null;
  tanque_lleno: boolean;
  grifo?: string;
  nav_route_id?: string | null;
  notas?: string;
}

export interface FuelVehicleRow {
  vehicleId: string;
  placa: string;
  modelo: string;
  rendimientoRef: number | null;
  tanqueGal: number | null;
  cargas: number;
  galones: number;
  gasto: number;
  km: number;
  kmGps: number;
  kmOdometro: number;
  kmMedidos: number;
  rendimientoReal: number | null;
  metodo: FuelMetodo;
  desviacionPct: number | null;
  costoKm: number | null;
  galonesEstimadosGps: number | null;
  estado: FuelEstado;
  ultimaCarga: string | null;
}

export interface FuelRouteRow {
  id: string;
  routeLabel: string;
  placa: string | null;
  status: string;
  distanceKm: number | null;
  rendimientoRef: number | null;
  galonesEstimados: number | null;
  costoEstimado: number | null;
  createdAt: string | null;
}

export interface FuelSummary {
  periodo: { desde: string; hasta: string; dias: number };
  precioGalonRef: number | null;
  precioGalonFuente: 'manual' | 'cargas' | null;
  umbralBajoPct: number;
  totales: { cargas: number; galones: number; gasto: number; km: number; costoKm: number | null };
  vehiculos: FuelVehicleRow[];
  rutas: FuelRouteRow[];
}
