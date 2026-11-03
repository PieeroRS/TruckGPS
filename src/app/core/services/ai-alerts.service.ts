import { Injectable, inject, signal } from '@angular/core';

import { AuthService } from '../../auth/auth.service';
import { ApiService } from '../api/api.service';
import { AiAlert, AlertActionResult } from '../models/dashboard.model';
import { IncidentSeverity } from '../models/incident.model';
import { apiErrorMessage } from '../utils/api-error.util';

export interface AiAlertInput {
  titulo: string;
  descripcion: string;
  severidad: IncidentSeverity;
  icon?: string;
  placas_afectadas?: string[];
}

@Injectable({ providedIn: 'root' })
export class AiAlertsService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly alerts = signal<AiAlert[]>([]);
  readonly loading = signal(false);

  canManage(): boolean {
    const role = this.auth.profile()?.role;
    return role === 'admin' || role === 'supervisor';
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.alerts.set(await this.api.get<AiAlert[]>('/alerts'));
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudieron cargar las alertas'));
    } finally {
      this.loading.set(false);
    }
  }

  async create(input: AiAlertInput): Promise<void> {
    try {
      await this.api.post('/alerts', {
        titulo: input.titulo.trim(),
        descripcion: input.descripcion.trim(),
        severidad: input.severidad,
        icon: input.icon ?? 'alert-triangle',
        placas_afectadas: input.placas_afectadas ?? []
      });
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo crear la alerta'));
    }
    await this.load();
  }

  async update(id: string, input: AiAlertInput): Promise<void> {
    try {
      await this.api.patch(`/alerts/${id}`, {
        titulo: input.titulo.trim(),
        descripcion: input.descripcion.trim(),
        severidad: input.severidad,
        icon: input.icon ?? 'alert-triangle',
        placas_afectadas: input.placas_afectadas ?? []
      });
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo actualizar'));
    }
    await this.load();
  }

  async delete(id: string): Promise<void> {
    try {
      await this.api.delete(`/alerts/${id}`);
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo eliminar'));
    }
    await this.load();
  }

  async dismiss(id: string): Promise<void> {
    try {
      await this.api.post(`/alerts/${id}/dismiss`);
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo descartar'));
    }
    await this.load();
  }

  /** Ejecuta una acción de respuesta (recalcular ruta, crear incidencia, etc.). */
  async executeAction(id: string, codigo: string, nota?: string): Promise<AlertActionResult> {
    try {
      const res = await this.api.post<AlertActionResult>(`/alerts/${id}/acciones`, { codigo, nota: nota || null });
      this.alerts.update((list) =>
        res.alerta.estado === 'resuelta' || res.alerta.estado === 'descartada'
          ? list.filter((a) => a.id !== id)
          : list.map((a) => (a.id === id ? res.alerta : a))
      );
      return res;
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo ejecutar la acción'));
    }
  }

  async history(): Promise<AiAlert[]> {
    try {
      return await this.api.get<AiAlert[]>('/alerts/historial');
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo cargar el historial'));
    }
  }
}
