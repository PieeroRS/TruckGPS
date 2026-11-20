import { ConfirmService } from '../core/services/confirm.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, Injector, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ApiService } from '../core/api/api.service';
import { TOKEN_KEY } from '../core/api/auth.interceptor';
import { apiErrorMessage } from '../core/utils/api-error.util';

export type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'supervisor' | 'conductor';
  telefono?: string | null;
  licencia?: string | null;
  email_verificado?: boolean;
  onboarding_ok?: boolean;
  preferencias?: Preferencias;
};

export type Preferencias = {
  seguridad: { cerrar_por_inactividad_min: number; confirmar_acciones: boolean };
  notificaciones: {
    en_app: boolean;
    sonido: boolean;
    correo: boolean;
    alta_severidad: boolean;
    desvios: boolean;
    velocidad: boolean;
    incidencias: boolean;
  };
};

export const PREFERENCIAS_DEFAULT: Preferencias = {
  seguridad: { cerrar_por_inactividad_min: 0, confirmar_acciones: true },
  notificaciones: { en_app: true, sonido: true, correo: false, alta_severidad: true, desvios: true, velocidad: true, incidencias: true }
};

export type Resultado = { ok: boolean; error?: string; mensaje?: string; noVerificado?: boolean };

const PROFILE_KEY = 'truckgps_profile';

/** El servidor dijo que la sesión ya no vale (no es un problema de conexión). */
function sessionRejected(e: unknown): boolean {
  return e instanceof HttpErrorResponse && (e.status === 401 || e.status === 403);
}

