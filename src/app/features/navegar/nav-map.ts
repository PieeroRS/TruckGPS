import maplibregl, { GeoJSONSource, LngLatBoundsLike, Map as MlMap, Marker, StyleSpecification } from 'maplibre-gl';

import { TrafficEvent } from '../../core/models/route.model';

export type LatLng = [number, number];
export interface TrafficSection {
  desde: number;
  hasta: number;
  nivel: 'lento' | 'pesado' | 'detenido';
}

/** De noche (18:00–6:00) el mapa se oscurece para no encandilar al conductor. */
export function isNight(d = new Date()): boolean {
  const h = d.getHours();
  return h >= 18 || h < 6;
}

const TRAFFIC_COLOR: Record<TrafficSection['nivel'], string> = {
  lento: '#f59e0b',
  pesado: '#ef4444',
  detenido: '#991b1b'
};

const ll = (p: LatLng): [number, number] => [p[1], p[0]];

export interface NavTiles {
  /** Mapa base de TomTom en imágenes ({estilo}: main o night). Respaldo si el mapa vectorial no carga. */
  base: string;
  /** Tráfico en imágenes (respaldo). */
  traffic?: string;
  /** Tráfico en vectores: líneas con traffic_level de 0 (detenido) a 1 (fluido). */
  flujo?: string;
}

export interface NavStyle {
  style: StyleSpecification;
  /** Dirección de los cuadros de tráfico (para refrescarlos cada 2 minutos). */
  flow: string | null;
  vectorial: boolean;
}

/** Colores del tráfico, de más lento a fluido (los mismos de la leyenda). */
export const FLOW_COLORS = { detenido: '#7f1d1d', congestion: '#dc2626', lento: '#f59e0b', fluido: '#22c55e' };

const ROUTE_LAYERS = (night: boolean): StyleSpecification['layers'] => {
  const route = night ? { main: '#22b8f0', casing: '#0b3a5c' } : { main: '#1a73e8', casing: '#0d47a1' };
  return [
    {
      id: 'route-casing',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': route.casing, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 10, 5, 14, 9, 17, 18, 19, 30] }
    },
    {
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': route.main, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 10, 3, 14, 6, 17, 12, 19, 22] }
    },
    {
      id: 'route-traffic',
      type: 'line',
      source: 'traffic',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 10, 3, 14, 6, 17, 12, 19, 22] }
    }
  ];
};

const FLOW_LAYERS: StyleSpecification['layers'] = [
  {
    id: 'flow',
    type: 'line',
    source: 'flow',
    'source-layer': 'Traffic flow',
    filter: ['!', ['to-boolean', ['get', 'road_closure']]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': [
        'step',
        ['to-number', ['get', 'traffic_level'], 1],
        FLOW_COLORS.detenido,
        0.25,
        FLOW_COLORS.congestion,
        0.5,
        FLOW_COLORS.lento,
        0.75,
        FLOW_COLORS.fluido
      ],
      'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, 1.2, 14, 2.6, 17, 5, 19, 9],
      'line-opacity': 0.9
    }
  },
  {
    id: 'flow-closed',
    type: 'line',
    source: 'flow',
    'source-layer': 'Traffic flow',
    filter: ['to-boolean', ['get', 'road_closure']],
    paint: {
      'line-color': FLOW_COLORS.detenido,
      'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, 1.5, 17, 6],
      'line-dasharray': [1, 1]
    }
  }
];

const EMPTY = { type: 'geojson' as const, data: { type: 'FeatureCollection' as const, features: [] } };

/** Los nombres salen en español cuando el mapa los tiene. */
function spanishLabels(layers: StyleSpecification['layers']): void {
  for (const l of layers) {
    if (l.type !== 'symbol' || !l.layout) continue;
    const tf = (l.layout as Record<string, unknown>)['text-field'];
    if (tf && JSON.stringify(tf).includes('name')) {
      (l.layout as Record<string, unknown>)['text-field'] = ['coalesce', ['get', 'name:es'], ['get', 'name:latin'], ['get', 'name']];
    }
  }
}

async function fetchJson(url: string, ms: number): Promise<StyleSpecification> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()) as StyleSpecification;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Arma el estilo del mapa de navegación. Primero intenta el mapa vectorial (OpenFreeMap: suave al
 * girar, nombres siempre derechos); si no carga, usa el mapa en imágenes de TomTom.
 */
