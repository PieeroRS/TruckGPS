export type VehicleStatus = 'ok' | 'warn' | 'alert' | 'offline';

export interface Vehicle {
  id?: string;
  placa: string;
  conductor: string;
  modelo: string;
  estado: VehicleStatus;
  ruta: string;
  lat: number;
  lng: number;
  velocidad: number;
  km: number;
  proxMant: string;
  rendimientoKmGal?: number | null;
  tanqueGal?: number | null;
  /** Unidad de prueba que se mueve sola (SIM-001). */
  simulado?: boolean;
}