type LoginResponse = {
  access_token: string;
  token_type: string;
  profile: UserProfile;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly confirmDialog = inject(ConfirmService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  readonly isLoggedIn = signal(false);
  readonly profile = signal<UserProfile | null>(null);
  readonly useBackend = true;

  private validatedAt = 0;
  private validating: Promise<boolean> | null = null;
  /** El perfil se guarda en el equipo para poder abrir la app sin señal. */
  private readonly persistProfile = effect(() => {
    const p = this.profile();
    try {
      if (p) localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    } catch {
      /* almacenamiento lleno o bloqueado */
    }
  });

  private cachedProfile(): UserProfile | null {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? (JSON.parse(raw) as UserProfile) : null;
    } catch {
      return null;
    }
  }

  /** Consulta el perfil al servidor. Sin conexión no se cierra la sesión: se sigue con el perfil guardado. */
  private validate(): Promise<boolean> {
    this.validating ??= (async () => {
      try {
        const profile = await this.api.get<UserProfile>('/auth/me');
        this.profile.set(profile);
        this.isLoggedIn.set(true);
        this.validatedAt = Date.now();
        return true;
      } catch (e) {
        if (sessionRejected(e)) {
          const estaba = this.isLoggedIn();
          this.clearSession();
          if (estaba) void this.router.navigate(['/login']);
          return false;
        }
        return this.isLoggedIn();
      } finally {
        this.validating = null;
      }
    })();
    return this.validating;
  }

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
    await this.validate();
  }

  async updateOwnProfile(
    data: string | { full_name?: string; telefono?: string; licencia?: string }
  ): Promise<{ ok: boolean; error?: string }> {
    const body = typeof data === 'string' ? { full_name: data.trim() } : data;
    try {
      const profile = await this.api.patch<UserProfile>('/auth/me', body);
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
    if (!this.profile()) {
      // Al abrir la app: con un perfil guardado se entra de inmediato, aunque no haya señal.
      const guardado = this.cachedProfile();
      if (!guardado) return this.validate();
      this.profile.set(guardado);
      this.isLoggedIn.set(true);
    }
    // Ya hay sesión: no se bloquea la navegación; se revalida en segundo plano cada minuto.
    if (Date.now() - this.validatedAt > 60_000) void this.validate();
    return true;
  }

  /** Preferencias del usuario actual (con valores por defecto si aún no las guardó). */
  prefs(): Preferencias {
    return this.profile()?.preferencias ?? PREFERENCIAS_DEFAULT;
  }

  private startSession(data: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, data.access_token);
    this.validatedAt = Date.now();
    this.profile.set(data.profile);
    this.isLoggedIn.set(true);
  }

  // ─────────── cuentas: registro, verificación y recuperación ───────────

  async register(body: { full_name: string; email: string; password: string; password2: string }): Promise<Resultado & { correoEnviado?: boolean }> {
    try {
      const r = await this.api.post<{ mensaje: string; correoEnviado: boolean }>('/auth/registro', body);
      return { ok: true, mensaje: r.mensaje, correoEnviado: r.correoEnviado };
    } catch (e) {
      return { ok: false, error: apiErrorMessage(e, 'No se pudo crear la cuenta') };
    }
  }

  async verifyEmail(token: string): Promise<Resultado> {
    try {
      this.startSession(await this.api.post<LoginResponse>('/auth/verificar', { token }));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: apiErrorMessage(e, 'No se pudo verificar el correo') };
    }
  }

  async resendVerification(email: string): Promise<Resultado> {
    try {
      const r = await this.api.post<{ mensaje: string }>('/auth/reenviar-verificacion', { email });
      return { ok: true, mensaje: r.mensaje };
    } catch (e) {
      return { ok: false, error: apiErrorMessage(e, 'No se pudo reenviar el correo') };
    }
  }

  async requestReset(email: string): Promise<Resultado> {
    try {
      const r = await this.api.post<{ mensaje: string }>('/auth/recuperar', { email });
      return { ok: true, mensaje: r.mensaje };
    } catch (e) {
      return { ok: false, error: apiErrorMessage(e, 'No se pudo enviar el enlace') };
    }
  }

  async checkResetToken(token: string): Promise<Resultado & { email?: string }> {
    try {
      const r = await this.api.get<{ email: string }>(`/auth/restablecer/validar?token=${encodeURIComponent(token)}`);
      return { ok: true, email: r.email };
    } catch (e) {
      return { ok: false, error: apiErrorMessage(e, 'El enlace no es válido') };
    }
  }

  async resetPassword(token: string, password: string, password2: string): Promise<Resultado> {
    try {
      const r = await this.api.post<{ mensaje: string }>('/auth/restablecer', { token, password, password2 });
      return { ok: true, mensaje: r.mensaje };
    } catch (e) {
      return { ok: false, error: apiErrorMessage(e, 'No se pudo cambiar la contraseña') };
    }
  }

  async savePreferences(preferencias: Preferencias, completarAsistente = false): Promise<Resultado> {
    try {
      this.profile.set(await this.api.put<UserProfile>('/auth/me/preferencias', { preferencias, onboarding_ok: completarAsistente }));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: apiErrorMessage(e, 'No se pudieron guardar las preferencias') };
    }
  }

  async changePassword(actual: string, nueva: string, nueva2: string): Promise<Resultado> {
    try {
      const r = await this.api.post<{ mensaje: string }>('/auth/me/password', { actual, nueva, nueva2 });
      return { ok: true, mensaje: r.mensaje };
    } catch (e) {
      return { ok: false, error: apiErrorMessage(e, 'No se pudo cambiar la contraseña') };
    }
  }

  async login(identifier: string, password: string): Promise<Resultado> {
    try {
      const data = await this.api.post<LoginResponse>('/auth/login', {
        email: identifier,
        password
      });
      this.startSession(data);
      try {
        const { LocationTrackingService } = await import('../core/services/location-tracking.service');
        // Sin await: si el navegador pide permiso de ubicación, el inicio de sesión no debe quedarse esperando.
        void this.injector.get(LocationTrackingService).resumeIfNeeded();
      } catch {
        /* ignore */
      }
      return { ok: true };
    } catch (e) {
      const noVerificado = e instanceof HttpErrorResponse && e.status === 403 && /verificad/i.test(apiErrorMessage(e, ''));
      return { ok: false, error: apiErrorMessage(e, 'Credenciales inválidas'), noVerificado };
    }
  }

  async logout(motivo?: string): Promise<void> {
    try {
      const { LocationTrackingService } = await import('../core/services/location-tracking.service');
      await this.injector.get(LocationTrackingService).stop(true);
    } catch {
      /* ignore */
    }
    this.clearSession();
    await this.router.navigate(['/login'], motivo ? { queryParams: { motivo } } : {});
  }

  async logoutConfirm(): Promise<void> {
    if (!(await this.confirmDialog.ask('¿Cerrar sesión en TruckGPS?', { okLabel: 'Cerrar sesión' }))) {
      return;
    }
    await this.logout('salida');
  }

  private clearSession(removeToken = true): void {
    if (removeToken) localStorage.removeItem(TOKEN_KEY);
    if (removeToken) localStorage.removeItem(PROFILE_KEY);
    this.validatedAt = 0;
    this.isLoggedIn.set(false);
    this.profile.set(null);
  }
}
