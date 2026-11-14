import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router } from '@angular/router';

import { SettingsService } from '../core/services/settings.service';
import { AuthService } from './auth.service';

async function loadConfig(): Promise<{ auth: AuthService; settings: SettingsService; router: Router } | null> {
  const auth = inject(AuthService);
  const settings = inject(SettingsService);
  const router = inject(Router);
  if (!(await auth.ensureSession())) return null;
  await settings.ensureInterfaz();
  return { auth, settings, router };
}

/** Bloquea los módulos que el administrador ocultó para el rol del usuario. */
export const moduleGuard = async (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const ctx = await loadConfig();
  if (!ctx) return router.createUrlTree(['/login']);
  const key = route.data?.['modulo'] as string | undefined;
  if (!key || ctx.settings.puedeVer(key)) return true;
  return router.createUrlTree(['/' + ctx.settings.miInicio()], { queryParams: { oculto: key } });
};

/** Pantalla de inicio configurada para el rol. */
export const homeGuard = async () => {
  const router = inject(Router);
  const ctx = await loadConfig();
  if (!ctx) return router.createUrlTree(['/login']);
  return router.createUrlTree(['/' + ctx.settings.miInicio()]);
};
