import { Injectable, computed, inject, signal } from '@angular/core';

import { AuthService } from '../../auth/auth.service';
import { ApiService } from '../api/api.service';

export interface Umbrales {
  desvio_m: number;
  desvio_alto_m: number;
  velocidad_max_kmh: number;
  velocidad_margen_alta_kmh: number;
  sin_senal_s: number;
  parada_riesgo_min: number;
}

export interface UmbralesResponse {
  valores: Umbrales;
  porDefecto: Umbrales;
  rangos: Record<keyof Umbrales, { min: number; max: number }>;
  actualizadoPor: string | null;
  actualizado: string | null;
}

export type Rol = 'conductor' | 'supervisor' | 'admin';

export interface RolInterfaz {
  modulos: string[];
  inicio: string;
}

export interface InterfazResponse {
  roles: Record<Rol, RolInterfaz>;
  modulos: { key: string; label: string; solo_staff?: boolean }[];
  fijos: Record<Rol, string[]>;
  actualizadoPor: string | null;
  actualizado: string | null;
}

export interface DatosFlota {
  empresa: string;
  ruc: string;
  sede: string;
  telefono_central: string;
  correo_central: string;
}

export interface FlotaResponse {
  datos: DatosFlota;
  unidades: number;
  actualizadoPor: string | null;
  actualizado: string | null;
}

/** Configuración editable: umbrales del motor, interfaz por rol y datos de la flota. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly interfaz = signal<InterfazResponse | null>(null);
  private loadedAt = 0;

  /** Recarga la interfaz si tiene más de un minuto (así un cambio del admin llega sin cerrar sesión). */
  async ensureInterfaz(maxAgeMs = 60_000): Promise<void> {
    if (!this.interfaz() || Date.now() - this.loadedAt > maxAgeMs) await this.loadInterfaz();
  }

  /** Módulos que ve el usuario actual (null = todavía no se cargó: no se oculta nada). */
  readonly misModulos = computed<Set<string> | null>(() => {
    const conf = this.interfaz();
    const rol = this.auth.profile()?.role;
    if (!conf || !rol) return null;
    return new Set(conf.roles[rol]?.modulos ?? []);
  });

  readonly miInicio = computed(() => {
    const conf = this.interfaz();
    const rol = this.auth.profile()?.role;
    return (rol && conf?.roles[rol]?.inicio) || 'dashboard';
  });

  puedeVer(key: string): boolean {
    const mods = this.misModulos();
    return mods === null || mods.has(key);
  }

  async loadInterfaz(): Promise<InterfazResponse | null> {
    try {
      const r = await this.api.get<InterfazResponse>('/settings/interfaz');
      this.interfaz.set(r);
      this.loadedAt = Date.now();
      return r;
    } catch {
      return this.interfaz();
    }
  }

  async saveInterfaz(roles: Record<Rol, RolInterfaz>): Promise<InterfazResponse> {
    const r = await this.api.put<InterfazResponse>('/settings/interfaz', { roles });
    this.interfaz.set(r);
    return r;
  }

  getUmbrales(): Promise<UmbralesResponse> {
    return this.api.get<UmbralesResponse>('/settings/umbrales');
  }

  saveUmbrales(valores: Partial<Umbrales>): Promise<UmbralesResponse> {
    return this.api.put<UmbralesResponse>('/settings/umbrales', { valores });
  }

  resetUmbrales(): Promise<UmbralesResponse> {
    return this.api.post<UmbralesResponse>('/settings/umbrales/restablecer');
  }

  getFlota(): Promise<FlotaResponse> {
    return this.api.get<FlotaResponse>('/settings/flota');
  }

  saveFlota(datos: Partial<DatosFlota>): Promise<FlotaResponse> {
    return this.api.put<FlotaResponse>('/settings/flota', { datos });
  }
}
