import { ApplicationConfig, provideAppInitializer, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { AuthService } from './auth/auth.service';
import { LocationTrackingService } from './core/services/location-tracking.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAppInitializer(async () => {
      const auth = inject(AuthService);
      const tracking = inject(LocationTrackingService);
      await auth.initSession();
      if (auth.isLoggedIn()) {
        await tracking.resumeIfNeeded();
      }
    })
  ]
};
