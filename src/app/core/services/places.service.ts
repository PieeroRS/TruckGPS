import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '../api/api.service';
import { GeoPlace } from '../models/route.model';

export type PlaceKind = 'saved' | 'recent' | 'poi' | 'street' | 'area';

export interface PlaceResult extends GeoPlace {
  /** Segunda línea: calle, distrito, ciudad. */
  detail?: string;
  kind: PlaceKind;
  distanceM?: number;
  id?: string;
  shared?: boolean;
  mine?: boolean;
}

export interface SavedPlace {
  id: string;
  nombre: string;
  direccion: string | null;
  lat: number;
  lng: number;
  compartido: boolean;
  mio: boolean;
}

export interface SearchOutcome {
  results: PlaceResult[];
  /** Los resultados no son del texto exacto sino de la categoría («Panaderías cerca de ti»). */
  categoryLabel?: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
    city?: string;
    county?: string;
    state?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
    countrycode?: string;
  };
}

interface NominatimItem {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category?: string;
  type?: string;
  addresstype?: string;
  address?: Record<string, string>;
}

const RECENT_KEY = 'truckgps_recent_places';
const PERU_BBOX = '-81.4,-18.4,-68.6,0.1';
const LIMA: [number, number] = [-12.0464, -77.0428];

/** Palabras con las que la gente busca un tipo de lugar → etiqueta de OpenStreetMap. */
const CATEGORIES: { words: string[]; tag: string; label: string }[] = [
  { words: ['panaderia', 'pasteleria', 'panificadora'], tag: 'shop:bakery', label: 'Panaderías' },
  { words: ['grifo', 'gasolinera', 'gasolina', 'combustible', 'estacion de servicio'], tag: 'amenity:fuel', label: 'Grifos' },
  { words: ['farmacia', 'botica'], tag: 'amenity:pharmacy', label: 'Farmacias y boticas' },
  { words: ['restaurante', 'restaurant', 'polleria', 'cevicheria', 'chifa'], tag: 'amenity:restaurant', label: 'Restaurantes' },
  { words: ['banco', 'agente'], tag: 'amenity:bank', label: 'Bancos' },
  { words: ['cajero'], tag: 'amenity:atm', label: 'Cajeros' },
  { words: ['hospital', 'clinica', 'posta'], tag: 'amenity:hospital', label: 'Hospitales y clínicas' },
  { words: ['comisaria', 'policia'], tag: 'amenity:police', label: 'Comisarías' },
  { words: ['supermercado', 'minimarket', 'bodega'], tag: 'shop:supermarket', label: 'Supermercados' },
  { words: ['mercado'], tag: 'amenity:marketplace', label: 'Mercados' },
  { words: ['hotel', 'hostal', 'hospedaje'], tag: 'tourism:hotel', label: 'Hoteles' },
  { words: ['colegio', 'escuela'], tag: 'amenity:school', label: 'Colegios' },
  { words: ['taller', 'mecanico', 'mecanica'], tag: 'shop:car_repair', label: 'Talleres' },
  { words: ['llanteria', 'llantas'], tag: 'shop:tyres', label: 'Llanterías' },
  { words: ['ferreteria'], tag: 'shop:hardware', label: 'Ferreterías' },
  { words: ['estacionamiento', 'cochera', 'playa de estacionamiento'], tag: 'amenity:parking', label: 'Estacionamientos' }
];

/**
 * Lee coordenadas escritas o pegadas: «-12.0464, -77.0428», o un enlace de Google Maps
 * con «@-12.04,-77.04,17z», «?q=-12.04,-77.04» o «!3d-12.04!4d-77.04». Solo puntos dentro de Perú.
 */
export function parseCoordinates(text: string): [number, number] | null {
  const t = text.trim();
  const pats = [
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll|destination)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i,
    /^(-?\d{1,2}\.\d{3,})\s*[,;\s]\s*(-?\d{1,3}\.\d{3,})$/
  ];
  for (const re of pats) {
    const m = re.exec(t);
    if (!m) continue;
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (lat > -18.6 && lat < 0.3 && lng > -81.6 && lng < -68.4) return [lat, lng];
  }
  return null;
}

