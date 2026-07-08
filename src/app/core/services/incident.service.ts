import { Injectable, inject, signal } from '@angular/core';

import { SEED_INCIDENTS } from '../data/seed.data';

import { Incident, IncidentSeverity, IncidentStatus } from '../models/incident.model';

import {

  generateIncidentId,

  IncidentRow,

  mapIncidentRow

} from '../supabase/supabase.mappers';

import { STORAGE_BUCKETS } from '../supabase/supabase.config';

import { supabaseErrorMessage } from '../utils/supabase-error.util';

import { SupabaseService } from '../supabase/supabase.service';

import { AuthService } from '../../auth/auth.service';

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

  private readonly supabase = inject(SupabaseService);

  private readonly auth = inject(AuthService);

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



  getStats(): { total: number; altaSev: number; reportado?: number; asignado?: number; 'en-atencion'?: number; resuelto?: number } {

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

    if (!this.supabase.client) {

      return this.addLocalFromInput(input);

    }



    await this.fleet.load();

    const vehicle = this.fleet.getByPlaca(input.placa);

    if (!vehicle) {

      return { ok: false, error: `Vehículo ${input.placa} no encontrado.` };

    }



    const { data: vehicleRow } = await this.supabase.client

      .from('vehicles')

      .select('id')

      .eq('placa', input.placa)

      .single();



    if (!vehicleRow?.id) {

      return { ok: false, error: 'No se pudo resolver el vehículo en la base de datos.' };

    }



    const id = generateIncidentId();

    const userId = this.auth.profile()?.id ?? null;

    const now = new Date().toISOString();



    const { error: incError } = await this.supabase.client.from('incidents').insert({

      id,

      vehicle_id: vehicleRow.id,

      reported_by: userId,

      titulo: input.titulo,

      categoria: input.categoria,

      severidad: input.severidad,

      estado: 'reportado',

      ubicacion: input.ubicacion,

      lat: input.lat,

      lng: input.lng,

      descripcion: input.descripcion,

      asignado_a: null,

      es_panico: input.esPanico ?? false,

      created_at: now,

      updated_at: now

    });



    if (incError) {

      return { ok: false, error: incError.message };

    }



    await this.supabase.client.from('incident_events').insert({

      incident_id: id,

      estado: 'reportado',

      notas: input.esPanico ? 'Reporte de emergencia' : 'Incidencia registrada',

      changed_by: userId

    });



    if (input.photos?.length) {

      for (let i = 0; i < input.photos.length; i++) {

        const file = input.photos[i];

        const path = `${id}/photo-${i + 1}-${file.name}`;

        const { error: upErr } = await this.supabase.client.storage

          .from(STORAGE_BUCKETS.photos)

          .upload(path, file, { upsert: true });

        if (!upErr) {

          await this.supabase.client.from('incident_attachments').insert({

            incident_id: id,

            type: 'photo',

            storage_path: path

          });

        }

      }

    }



    if (input.audio) {

      const path = `${id}/audio.webm`;

      const { error: upErr } = await this.supabase.client.storage

        .from(STORAGE_BUCKETS.audio)

        .upload(path, input.audio, { upsert: true, contentType: 'audio/webm' });

      if (!upErr) {

        await this.supabase.client.from('incident_attachments').insert({

          incident_id: id,

          type: 'audio',

          storage_path: path

        });

      }

    }



    await this.load(true);

    return { ok: true };

  }



  async updateStatus(

    id: string,

    estado: IncidentStatus,

    notas?: string

  ): Promise<{ ok: boolean; error?: string }> {

    if (!this.supabase.client) return { ok: false, error: 'Modo demo' };



    const userId = this.auth.profile()?.id ?? null;

    const now = new Date().toISOString();



    const { error } = await this.supabase.client

      .from('incidents')

      .update({ estado, updated_at: now })

      .eq('id', id);



    if (error) return { ok: false, error: supabaseErrorMessage(error, 'Error al actualizar') };



    await this.supabase.client.from('incident_events').insert({

      incident_id: id,

      estado,

      notas: notas ?? `Estado cambiado a ${estado}`,

      changed_by: userId

    });



    await this.load(true);

    return { ok: true };

  }



  async assign(id: string, asignadoA: string): Promise<{ ok: boolean; error?: string }> {

    if (!this.supabase.client) return { ok: false, error: 'Modo demo' };



    const userId = this.auth.profile()?.id ?? null;



    const { error } = await this.supabase.client

      .from('incidents')

      .update({

        asignado_a: asignadoA.trim(),

        estado: 'asignado',

        updated_at: new Date().toISOString()

      })

      .eq('id', id);



    if (error) return { ok: false, error: supabaseErrorMessage(error, 'Error al asignar') };



    await this.supabase.client.from('incident_events').insert({

      incident_id: id,

      estado: 'asignado',

      notas: `Asignado a ${asignadoA.trim()}`,

      changed_by: userId

    });



    await this.load(true);

    return { ok: true };

  }



  async addComment(id: string, notas: string): Promise<{ ok: boolean; error?: string }> {

    if (!this.supabase.client) return { ok: false, error: 'Modo demo' };



    const inc = this._incidents().find((i) => i.id === id);

    const userId = this.auth.profile()?.id ?? null;



    const { error } = await this.supabase.client.from('incident_events').insert({

      incident_id: id,

      estado: inc?.estado ?? 'reportado',

      notas: notas.trim(),

      changed_by: userId

    });



    if (error) return { ok: false, error: supabaseErrorMessage(error, 'Error al comentar') };



    await this.supabase.client

      .from('incidents')

      .update({ updated_at: new Date().toISOString() })

      .eq('id', id);



    await this.load(true);

    return { ok: true };

  }



  async delete(id: string): Promise<{ ok: boolean; error?: string }> {

    if (!this.supabase.client) return { ok: false, error: 'Modo demo' };



    const { error } = await this.supabase.client.from('incidents').delete().eq('id', id);

    if (error) return { ok: false, error: supabaseErrorMessage(error, 'Error al eliminar') };



    await this.load(true);

    return { ok: true };

  }



  private addLocalFromInput(input: CreateIncidentInput): Promise<{ ok: boolean; error?: string }> {

    const vehicle = this.fleet.getByPlaca(input.placa) ?? { conductor: 'Conductor' };

    const now = new Date().toISOString();

    const incident: Incident = {

      id: generateIncidentId(),

      titulo: input.titulo,

      placa: input.placa,

      conductor: vehicle.conductor,

      categoria: input.categoria,

      severidad: input.severidad,

      estado: 'reportado',

      ubicacion: input.ubicacion,

      lat: input.lat ?? -12.0464,

      lng: input.lng ?? -77.0428,

      descripcion: input.descripcion,

      creado: now,

      actualizado: now,

      asignadoA: null,

      foto: (input.photos?.length ?? 0) > 0,

      audio: !!input.audio

    };

    this._incidents.update((list) => [incident, ...list]);

    return Promise.resolve({ ok: true });

  }



  private async fetchIncidents(): Promise<void> {

    this.loading.set(true);

    try {

      if (!this.supabase.client) {

        this._incidents.set(SEED_INCIDENTS);

        this.loaded.set(true);

        return;

      }



      const { data, error } = await this.supabase.client

        .from('incidents')

        .select(

          `

          *,

          vehicles ( placa, profiles:conductor_id ( full_name ) ),

          incident_attachments ( type )

        `

        )

        .order('created_at', { ascending: false });



      if (error) throw error;



      const rows = (data ?? []) as unknown as Array<

        IncidentRow & {

          vehicles: { placa: string; profiles: { full_name: string } | null } | null;

        }

      >;



      if (rows.length === 0) {

        this._incidents.set([]);

      } else {

        this._incidents.set(

          rows.map((row) =>

            mapIncidentRow({

              ...row,

              vehicles: row.vehicles

                ? {

                    placa: row.vehicles.placa,

                    conductor: row.vehicles.profiles?.full_name ?? null

                  }

                : null

            })

          )

        );

      }

      this.loaded.set(true);

    } catch {

      if (!this.supabase.client) {

        this._incidents.set(SEED_INCIDENTS);

      } else {

        this._incidents.set([]);

      }

      this.loaded.set(true);

    } finally {

      this.loading.set(false);

      this.loadPromise = null;

    }

  }

}


