import { Injectable, Injector, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ApiService } from '../core/api/api.service';
import { TOKEN_KEY } from '../core/api/auth.interceptor';
import { apiErrorMessage } from '../core/utils/api-error.util';

export type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'supervisor' | 'conductor';
};

type LoginResponse = {
  access_token: string;
  token_type: string;
  profile: UserProfile;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  readonly isLoggedIn = signal(false);
  readonly profile = signal<UserProfile | null>(null);
  readonly useBackend = true;

  isStaff(): boolean {
    const role = this.profile()?.role;
    return role === 'admin' || role === 'supervisor';
  }

  initials(): string {
    const name = this.profile()?.full_name?.trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  roleLabel(): string {
    const role = this.profile()?.role;
    if (role === 'admin') return 'Administrador';
    if (role === 'supervisor') return 'Supervisor';
    if (role === 'conductor') return 'Conductor';
    return 'Usuario';
  }

  async refreshProfile(): Promise<void> {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    try {
      const profile = await this.api.get<UserProfile>('/auth/me');
      this.profile.set(profile);
      this.isLoggedIn.set(true);
    } catch {
      this.clearSession();
    }
  }

  async updateOwnProfile(fullName: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const profile = await this.api.patch<UserProfile>('/auth/me', { full_name: fullName.trim() });
      this.profile.set(profile);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: apiErrorMessage(e, 'No se pudo actualizar el perfil') };
    }
  }

  async initSession(): Promise<void> {
    await this.ensureSession();
  }

  async ensureSession(): Promise<boolean> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      this.clearSession(false);
      return false;
    }
    try {
      const profile = await this.api.get<UserProfile>('/auth/me');
      this.profile.set(profile);
      this.isLoggedIn.set(true);
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }

  async login(identifier: string, password: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const data = await this.api.post<LoginResponse>('/auth/login', {
        email: identifier,
        password
      });
      localStorage.setItem(TOKEN_KEY, data.access_token);
      this.profile.set(data.profile);
      this.isLoggedIn.set(true);
      try {
        const { LocationTrackingService } = await import('../core/services/location-tracking.service');
        await this.injector.get(LocationTrackingService).resumeIfNeeded();
      } catch {
        /* ignore */
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: apiErrorMessage(e, 'Credenciales inválidas') };
    }
  }

  async logout(): Promise<void> {
    try {
      const { LocationTrackingService } = await import('../core/services/location-tracking.service');
      await this.injector.get(LocationTrackingService).stop(true);
    } catch {
      /* ignore */
    }
    this.clearSession();
    await this.router.navigateByUrl('/login');
  }

  async logoutConfirm(): Promise<void> {
    if (typeof window !== 'undefined' && !window.confirm('¿Cerrar sesión en TruckGPS?')) {
      return;
    }
    await this.logout();
  }

  private clearSession(removeToken = true): void {
    if (removeToken) localStorage.removeItem(TOKEN_KEY);
    this.isLoggedIn.set(false);
    this.profile.set(null);
  }
}
