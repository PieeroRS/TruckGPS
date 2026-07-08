import { inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';

export const supervisorGuard = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const ok = await auth.ensureSession();
  if (!ok) return router.createUrlTree(['/login']);

  await auth.refreshProfile();

  const role = auth.profile()?.role;
  if (role === 'admin' || role === 'supervisor') return true;

  return router.createUrlTree(['/dashboard']);
};
