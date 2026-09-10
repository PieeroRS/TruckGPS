import { Injectable, inject } from '@angular/core';

import { AuthService, UserProfile } from '../../auth/auth.service';
import { ApiService } from '../api/api.service';
import { apiErrorMessage } from '../utils/api-error.util';

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
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  canManageTeam(): boolean {
    const role = this.auth.profile()?.role;
    return role === 'admin' || role === 'supervisor';
  }

  async list(): Promise<ProfileRow[]> {
    try {
      return await this.api.get<ProfileRow[]>('/profiles');
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo cargar el equipo'));
    }
  }

  async update(id: string, input: UpdateProfileInput): Promise<void> {
    try {
      await this.api.patch(`/profiles/${id}`, input);
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'No se pudo actualizar el perfil'));
    }
    if (id === this.auth.profile()?.id) {
      await this.auth.refreshProfile();
    }
  }

  async createDriver(input: CreateDriverInput): Promise<{ ok: boolean; error?: string }> {
    if (!this.canManageTeam()) {
      return { ok: false, error: 'No tienes permiso para crear conductores.' };
    }
    try {
      await this.api.post('/profiles', {
        full_name: input.full_name.trim(),
        email: input.email.trim().toLowerCase(),
        password: input.password,
        role: input.role ?? 'conductor'
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: apiErrorMessage(e, 'No se pudo crear el usuario.') };
    }
  }
}
