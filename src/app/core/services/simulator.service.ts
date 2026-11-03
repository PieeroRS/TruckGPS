import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '../api/api.service';
import { AiAlert } from '../models/dashboard.model';
import { NavRoute, TrafficEvent } from '../models/route.model';
import { Vehicle } from '../models/vehicle.model';
import { apiErrorMessage } from '../utils/api-error.util';

export interface SimScenario {
  tipo: string;
  titulo: string;
  casos: string[];
  duracion_s: number;
  descripcion: string;
}

export interface VehicleEvent {
  id: string;
  tipo: string;
  severidad: 'high' | 'medium' | 'low';
  descripcion: string;
  lat: number | null;
  lng: number | null;
  datos: Record<string, unknown>;
  creado: string;
}

export interface SimulatorState {
  vehicle: Vehicle;
  escenario: string;
  restanteS: number | null;
  velocidadKmh: number;
  ruta: NavRoute | null;
  tramoRetorno: [number, number][] | null;
  senalPerdida: boolean;
  desviado: boolean;
  geocerca: { lat: number; lng: number; radioM: number };
  escenarios: SimScenario[];
  eventos: VehicleEvent[];
  alertas: AiAlert[];
  trafico: TrafficEvent[];
}

@Injectable({ providedIn: 'root' })
export class SimulatorService {
  private readonly api = inject(ApiService);

  readonly state = signal<SimulatorState | null>(null);

  async load(): Promise<SimulatorState> {
    try {
      const s = await this.api.get<SimulatorState>('/simulator');
      this.state.set(s);
      return s;
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo cargar el simulador'));
    }
  }

  async start(tipo: string): Promise<string> {
    try {
      const res = await this.api.post<{ info: string; estado: SimulatorState }>('/simulator/escenario', { tipo });
      this.state.set(res.estado);
      return res.info;
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo iniciar el escenario'));
    }
  }

  async stop(): Promise<void> {
    try {
      this.state.set(await this.api.post<SimulatorState>('/simulator/terminar'));
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo detener el escenario'));
    }
  }

  async reset(): Promise<void> {
    try {
      this.state.set(await this.api.post<SimulatorState>('/simulator/reiniciar'));
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo reiniciar'));
    }
  }
}