/** «Feria Grau - ex carpa grau» → «Feria Grau». Devuelve null si no hay nada que acortar. */
export function shortenQuery(q: string): string | null {
  const first = q.split(/\s[-–—|/]\s|[,(]/)[0].trim();
  return first.length >= 3 && first.length < q.trim().length ? first : null;
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  if (m < 950) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  if (m < 9950) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 1000)} km`;
}

/**
 * Búsqueda de lugares para Rutas: lugares guardados, recientes y OpenStreetMap
 * (Photon + Nominatim), priorizando lo que está cerca del usuario.
 */
@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly api = inject(ApiService);

  readonly saved = signal<SavedPlace[]>([]);
  private savedLoaded = false;

  async loadSaved(force = false): Promise<void> {
    if (this.savedLoaded && !force) return;
    try {
      this.saved.set(await this.api.get<SavedPlace[]>('/places'));
      this.savedLoaded = true;
    } catch {
      /* sin lugares guardados no se rompe la búsqueda */
    }
  }

  async save(nombre: string, place: GeoPlace, compartido: boolean): Promise<SavedPlace> {
    const p = await this.api.post<SavedPlace>('/places', {
      nombre: nombre.trim(),
      direccion: place.name,
      lat: place.lat,
      lng: place.lng,
      compartido
    });
    this.saved.update((list) => [p, ...list.filter((x) => x.id !== p.id)].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    return p;
  }

  async remove(id: string): Promise<void> {
    await this.api.delete(`/places/${id}`);
    this.saved.update((list) => list.filter((x) => x.id !== id));
  }

  recents(): PlaceResult[] {
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as GeoPlace[];
      return raw.filter((p) => p && typeof p.lat === 'number').map((p) => ({ ...p, kind: 'recent' as const }));
    } catch {
      return [];
    }
  }

  addRecent(p: GeoPlace): void {
    try {
      const list = this.recents().filter((r) => distanceM(r.lat, r.lng, p.lat, p.lng) > 40);
      const next = [{ name: p.name, lat: p.lat, lng: p.lng }, ...list.map((r) => ({ name: r.name, lat: r.lat, lng: r.lng }))].slice(0, 8);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* almacenamiento no disponible */
    }
  }

  private savedAsResults(bias: GeoPlace | null): PlaceResult[] {
    return this.saved().map((s) => ({
      id: s.id,
      name: s.nombre,
      detail: s.direccion ?? undefined,
      lat: s.lat,
      lng: s.lng,
      kind: 'saved' as const,
      shared: s.compartido,
      mine: s.mio,
      distanceM: bias ? distanceM(bias.lat, bias.lng, s.lat, s.lng) : undefined
    }));
  }

  /** Lo que se muestra al enfocar el campo sin escribir: guardados y recientes. */
  shortcuts(bias: GeoPlace | null): PlaceResult[] {
    const saved = this.savedAsResults(bias);
    const recents = this.recents()
      .filter((r) => !saved.some((s) => distanceM(s.lat, s.lng, r.lat, r.lng) < 40))
      .map((r) => ({ ...r, distanceM: bias ? distanceM(bias.lat, bias.lng, r.lat, r.lng) : undefined }));
    return [...saved, ...recents];
  }

  private category(q: string): { tag: string; label: string } | null {
    const n = ` ${normalizeText(q)} `;
    for (const c of CATEGORIES) {
      if (c.words.some((w) => n.includes(` ${w} `) || n.includes(` ${w}s `))) return c;
    }
    return null;
  }

  async search(query: string, bias: GeoPlace | null): Promise<SearchOutcome> {
    const q = query.trim();
    if (q.length < 2) return { results: [] };
    const nq = normalizeText(q);
    const center: [number, number] = bias ? [bias.lat, bias.lng] : LIMA;

    const savedHits = this.savedAsResults(bias).filter((s) => {
      const hay = normalizeText(`${s.name} ${s.detail ?? ''}`);
      return nq.split(' ').every((w) => hay.includes(w));
    });

    // Coordenadas o un enlace copiado de Google Maps: se usa ese punto tal cual.
    const punto = parseCoordinates(q);
    if (punto) return { results: [{ name: 'Ubicación pegada', detail: `${punto[0].toFixed(5)}, ${punto[1].toFixed(5)}`, lat: punto[0], lng: punto[1], kind: 'poi' }] };

    let online = await this.onlineSearch(q, center, savedHits.length > 0);
    let results = this.rank([...savedHits, ...online], nq, center);

    // «Feria Grau - ex carpa grau»: si el nombre completo no aparece, se prueba con la primera parte.
    const corto = shortenQuery(q);
    if (corto && !results.some((r) => r.kind === 'saved' || this.matchScore(r, nq) >= 0.75)) {
      try {
        online = [...(await this.onlineSearch(corto, center, true)), ...online];
        results = this.rank([...savedHits, ...online], normalizeText(corto), center);
      } catch {
        /* se queda con lo que haya */
      }
    }
    let categoryLabel: string | undefined;

    // Si no hay un resultado que coincida de verdad, se ofrecen lugares de ese tipo cerca.
    const cat = this.category(q);
    const exacto = results.some((r) => r.kind === 'saved' || this.matchScore(r, nq) >= 0.75);
    if (cat && !exacto) {
      try {
        const nearby = (await this.photonNearby(cat.tag, center))
          .map((r) => ({ ...r, distanceM: distanceM(center[0], center[1], r.lat, r.lng) }))
          .filter((r) => r.distanceM < 15000)
          .sort((a, b) => a.distanceM - b.distanceM)
          .slice(0, 7);
        if (nearby.length) {
          results = [...results.filter((r) => r.kind === 'saved'), ...nearby];
          categoryLabel = `${cat.label} cerca de ${bias ? 'ti' : 'Lima'}`;
        }
      } catch {
        /* se queda con lo que haya */
      }
    }
    return { results: results.slice(0, 8), categoryLabel };
  }

  /** TomTom (si está configurado en el servidor) + mapas libres, en paralelo. */
  private async onlineSearch(q: string, center: [number, number], tolerant: boolean): Promise<PlaceResult[]> {
    const [tt, photon, nominatim] = await Promise.allSettled([
      this.tomtom(q, center),
      this.photon(q, center),
      this.nominatim(q, center)
    ]);
    const val = <T>(r: PromiseSettledResult<T[]>) => (r.status === 'fulfilled' ? r.value : []);
    if (!tolerant && [tt, photon, nominatim].every((r) => r.status === 'rejected')) {
      throw new Error('No se pudo buscar: revisa tu conexión a internet.');
    }
    // TomTom primero: tiene más negocios y direcciones de Perú que el mapa libre.
    return [...val(tt), ...val(photon), ...val(nominatim)];
  }

  private tomtomOff = false;

  private async tomtom(q: string, center: [number, number]): Promise<PlaceResult[]> {
    if (this.tomtomOff || q.length < 3) return [];
    try {
      const r = await this.api.get<{ resultados: { nombre: string; detalle: string | null; lat: number; lng: number; tipo: PlaceKind }[] }>(
        `/mapas/buscar?q=${encodeURIComponent(q)}&lat=${center[0]}&lng=${center[1]}`
      );
      return r.resultados.map((x) => ({ name: x.nombre, detail: x.detalle ?? undefined, lat: x.lat, lng: x.lng, kind: x.tipo }));
    } catch (e) {
      // No configurado: no se vuelve a intentar en esta sesión.
      if (e instanceof HttpErrorResponse && e.status === 503) this.tomtomOff = true;
      throw e;
    }
  }

  /** Qué tanto del texto buscado aparece en el resultado (0 a 1). */
  private matchScore(r: PlaceResult, nq: string): number {
    const words = nq.split(' ').filter((w) => w.length > 2 && !['de', 'del', 'los', 'las', 'the', 'san', 'santa'].includes(w));
    if (!words.length) return 1;
    const hay = normalizeText(`${r.name} ${r.detail ?? ''}`);
    return words.filter((w) => hay.includes(w)).length / words.length;
  }

  private rank(list: PlaceResult[], nq: string, center: [number, number]): PlaceResult[] {
    const withDist = list.map((r, i) => ({
      r: { ...r, distanceM: distanceM(center[0], center[1], r.lat, r.lng) },
      i,
      score: this.matchScore(r, nq)
    }));
    // Sin duplicados: mismo nombre a menos de 150 m, o cualquier resultado a menos de 25 m.
    const uniq: typeof withDist = [];
    for (const x of withDist) {
      const dup = uniq.some((u) => {
        const d = distanceM(u.r.lat, u.r.lng, x.r.lat, x.r.lng);
        return d < 25 || (d < 150 && normalizeText(u.r.name) === normalizeText(x.r.name));
      });
      if (!dup) uniq.push(x);
    }
    const bucket = (d: number) => (d < 3000 ? 0 : d < 15000 ? 1 : d < 60000 ? 2 : 3);
    return uniq
      .sort((a, b) => {
        if ((a.r.kind === 'saved') !== (b.r.kind === 'saved')) return a.r.kind === 'saved' ? -1 : 1;
        const sa = Math.round(a.score * 4);
        const sb = Math.round(b.score * 4);
        if (sa !== sb) return sb - sa;
        const ba = bucket(a.r.distanceM);
        const bb = bucket(b.r.distanceM);
        if (ba !== bb) return ba - bb;
        return a.i - b.i;
      })
      .map((x) => x.r);
  }

  /** Lugares de una categoría (panaderías, grifos…) alrededor de un punto. */
  private async photonNearby(osmTag: string, center: [number, number]): Promise<PlaceResult[]> {
    const url = new URL('https://photon.komoot.io/reverse');
    url.searchParams.set('lat', center[0].toFixed(4));
    url.searchParams.set('lon', center[1].toFixed(4));
    url.searchParams.set('radius', '8');
    url.searchParams.set('limit', '15');
    url.searchParams.set('osm_tag', osmTag);
    return this.photonFetch(url);
  }

  private async photon(q: string, center: [number, number]): Promise<PlaceResult[]> {
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', q);
    url.searchParams.set('limit', '10');
    url.searchParams.set('lat', center[0].toFixed(4));
    url.searchParams.set('lon', center[1].toFixed(4));
    url.searchParams.set('bbox', PERU_BBOX);
    return this.photonFetch(url);
  }

  private async photonFetch(url: URL): Promise<PlaceResult[]> {
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('photon');
    const data = (await res.json()) as { features?: PhotonFeature[] };
    return (data.features ?? [])
      .filter((f) => !f.properties.countrycode || f.properties.countrycode.toUpperCase() === 'PE')
      .map((f) => {
      const p = f.properties;
      const calle = [p.street, p.housenumber].filter(Boolean).join(' ');
      const name = p.name || calle || p.district || p.city || 'Lugar sin nombre';
      const zona = [p.name ? calle : '', p.district ?? p.locality, p.city, p.state]
        .filter((x): x is string => !!x && x !== name)
        .filter((x, i, arr) => arr.indexOf(x) === i);
        const kind: PlaceKind = p.osm_key === 'highway' ? 'street' : p.osm_key === 'place' || p.osm_key === 'boundary' ? 'area' : 'poi';
        return { name, detail: zona.join(', ') || undefined, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], kind };
      });
  }

  private async nominatim(q: string, center: [number, number]): Promise<PlaceResult[]> {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '6');
    url.searchParams.set('countrycodes', 'pe');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', 'es');
    // Prefiere lo que está cerca (unos 40 km a la redonda) sin excluir el resto del país.
    url.searchParams.set('viewbox', `${center[1] - 0.4},${center[0] + 0.4},${center[1] + 0.4},${center[0] - 0.4}`);
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('nominatim');
    const data = (await res.json()) as NominatimItem[];
    return data.map((r) => {
      const a = r.address ?? {};
      const calle = [a['road'] ?? a['pedestrian'], a['house_number']].filter(Boolean).join(' ');
      const name = r.name || calle || r.display_name.split(',')[0];
      const zona = [r.name ? calle : '', a['suburb'] ?? a['neighbourhood'] ?? a['quarter'], a['city_district'] ?? a['town'] ?? a['city'], a['state'] ?? a['region']]
        .filter((x): x is string => !!x && x !== name)
        .filter((x, i, arr) => arr.indexOf(x) === i);
      const kind: PlaceKind = r.category === 'highway' ? 'street' : r.category === 'place' || r.category === 'boundary' ? 'area' : 'poi';
      return { name, detail: zona.join(', ') || undefined, lat: parseFloat(r.lat), lng: parseFloat(r.lon), kind };
    });
  }
}
