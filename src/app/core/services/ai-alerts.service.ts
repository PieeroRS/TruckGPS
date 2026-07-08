import { Injectable, inject, signal } from '@angular/core';

import { AuthService } from '../../auth/auth.service';
import { AiAlert } from '../models/dashboard.model';
import { AiAlertRow, mapAiAlertRow } from '../supabase/supabase.mappers';
import { supabaseErrorMessage } from '../utils/supabase-error.util';
import { SupabaseService } from '../supabase/supabase.service';
import { IncidentSeverity } from '../models/incident.model';

export interface AiAlertInput {
  titulo: string;
  descripcion: string;
  severidad: IncidentSeverity;
  icon?: string;
  placas_afectadas?: string[];
}

@Injectable({ providedIn: 'root' })
export class AiAlertsService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  readonly alerts = signal<AiAlert[]>([]);
  readonly loading = signal(false);

  canManage(): boolean {
    const role = this.auth.profile()?.role;
    return role === 'admin' || role === 'supervisor';
  }

  async load(): Promise<void> {
    if (!this.supabase.client) return;
    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('ai_alerts')
        .select('*')
        .eq('activa', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      this.alerts.set((data ?? []).map((r) => mapAiAlertRow(r as AiAlertRow)));
    } finally {
      this.loading.set(false);
    }
  }

  async create(input: AiAlertInput): Promise<void> {
    if (!this.supabase.client) throw new Error('Supabase no configurado');
    const { error } = await this.supabase.client.from('ai_alerts').insert({
      titulo: input.titulo.trim(),
      descripcion: input.descripcion.trim(),
      severidad: input.severidad,
      icon: input.icon ?? 'alert-triangle',
      placas_afectadas: input.placas_afectadas ?? []
    });
    if (error) throw new Error(supabaseErrorMessage(error, 'No se pudo crear la alerta'));
    await this.load();
  }

  async update(id: string, input: AiAlertInput): Promise<void> {
    if (!this.supabase.client) throw new Error('Supabase no configurado');
    const { error } = await this.supabase.client
      .from('ai_alerts')
      .update({
        titulo: input.titulo.trim(),
        descripcion: input.descripcion.trim(),
        severidad: input.severidad,
        icon: input.icon ?? 'alert-triangle',
        placas_afectadas: input.placas_afectadas ?? []
      })
      .eq('id', id);
    if (error) throw new Error(supabaseErrorMessage(error, 'No se pudo actualizar'));
    await this.load();
  }

  async delete(id: string): Promise<void> {
    if (!this.supabase.client) throw new Error('Supabase no configurado');
    const { error } = await this.supabase.client.from('ai_alerts').delete().eq('id', id);
    if (error) throw new Error(supabaseErrorMessage(error, 'No se pudo eliminar'));
    await this.load();
  }

  async dismiss(id: string): Promise<void> {
    if (!this.supabase.client) return;
    const { error } = await this.supabase.client.from('ai_alerts').update({ activa: false }).eq('id', id);
    if (error) throw new Error(supabaseErrorMessage(error, 'No se pudo descartar'));
    await this.load();
  }
}
