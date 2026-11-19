import { Injectable, inject, signal } from '@angular/core';
import * as L from 'leaflet';

import { ApiService } from '../api/api.service';

interface CapaTrafico {
  disponible: boolean;
  url?: string;
  expira?: number;
}

const PREF_KEY = 'truckgps_trafico';
const REFRESH_MS = 2 * 60 * 1000;

/**
 * Tráfico en vivo sobre el mapa (calles verdes, naranjas y rojas, como en Google Maps).
 * Los cuadros los entrega el servidor desde TomTom; la clave nunca llega al navegador.
 */
@Injectable({ providedIn: 'root' })
export class TrafficLayerService {
  private readonly api = inject(ApiService);

  /** Preferencia del usuario (se recuerda en este equipo). */
  readonly enabled = signal(this.readPref());
  /** El servidor tiene TomTom configurado (null mientras no se sabe). */
  readonly available = signal<boolean | null>(null);
  private capa: CapaTrafico | null = null;
  private loading: Promise<CapaTrafico> | null = null;

  private readPref(): boolean {
    try {
      return localStorage.getItem(PREF_KEY) !== '0';
    } catch {
      return true;
    }
  }

  setEnabled(on: boolean): void {
    this.enabled.set(on);
    try {
      localStorage.setItem(PREF_KEY, on ? '1' : '0');
    } catch {
      /* sin almacenamiento: solo dura esta sesión */
    }
  }

  private async info(): Promise<CapaTrafico> {
    const vence = (this.capa?.expira ?? 0) * 1000 - 10 * 60 * 1000;
    if (this.capa && (!this.capa.disponible || Date.now() < vence)) return this.capa;
    this.loading ??= this.api
      .get<CapaTrafico>('/mapas/capa-trafico')
      .catch(() => ({ disponible: false }) as CapaTrafico)
      .then((c) => {
        this.capa = c;
        this.available.set(c.disponible);
        this.loading = null;
        return c;
      });
    return this.loading;
  }

  /**
   * Agrega al mapa el botón «Tráfico» y la capa. Si TomTom no está configurado no muestra nada.
   * Devuelve una función para quitarlo (llamarla al destruir el componente).
   */
  attach(map: L.Map, opts: { position?: L.ControlPosition } = {}): () => void {
    let layer: L.TileLayer | null = null;
    let control: L.Control | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let alive = true;

    const bucket = () => Math.floor(Date.now() / REFRESH_MS);
    const tileUrl = (c: CapaTrafico) => `${this.api.baseUrl}${c.url}&v=${bucket()}`;

    const show = async () => {
      const c = await this.info();
      if (!alive || !c.disponible || !c.url) return;
      if (!layer) {
        layer = L.tileLayer(tileUrl(c), {
          minZoom: 6,
          maxZoom: 18,
          zIndex: 5,
          opacity: 0.9,
          attribution: 'Tráfico &copy; TomTom',
          // Si un cuadro falla (sin señal o cupo agotado) se deja vacío: el mapa sigue funcionando.
          errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
        });
      }
      if (!map.hasLayer(layer)) layer.addTo(map);
      timer ??= setInterval(async () => {
        if (document.hidden || !layer) return;
        const fresh = await this.info();
        if (fresh.disponible && fresh.url) layer.setUrl(tileUrl(fresh));
      }, REFRESH_MS);
    };

    const hide = () => {
      if (layer && map.hasLayer(layer)) map.removeLayer(layer);
      if (timer) clearInterval(timer);
      timer = null;
    };

    void this.info().then((c) => {
      if (!alive || !c.disponible) return;
      const Ctl = L.Control.extend({
        onAdd: () => {
          const box = L.DomUtil.create('div', 'leaflet-bar traffic-toggle');
          const btn = L.DomUtil.create('button', '', box);
          btn.type = 'button';
          const legend = L.DomUtil.create('div', 'traffic-legend', box);
          legend.innerHTML =
            '<span><i style="background:#22c55e"></i>Fluido</span><span><i style="background:#f59e0b"></i>Lento</span><span><i style="background:#dc2626"></i>Congestión</span>';
          const paint = () => {
            const on = this.enabled();
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="3"/><circle cx="12" cy="7" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="17" r="1.6" fill="currentColor"/></svg><span>Tráfico</span>`;
            btn.setAttribute('aria-pressed', String(on));
            btn.title = on ? 'Ocultar el tráfico en vivo' : 'Ver el tráfico en vivo';
            box.classList.toggle('is-on', on);
          };
          paint();
          L.DomEvent.disableClickPropagation(box);
          L.DomEvent.on(btn, 'click', () => {
            this.setEnabled(!this.enabled());
            paint();
            if (this.enabled()) void show();
            else hide();
          });
          return box;
        }
      });
      control = new Ctl({ position: opts.position ?? 'topright' });
      control.addTo(map);
      if (this.enabled()) void show();
    });

    return () => {
      alive = false;
      hide();
      control?.remove();
      layer?.remove();
    };
  }
}
