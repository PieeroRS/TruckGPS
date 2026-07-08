import { inject } from '@angular/core';
import { Router } from '@angular/router';
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

/** Login: si ya hay sesión, ir al dashboard. */
export const guestGuard = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const ok = await auth.ensureSession();
  if (ok) return router.createUrlTree(['/dashboard']);
  return true;
};
