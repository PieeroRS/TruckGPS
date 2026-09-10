import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '../api/api.service';
import { Incident, IncidentSeverity, IncidentStatus } from '../models/incident.model';
import { apiErrorMessage } from '../utils/api-error.util';
import { FleetService } from './fleet.service';

export interface IncidentFilters {
  estado: IncidentStatus | 'todos';
  severidad: IncidentSeverity | 'todas';
  busqueda: string;
}

export interface CreateIncidentInput {
  titulo: string;
  placa: string;
  categoria: string;
  severidad: IncidentSeverity;
  ubicacion: string;
  lat: number | null;
  lng: number | null;
  descripcion: string;
  esPanico?: boolean;
  photos?: File[];
  audio?: Blob | null;
}

@Injectable({ providedIn: 'root' })
export class IncidentService {
  private readonly api = inject(ApiService);
  private readonly fleet = inject(FleetService);

  private readonly _incidents = signal<readonly Incident[]>([]);
  readonly incidents = this._incidents.asReadonly();
  readonly loading = signal(false);
  readonly loaded = signal(false);

  private loadPromise: Promise<void> | null = null;

  async load(force = false): Promise<void> {
    if (this.loaded() && !force) return;
    if (this.loadPromise && !force) return this.loadPromise;
    this.loadPromise = this.fetchIncidents();
    return this.loadPromise;
  }

  filter(filters: IncidentFilters): Incident[] {
    return this._incidents().filter((inc) => {
      if (filters.estado !== 'todos' && inc.estado !== filters.estado) return false;
      if (filters.severidad !== 'todas' && inc.severidad !== filters.severidad) return false;
      if (filters.busqueda) {
        const q = filters.busqueda.toLowerCase();
        const haystack = `${inc.id} ${inc.titulo} ${inc.placa} ${inc.conductor} ${inc.ubicacion}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  getStats(): {
    total: number;
    altaSev: number;
    reportado?: number;
    asignado?: number;
    'en-atencion'?: number;
    resuelto?: number;
  } {
    const list = this._incidents();
    let total = 0;
    let altaSev = 0;
    const counts: Record<string, number> = {};
    for (const inc of list) {
      total++;
      counts[inc.estado] = (counts[inc.estado] || 0) + 1;
      if (inc.severidad === 'high') altaSev++;
    }
    return { total, altaSev, ...counts };
  }

  async create(input: CreateIncidentInput): Promise<{ ok: boolean; error?: string }> {
    await this.fleet.load();
    const vehicle = this.fleet.getByPlaca(input.placa);
    if (!vehicle) {
      return { ok: false, error: `Vehículo ${input.placa} no encontrado.` };
    }

    const form = new FormData();
    form.append('titulo', input.titulo);
    form.append('placa', input.placa);
    form.append('categoria', input.categoria);
    form.append('severidad', input.severidad);
    form.append('ubicacion', input.ubicacion);
    form.append('descripcion', input.descripcion);
    form.append('es_panico', String(input.esPanico ?? false));
    if (input.lat != null) form.append('lat', String(input.lat));
    if (input.lng != null) form.append('lng', String(input.lng));
    input.photos?.forEach((file) => form.append('photos', file, file.name));
    if (input.audio) {
      form.append('audio', input.audio, 'audio.webm');
    }

    try {
      await this.api.postForm('/incidents', form);
      await this.load(true);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: apiErrorMessage(e, 'No se pudo registrar la incidencia') };
    }
  }

  async updateStatus(id: string, estado: IncidentStatus, notas?: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.api.patch(`/incidents/${id}/status`, { estado, notas: notas ?? null });
      await this.load(true);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: apiErrorMessage(e, 'Error al actualizar') };
    }
  }

  async assign(id: string, asignadoA: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.api.patch(`/incidents/${id}/assign`, { asignado_a: asignadoA.trim() });
      await this.load(true);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: apiErrorMessage(e, 'Error al asignar') };
    }
  }

  async addComment(id: string, notas: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.api.post(`/incidents/${id}/comments`, { notas: notas.trim() });
      await this.load(true);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: apiErrorMessage(e, 'Error al comentar') };
    }
  }

  async delete(id: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.api.delete(`/incidents/${id}`);
      await this.load(true);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: apiErrorMessage(e, 'Error al eliminar') };
    }
  }

  private async fetchIncidents(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.api.get<Incident[]>('/incidents');
      this._incidents.set(rows);
      this.loaded.set(true);
    } catch {
      this._incidents.set([]);
      this.loaded.set(true);
    } finally {
      this.loading.set(false);
      this.loadPromise = null;
    }
  }
}
