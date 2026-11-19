import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  message: string;
  okLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

/**
 * Confirmación dentro de la app. Reemplaza a window.confirm, que en algunos
 * navegadores integrados (y en la app Android) no muestra el diálogo y devuelve false.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<ConfirmRequest | null>(null);

  ask(message: string, opts: { okLabel?: string; danger?: boolean } = {}): Promise<boolean> {
    // Preferencia de seguridad: el usuario puede pedir que no se le confirme cada acción.
    if (this.skipByPreference()) return Promise.resolve(true);
    this.current()?.resolve(false);
    return new Promise((resolve) => {
      this.current.set({ message, okLabel: opts.okLabel ?? 'Aceptar', danger: opts.danger ?? true, resolve });
    });
  }

  answer(ok: boolean): void {
    const req = this.current();
    this.current.set(null);
    req?.resolve(ok);
  }

  private skipByPreference(): boolean {
    try {
      // Se lee del perfil guardado para no crear una dependencia circular con AuthService.
      const raw = localStorage.getItem('truckgps_profile');
      const prefs = raw ? (JSON.parse(raw) as { preferencias?: { seguridad?: { confirmar_acciones?: boolean } } }).preferencias : null;
      return prefs?.seguridad?.confirmar_acciones === false;
    } catch {
      return false;
    }
  }
}
