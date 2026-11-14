import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { SettingsService } from '../core/services/settings.service';
import { AuthService } from './auth.service';

/** Rutas de la app: requiere sesión activa. */
export const authGuard = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const ok = await auth.ensureSession();
  if (ok) return true;
  return router.createUrlTree(['/login'], {
    queryParams: { redirect: router.url && router.url !== '/' ? router.url : undefined }
  });
};

/** Login: si ya hay sesión, ir a la pantalla de inicio del rol. */
export const guestGuard = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const settings = inject(SettingsService);

  const ok = await auth.ensureSession();
  if (ok) {
    await settings.ensureInterfaz();
    return router.createUrlTree(['/' + settings.miInicio()]);
  }
  return true;
};
