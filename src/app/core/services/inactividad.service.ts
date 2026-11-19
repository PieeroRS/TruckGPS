import { Injectable, effect, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../auth/auth.service';

const EVENTOS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'];

/**
 * Preferencia de seguridad (CP002): cierra la sesión tras N minutos sin usar la app.
 * No actúa en la navegación ni en «Mi ubicación en vivo»: el conductor maneja sin tocar la pantalla.
 */
@Injectable({ providedIn: 'root' })
export class InactividadService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private ultimo = Date.now();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly marcar = () => {
    this.ultimo = Date.now();
  };

  private readonly vigilar = effect(() => {
    const min = this.auth.isLoggedIn() ? this.auth.prefs().seguridad.cerrar_por_inactividad_min : 0;
    this.detener();
    if (!min) return;
    this.ultimo = Date.now();
    EVENTOS.forEach((e) => window.addEventListener(e, this.marcar, { passive: true }));
    this.timer = setInterval(() => this.revisar(min), 20_000);
  });

  start(): void {
    /* el efecto arranca al crear el servicio */
  }

  private revisar(min: number): void {
    const url = this.router.url;
    if (url.startsWith('/navegar') || url.startsWith('/mi-ubicacion')) {
      this.ultimo = Date.now();
      return;
    }
    if (Date.now() - this.ultimo >= min * 60_000) {
      this.detener();
      void this.auth.logout('inactividad');
    }
  }

  private detener(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    EVENTOS.forEach((e) => window.removeEventListener(e, this.marcar));
  }
}