export async function buildNavStyle(night: boolean, tiles: NavTiles | null): Promise<NavStyle> {
  const flowVector = tiles?.flujo ? NavMap.flowUrl(tiles.flujo) : null;
  try {
    const st = await fetchJson(`https://tiles.openfreemap.org/styles/${night ? 'dark' : 'liberty'}`, 6000);
    spanishLabels(st.layers);
    st.sources = { ...st.sources, route: EMPTY, traffic: EMPTY };
    if (flowVector) {
      st.sources['flow'] = { type: 'vector', tiles: [flowVector], minzoom: 6, maxzoom: 18, attribution: 'Tráfico © TomTom' };
    }
    // Tráfico y ruta encima de las calles, pero debajo de los nombres (como en los GPS).
    let i = -1;
    st.layers.forEach((l, k) => {
      if ((l as { 'source-layer'?: string })['source-layer'] === 'transportation' && l.type === 'line') i = k;
    });
    const at = i >= 0 ? i + 1 : st.layers.findIndex((l) => l.type === 'symbol');
    const extra = [...(flowVector ? FLOW_LAYERS : []), ...ROUTE_LAYERS(night)];
    st.layers.splice(at >= 0 ? at : st.layers.length, 0, ...extra);
    return { style: st, flow: tiles?.flujo ?? null, vectorial: true };
  } catch {
    // Respaldo: mapa en imágenes.
  }
  const baseTiles = tiles ? [tiles.base.replace('{estilo}', night ? 'night' : 'main')] : ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];
  const style: StyleSpecification = {
    version: 8,
    sources: {
      base: { type: 'raster', tiles: baseTiles, tileSize: 256, maxzoom: 18, attribution: tiles ? '© TomTom' : '© OpenStreetMap' },
      ...(tiles?.traffic
        ? { flow: { type: 'raster' as const, tiles: [NavMap.flowUrl(tiles.traffic)], tileSize: 256, minzoom: 6, maxzoom: 18, attribution: 'Tráfico © TomTom' } }
        : {}),
      route: EMPTY,
      traffic: EMPTY
    },
    layers: [
      { id: 'base', type: 'raster', source: 'base', paint: night ? {} : { 'raster-saturation': -0.15 } },
      ...(tiles?.traffic ? [{ id: 'flow', type: 'raster' as const, source: 'flow', paint: { 'raster-opacity': night ? 0.85 : 0.75, 'raster-fade-duration': 0 } }] : []),
      ...ROUTE_LAYERS(night)
    ]
  };
  return { style, flow: tiles?.traffic ?? null, vectorial: false };
}

/**
 * Mapa de la navegación: gira con el rumbo del vehículo, se inclina hacia adelante y deja
 * el vehículo en la parte baja de la pantalla, para ver lo que viene (como un GPS de auto).
 */
export class NavMap {
  readonly map: MlMap;
  private me: Marker | null = null;
  private meEl: HTMLDivElement | null = null;
  private dest: Marker | null = null;
  private closures: Marker[] = [];
  private loaded = false;
  private pending: (() => void)[] = [];
  private following = true;
  private onUserMove: (() => void) | null = null;

  constructor(el: HTMLElement, center: LatLng, built: NavStyle) {
    const style = built.style;
    this.map = new maplibregl.Map({
      container: el,
      style,
      center: ll(center),
      zoom: 14,
      pitch: 0,
      attributionControl: { compact: true },
      dragRotate: true,
      pitchWithRotate: true,
      maxPitch: 65,
      fadeDuration: 150,
      // Más cuadros en memoria: al girar y volver no se recargan.
      maxTileCacheZoomLevels: 6
    });
    this.trafficBase = built.flow;
    if (this.trafficBase) {
      this.flowTimer = setInterval(() => {
        const src = this.map.getSource('flow') as { setTiles?: (t: string[]) => void } | undefined;
        if (!document.hidden && src?.setTiles && this.trafficBase) src.setTiles([NavMap.flowUrl(this.trafficBase)]);
      }, 120000);
    }
    this.map.on('load', () => {
      this.loaded = true;
      this.pending.splice(0).forEach((fn) => fn());
    });
    // Si el conductor mueve el mapa con el dedo, se deja de seguir al vehículo hasta que toque «Centrar».
    const manual = (e: { originalEvent?: unknown }) => {
      if (!e.originalEvent || !this.following) return;
      this.following = false;
      this.onUserMove?.();
    };
    this.map.on('dragstart', manual);
    this.map.on('rotatestart', manual);
    this.map.on('pitchstart', manual);
    this.map.on('zoomstart', manual);
  }

  private flowTimer: ReturnType<typeof setInterval> | null = null;

  /** Los cuadros de tráfico cambian cada 2 minutos: el número del final hace que se pidan de nuevo. */
  static flowUrl(base: string): string {
    return `${base}&v=${Math.floor(Date.now() / 120000)}`;
  }

