import { ApplicationConfig, provideAppInitializer, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { PreloadAllModules, provideRouter, withPreloading } from '@angular/router';

import { routes } from './app.routes';
import { AuthService } from './auth/auth.service';
import { authInterceptor } from './core/api/auth.interceptor';
import { OfflineQueueService } from './core/services/offline-queue.service';
import { LocationTrackingService } from './core/services/location-tracking.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Todas las pantallas se descargan al abrir la app, para que sigan disponibles si luego se pierde la señal.
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideAppInitializer(async () => {
      const auth = inject(AuthService);
      const tracking = inject(LocationTrackingService);
      inject(OfflineQueueService).start();
      await auth.initSession();
      if (auth.isLoggedIn()) {
        await tracking.resumeIfNeeded();
      }
    })
  ]
};
