import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';

import { ApiService } from '../api/api.service';
import { apiErrorMessage } from '../utils/api-error.util';

/** Posición tomada sin señal: se envía después con la hora en que se leyó. */
export interface QueuedPosition {
  vid: string;
  lat: number;
  lng: number;
  velocidad: number;
  precision_m: number | null;
  t: string;
}

export interface QueuedIncident {
  titulo: string;
  placa: string;
  categoria: string;
  severidad: string;
  ubicacion: string;
  descripcion: string;
  esPanico: boolean;
  lat: number | null;
  lng: number | null;
  photos: { name: string; blob: Blob }[];
  audio: Blob | null;
}

export interface OutboxItem {
  id: string;
  kind: 'incident' | 'json';
  label: string;
  createdAt: string;
  intentos: number;
  error?: string;
  path?: string;
  body?: unknown;
  incident?: QueuedIncident;
}

const DB_NAME = 'truckgps_offline';
const POSITIONS = 'positions';
const OUTBOX = 'outbox';
const MAX_POSITIONS = 6000;
const BATCH = 300;

/** ¿El envío falló por falta de conexión (y no porque el servidor lo rechazó)? */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (e instanceof HttpErrorResponse) return e.status === 0 || e.status === 502 || e.status === 503 || e.status === 504;
  return false;
}

export function newClientId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/**
 * Cola sin señal: guarda en el celular las posiciones y los reportes que no se pudieron
 * enviar y los manda solos cuando vuelve la conexión.
 */
