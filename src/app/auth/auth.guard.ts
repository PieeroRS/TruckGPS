import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const ok = await auth.ensureSession();
  if (ok) return true;
  return router.createUrlTree(['/login']);
};