  /** Muestra u oculta el tráfico en vivo de las calles. */
  setTrafficVisible(on: boolean): void {
    this.whenLoaded(() => {
      for (const id of ['flow', 'flow-closed']) {
        if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
      }
    });
  }

  hasTraffic(): boolean {
    return !!this.trafficBase;
  }

  private trafficBase: string | null = null;

  private whenLoaded(fn: () => void): void {
    if (this.loaded) fn();
    else this.pending.push(fn);
  }

  onManualMove(cb: () => void): void {
    this.onUserMove = cb;
  }

  setFollowing(on: boolean): void {
    this.following = on;
  }

  resize(): void {
    this.map.resize();
  }

  setRoute(path: LatLng[], tramos: TrafficSection[] = []): void {
    this.whenLoaded(() => {
      (this.map.getSource('route') as GeoJSONSource).setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: path.map(ll) }
      });
      const feats = tramos
        .filter((t) => t.hasta > t.desde && t.desde < path.length)
        .map((t) => ({
          type: 'Feature' as const,
          properties: { color: TRAFFIC_COLOR[t.nivel] ?? TRAFFIC_COLOR.lento },
          geometry: { type: 'LineString' as const, coordinates: path.slice(t.desde, Math.min(path.length, t.hasta + 1)).map(ll) }
        }));
      (this.map.getSource('traffic') as GeoJSONSource).setData({ type: 'FeatureCollection', features: feats });
    });
  }

  /** Vista de toda la ruta desde arriba (al empezar, antes de seguir al vehículo). */
  overview(path: LatLng[], bottomPad = 160): void {
    if (path.length < 2) return;
    const b = new maplibregl.LngLatBounds(ll(path[0]), ll(path[0]));
    path.forEach((p) => b.extend(ll(p)));
    this.map.fitBounds(b as LngLatBoundsLike, { padding: { top: 130, bottom: bottomPad, left: 40, right: 84 }, bearing: 0, pitch: 0, duration: 800 });
  }

  setDest(p: LatLng): void {
    this.dest?.remove();
    const el = document.createElement('div');
    el.className = 'nav-dest';
    el.setAttribute('aria-label', 'Destino');
    this.dest = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(ll(p)).addTo(this.map);
  }

  setClosures(list: TrafficEvent[]): void {
    this.closures.forEach((m) => m.remove());
    this.closures = list.map((c) => {
      const el = document.createElement('div');
      el.className = 'nav-closure';
      el.title = `Calle cerrada: ${c.descripcion}`;
      return new maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(this.map);
    });
  }

  /**
   * Coloca el vehículo y, si se está siguiendo, mueve la cámara: mapa girado al rumbo,
   * inclinado, y el vehículo en el tercio de abajo para ver más calle por delante.
   */
  setMe(p: LatLng, rumbo: number, speedMs: number, guiding: boolean): void {
    if (!this.me) {
      this.meEl = document.createElement('div');
      this.meEl.className = 'nav-puck';
      this.meEl.innerHTML = '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><path d="M20 4 33 34 20 27 7 34Z"/></svg>';
      this.me = new maplibregl.Marker({ element: this.meEl, rotationAlignment: 'map', pitchAlignment: 'viewport' }).setLngLat(ll(p)).addTo(this.map);
    } else {
      this.me.setLngLat(ll(p));
    }
    this.me.setRotation(rumbo);
    if (!this.following) return;
    const h = this.map.getContainer().clientHeight || 600;
    if (guiding) {
      // Más rápido = más lejos, para ver la siguiente maniobra con tiempo.
      const zoom = speedMs > 22 ? 15.6 : speedMs > 12 ? 16.4 : 17.2;
      this.map.easeTo({
        center: ll(p),
        bearing: rumbo,
        pitch: 55,
        zoom,
        padding: { top: Math.round(h * 0.38), bottom: 0, left: 0, right: 0 },
        duration: 900,
        easing: (t) => t
      });
    } else {
      this.map.easeTo({ center: ll(p), zoom: Math.max(this.map.getZoom(), 15), duration: 600 });
    }
  }

  /** Vuelve a seguir al vehículo con la vista de manejo. */
  recenter(p: LatLng | null, rumbo: number): void {
    this.following = true;
    if (p) this.setMe(p, rumbo, 0, true);
  }

  /** Mapa con el norte arriba (para mirar alrededor). */
  northUp(): void {
    this.following = false;
    this.map.easeTo({ bearing: 0, pitch: 0, duration: 600 });
  }

  remove(): void {
    if (this.flowTimer) clearInterval(this.flowTimer);
    this.map.remove();
  }
}