@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly api = inject(ApiService);

  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
  readonly pendingPositions = signal(0);
  readonly outbox = signal<OutboxItem[]>([]);
  readonly flushing = signal(false);
  /** Lo último que se terminó de enviar (para avisar "ya se envió"). */
  readonly lastSent = signal<{ posiciones: number; reportes: number; at: number } | null>(null);

  readonly pendingReports = computed(() => this.outbox().filter((o) => !o.error).length);
  readonly failedReports = computed(() => this.outbox().filter((o) => !!o.error));
  readonly hasPending = computed(() => this.pendingPositions() > 0 || this.pendingReports() > 0);

  private dbPromise: Promise<IDBDatabase | null> | null = null;
  // Respaldo en memoria si el navegador no permite IndexedDB (modo privado antiguo).
  private memPositions: QueuedPosition[] = [];
  private memOutbox: OutboxItem[] = [];
  private started = false;

  /** Se llama una vez al abrir la app. */
  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    window.addEventListener('online', () => {
      this.online.set(true);
      void this.flush();
    });
    window.addEventListener('offline', () => this.online.set(false));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void this.flush();
    });
    setInterval(() => {
      if (this.hasPending()) void this.flush();
    }, 30_000);
    void this.refreshCounts().then(() => this.flush());
  }

  // ─────────────── guardar ───────────────

  async addPosition(p: QueuedPosition): Promise<void> {
    const db = await this.db();
    if (!db) {
      this.memPositions.push(p);
      if (this.memPositions.length > MAX_POSITIONS) this.memPositions.shift();
      this.pendingPositions.set(this.memPositions.length);
      return;
    }
    try {
      await this.tx(db, POSITIONS, 'readwrite', (s) => s.add(p));
      let n = this.pendingPositions() + 1;
      if (n > MAX_POSITIONS) {
        // Demasiadas horas sin señal: se descartan las lecturas más antiguas.
        await this.dropOldest(db, n - MAX_POSITIONS);
        n = MAX_POSITIONS;
      }
      this.pendingPositions.set(n);
    } catch {
      this.memPositions.push(p);
      this.pendingPositions.set(this.pendingPositions() + 1);
    }
  }

  addIncident(incident: QueuedIncident, label: string): Promise<void> {
    return this.addOutbox({ id: newClientId(), kind: 'incident', label, createdAt: new Date().toISOString(), intentos: 0, incident });
  }

  addJson(path: string, body: unknown, label: string): Promise<void> {
    return this.addOutbox({ id: newClientId(), kind: 'json', label, createdAt: new Date().toISOString(), intentos: 0, path, body });
  }

  private async addOutbox(item: OutboxItem): Promise<void> {
    const db = await this.db();
    if (db) {
      try {
        await this.tx(db, OUTBOX, 'readwrite', (s) => s.put(item));
      } catch {
        this.memOutbox.push(item);
      }
    } else {
      this.memOutbox.push(item);
    }
    this.outbox.update((l) => [...l, item]);
  }

  async discard(id: string): Promise<void> {
    await this.removeOutbox(id);
  }

  /** Vuelve a intentar los reportes que el servidor rechazó. */
  async retryFailed(): Promise<void> {
    for (const it of this.failedReports()) await this.saveOutbox({ ...it, error: undefined, intentos: 0 });
    await this.flush();
  }

  // ─────────────── enviar ───────────────

  /** Envía lo pendiente. Se detiene sin perder nada si todavía no hay conexión. */
  async flush(): Promise<void> {
    if (this.flushing() || !this.hasPending()) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    this.flushing.set(true);
    let posiciones = 0;
    let reportes = 0;
    try {
      // Primero los reportes (un pánico pendiente es lo más urgente).
      for (const item of this.outbox().filter((o) => !o.error)) {
        try {
          await this.send(item);
          await this.removeOutbox(item.id);
          reportes++;
        } catch (e) {
          if (isNetworkError(e) || (e instanceof HttpErrorResponse && e.status === 401)) return;
          const intentos = item.intentos + 1;
          await this.saveOutbox({ ...item, intentos, error: intentos >= 3 ? apiErrorMessage(e, 'El servidor rechazó el reporte') : undefined });
        }
      }
      for (;;) {
        const lote = await this.readPositions(BATCH);
        if (!lote.length) break;
        const porUnidad = new Map<string, QueuedPosition[]>();
        for (const { value } of lote) porUnidad.set(value.vid, [...(porUnidad.get(value.vid) ?? []), value]);
        for (const [vid, lista] of porUnidad) {
          try {
            await this.api.post(`/vehicles/${vid}/positions/lote`, {
              posiciones: lista.map((p) => ({ lat: p.lat, lng: p.lng, velocidad: p.velocidad, precision_m: p.precision_m, t: p.t }))
            });
          } catch (e) {
            if (isNetworkError(e) || (e instanceof HttpErrorResponse && e.status === 401)) return;
            // 403/404/400: esa unidad ya no es de este conductor; esas lecturas no se podrán enviar.
          }
        }
        await this.deletePositions(lote.map((l) => l.key));
        posiciones += lote.length;
        this.pendingPositions.set(Math.max(0, this.pendingPositions() - lote.length));
      }
    } finally {
      this.flushing.set(false);
      if (posiciones || reportes) this.lastSent.set({ posiciones, reportes, at: Date.now() });
      void this.refreshCounts();
    }
  }

  private async send(item: OutboxItem): Promise<void> {
    if (item.kind === 'json') {
      await this.api.post(item.path!, item.body);
      return;
    }
    const i = item.incident!;
    const form = new FormData();
    form.append('titulo', i.titulo);
    form.append('placa', i.placa);
    form.append('categoria', i.categoria);
    form.append('severidad', i.severidad);
    form.append('ubicacion', i.ubicacion);
    form.append('descripcion', i.descripcion);
    form.append('es_panico', String(i.esPanico));
    if (i.lat != null) form.append('lat', String(i.lat));
    if (i.lng != null) form.append('lng', String(i.lng));
    i.photos.forEach((p) => form.append('photos', p.blob, p.name));
    if (i.audio) form.append('audio', i.audio, 'audio.webm');
    form.append('client_id', item.id);
    form.append('ocurrido_at', item.createdAt);
    await this.api.postForm('/incidents', form);
  }

  // ─────────────── almacenamiento ───────────────

  private db(): Promise<IDBDatabase | null> {
    this.dbPromise ??= new Promise<IDBDatabase | null>((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(POSITIONS)) db.createObjectStore(POSITIONS, { autoIncrement: true });
          if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return this.dbPromise;
  }

  private tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction(store, mode);
      const req = run(t.objectStore(store));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  private async refreshCounts(): Promise<void> {
    const db = await this.db();
    if (!db) {
      this.pendingPositions.set(this.memPositions.length);
      this.outbox.set([...this.memOutbox]);
      return;
    }
    try {
      const n = await this.tx(db, POSITIONS, 'readonly', (s) => s.count());
      const items = await this.tx(db, OUTBOX, 'readonly', (s) => s.getAll() as IDBRequest<OutboxItem[]>);
      this.pendingPositions.set(n + this.memPositions.length);
      this.outbox.set([...items, ...this.memOutbox].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    } catch {
      /* se mantienen los contadores actuales */
    }
  }

  private async readPositions(limit: number): Promise<{ key: IDBValidKey | null; value: QueuedPosition }[]> {
    const db = await this.db();
    const mem = this.memPositions.slice(0, limit).map((value) => ({ key: null, value }));
    if (!db) return mem;
    return new Promise((resolve) => {
      const out: { key: IDBValidKey | null; value: QueuedPosition }[] = [];
      try {
        const t = db.transaction(POSITIONS, 'readonly');
        const cur = t.objectStore(POSITIONS).openCursor();
        cur.onsuccess = () => {
          const c = cur.result;
          if (c && out.length < limit) {
            out.push({ key: c.key, value: c.value as QueuedPosition });
            c.continue();
          }
        };
        t.oncomplete = () => resolve(out.length ? out : mem);
        t.onerror = () => resolve(mem);
      } catch {
        resolve(mem);
      }
    });
  }

  private async deletePositions(keys: (IDBValidKey | null)[]): Promise<void> {
    const reales = keys.filter((k): k is IDBValidKey => k !== null);
    const deMemoria = keys.length - reales.length;
    if (deMemoria) this.memPositions.splice(0, deMemoria);
    const db = await this.db();
    if (!db || !reales.length) return;
    await new Promise<void>((resolve) => {
      const t = db.transaction(POSITIONS, 'readwrite');
      const s = t.objectStore(POSITIONS);
      reales.forEach((k) => s.delete(k));
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
      t.onabort = () => resolve();
    });
  }

  private async dropOldest(db: IDBDatabase, n: number): Promise<void> {
    const viejas = await this.readPositions(n);
    await this.deletePositions(viejas.map((v) => v.key));
    void db;
  }

  private async saveOutbox(item: OutboxItem): Promise<void> {
    const db = await this.db();
    const enMemoria = this.memOutbox.findIndex((m) => m.id === item.id);
    if (enMemoria >= 0) this.memOutbox[enMemoria] = item;
    else if (db) {
      try {
        await this.tx(db, OUTBOX, 'readwrite', (s) => s.put(item));
      } catch {
        /* se reintenta en el siguiente envío */
      }
    }
    this.outbox.update((l) => l.map((o) => (o.id === item.id ? item : o)));
  }

  private async removeOutbox(id: string): Promise<void> {
    this.memOutbox = this.memOutbox.filter((m) => m.id !== id);
    const db = await this.db();
    if (db) {
      try {
        await this.tx(db, OUTBOX, 'readwrite', (s) => s.delete(id));
      } catch {
        /* ya no estaba */
      }
    }
    this.outbox.update((l) => l.filter((o) => o.id !== id));
  }
}
