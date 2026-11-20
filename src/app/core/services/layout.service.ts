import { Injectable, signal } from '@angular/core';

export interface PageMeta {
  title: string;
  subtitle: string;
}

@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly pageMeta = signal<PageMeta>({
    title: 'Dashboard',
    subtitle: 'Centro de control · Operaciones en tiempo real'
  });

  setPage(title: string, subtitle: string): void {
    this.pageMeta.set({ title, subtitle });
  }

  /** Aviso breve abajo de la pantalla (p. ej. resultado de una acción sobre una alerta que ya se cerró). */
  readonly aviso = signal<{ texto: string; error: boolean } | null>(null);
  private avisoTimer: ReturnType<typeof setTimeout> | null = null;

  avisar(texto: string, error = false): void {
    this.aviso.set({ texto, error });
    if (this.avisoTimer) clearTimeout(this.avisoTimer);
    this.avisoTimer = setTimeout(() => this.aviso.set(null), 7000);
  }
}
