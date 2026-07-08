import { Injectable, inject } from '@angular/core';

import { AuthService, UserProfile } from '../../auth/auth.service';
import { SupabaseService } from '../supabase/supabase.service';

export type ProfileRole = UserProfile['role'];

export interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: ProfileRole;
  created_at: string;
}

export interface CreateDriverInput {
  full_name: string;
  email: string;
  password: string;
  role?: ProfileRole;
}

export interface UpdateProfileInput {
  full_name?: string;
  role?: ProfileRole;
}

@Injectable({ providedIn: 'root' })
export class ProfilesService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  canManageTeam(): boolean {
    const role = this.auth.profile()?.role;
    return role === 'admin' || role === 'supervisor';
  }

  async list(): Promise<ProfileRow[]> {
    if (!this.supabase.client) return [];

    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('id, full_name, email, role, created_at')
      .order('full_name');

    if (error) throw new Error(error.message);
    return (data ?? []) as ProfileRow[];
  }

  async update(id: string, input: UpdateProfileInput): Promise<void> {
    if (!this.supabase.client) throw new Error('Supabase no configurado');

    const patch: Record<string, string> = {};
    if (input.full_name !== undefined) patch['full_name'] = input.full_name.trim();
    if (input.role !== undefined) patch['role'] = input.role;

    const { error } = await this.supabase.client.from('profiles').update(patch).eq('id', id);
    if (error) throw new Error(error.message);

    if (id === this.auth.profile()?.id) {
      await this.auth.refreshProfile();
    }
  }

  async createDriver(input: CreateDriverInput): Promise<{ ok: boolean; error?: string }> {
    if (!this.supabase.client) {
      return { ok: false, error: 'Supabase no configurado' };
    }

    if (!this.canManageTeam()) {
      return { ok: false, error: 'No tienes permiso para crear conductores.' };
    }

    const email = input.email.trim().toLowerCase();
    const role = input.role ?? 'conductor';

    const { data, error } = await this.supabase.client.auth.signUp({
      email,
      password: input.password,
      options: {
        data: {
          full_name: input.full_name.trim(),
          role
        }
      }
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data.user) {
      return { ok: false, error: 'No se pudo crear el usuario.' };
    }

    return { ok: true };
  }
}
