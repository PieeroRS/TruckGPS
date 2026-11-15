import { Injectable, signal } from '@angular/core';

import { GeoPlace } from '../models/route.model';

/** Destino con el que se abre la pantalla de navegación (se pasa en memoria, no en la dirección). */
@Injectable({ providedIn: 'root' })
export class NavSessionService {
  readonly target = signal<{ dest: GeoPlace; routeId?: string | null; label?: string } | null>(null);
}
