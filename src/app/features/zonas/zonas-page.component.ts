import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  Crosshair,
  LucideAngularModule,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  ShieldAlert,
  Trash2,
  X,
  XCircle
} from 'lucide-angular';

import { NotificationLogRow, NotificationStatus, RiskZone, ZONE_TYPES, ZoneType, zoneColor } from '../../core/models/zone.model';
import { LayoutService } from '../../core/services/layout.service';
import { ZonesService } from '../../core/services/zones.service';
import { apiErrorMessage } from '../../core/utils/api-error.util';
import { createOsmMap } from '../../core/utils/map.utils';

type ZoneForm = { nombre: string; tipo: ZoneType; radio_m: number; activa: boolean; notas: string };

const LIMA: [number, number] = [-12.0464, -77.0428];

@Component({
  standalone: true,
  selector: 'app-zonas-page',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">

      <div class="flex items-end justify-between flex-wrap gap-4 mb-6 anim-in">
        <div>
          <h2 class="text-[22px] font-bold text-slate-900 tracking-[-0.03em] leading-tight">Zonas peligrosas y avisos</h2>
          <p class="text-[13px] text-slate-500 mt-1.5">Marca puntos de riesgo y recibe un aviso cuando una unidad entra o un chofer reporta una incidencia.</p>
        </div>
      </div>

      @if (error()) {
        <div class="flex items-start gap-2 p-3 rounded-lg bg-red-50 ring-1 ring-red-200 text-red-700 mb-4 msg-in">
          <lucide-icon [img]="alertCircleIcon" [size]="14" class="mt-0.5 shrink-0" />
          <p class="text-[12.5px] leading-snug flex-1">{{ error() }}</p>
          <button type="button" class="shrink-0 w-5 h-5 rounded-md text-red-400 hover:text-red-700 hover:bg-red-100 flex items-center justify-center transition" (click)="error.set(null)" aria-label="Cerrar">
            <lucide-icon [img]="closeIcon" [size]="12" />
          </button>
        </div>
      }

      <div class="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-5 mb-5">

        <!-- ═══════════ MAPA ═══════════ -->
        <div class="card overflow-hidden anim-in">
          <div class="px-5 py-3 border-b border-slate-200/80 flex items-center gap-2 text-[12.5px] text-slate-500">
            <lucide-icon [img]="crosshairIcon" [size]="14" class="text-slate-400" />
            @if (editing()) {
              Toca el mapa para mover el centro de la zona.
            } @else {
              Toca el mapa donde está el punto peligroso para crear una zona.
            }
          </div>
          <div #mapEl class="h-[380px] sm:h-[460px] w-full"></div>
        </div>

        <!-- ═══════════ FORMULARIO ═══════════ -->
        <div class="card p-5 anim-in" style="animation-delay: 60ms">
          @if (draftLat() !== null) {
            <h3 class="text-[14px] font-bold text-slate-900 tracking-tight mb-1">{{ editing() ? 'Editar zona' : 'Nueva zona' }}</h3>
            <p class="text-[11.5px] text-slate-400 mb-4 tnum">Centro: {{ draftLat()!.toFixed(5) }}, {{ draftLng()!.toFixed(5) }}</p>
            <form class="space-y-4" (ngSubmit)="saveZone()">
              <div>
                <label class="input-label" for="zn">Nombre</label>
                <input id="zn" class="input" [(ngModel)]="form.nombre" name="nombre" placeholder="Ej. Óvalo Santa Anita" required maxlength="120" />
              </div>
              <div>
                <label class="input-label">Tipo</label>
                <div class="grid grid-cols-2 gap-2">
                  @for (t of zoneTypes; track t.value) {
                    <button type="button" class="py-2 px-2 rounded-lg text-[11.5px] font-semibold ring-1 transition active:scale-95 flex items-center gap-1.5 justify-center"
                      [class]="form.tipo === t.value ? 'ring-slate-900 bg-slate-900 text-white' : 'ring-slate-200 text-slate-600 hover:bg-slate-50'"
                      (click)="form.tipo = t.value; drawDraft()">
                      <span class="w-2 h-2 rounded-full" [style.background]="t.color"></span>{{ t.label }}
                    </button>
                  }
                </div>
              </div>
              <div>
                <label class="input-label" for="zr">Radio: <span class="tnum">{{ form.radio_m }} m</span></label>
                <input id="zr" type="range" min="50" max="5000" step="50" class="w-full accent-[#0b1220]" [(ngModel)]="form.radio_m" name="radio" (ngModelChange)="drawDraft()" />
              </div>
              <div>
                <label class="input-label" for="znotas">Nota para el aviso (opcional)</label>
                <input id="znotas" class="input" [(ngModel)]="form.notas" name="notas" placeholder="Ej. Asaltos de noche, no detenerse" />
              </div>
              <label class="flex items-center gap-2 text-[12.5px] text-slate-600 cursor-pointer">
                <input type="checkbox" class="accent-[#0b1220]" [(ngModel)]="form.activa" name="activa" />
                Zona activa (envía avisos)
              </label>
              <div class="flex gap-2.5 pt-1">
                <button type="button" class="flex-1 py-2.5 rounded-lg ring-1 ring-slate-200 text-slate-600 text-[13px] font-semibold hover:bg-slate-50 transition" (click)="cancelDraft()">Cancelar</button>
                <button type="submit" class="flex-[1.4] py-2.5 rounded-lg bg-[#0b1220] hover:bg-[#16233b] text-white text-[13px] font-semibold transition disabled:opacity-50" [disabled]="saving()">
                  {{ saving() ? 'Guardando...' : 'Guardar zona' }}
                </button>
              </div>
            </form>
          } @else {
            <h3 class="text-[14px] font-bold text-slate-900 tracking-tight mb-3">Zonas ({{ zones().length }})</h3>
            <div class="space-y-2 max-h-[400px] overflow-y-auto -mr-2 pr-2">
              @for (z of zones(); track z.id) {
                <div class="p-3 rounded-xl ring-1 ring-slate-200 hover:ring-slate-300 transition" [class.opacity-60]="!z.activa">
                  <div class="flex items-start gap-2.5">
                    <span class="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" [style.background]="color(z.tipo)"></span>
                    <button type="button" class="min-w-0 flex-1 text-left" (click)="focusZone(z)">
                      <p class="text-[13px] font-semibold text-slate-800 truncate">{{ z.nombre }}</p>
                      <p class="text-[11.5px] text-slate-400">{{ z.tipoLabel }} · radio {{ z.radioM }} m</p>
                    </button>
                    <div class="flex items-center gap-1 shrink-0">
                      <button type="button" class="px-2 py-1 rounded-md text-[11px] font-semibold ring-1 transition"
                        [class]="z.activa ? 'ring-emerald-200 bg-emerald-50 text-emerald-700' : 'ring-slate-200 text-slate-500'"
                        (click)="toggleZone(z)">{{ z.activa ? 'Activa' : 'Inactiva' }}</button>
                      <button type="button" class="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" (click)="editZone(z)" aria-label="Editar zona">
                        <lucide-icon [img]="pencilIcon" [size]="13" />
                      </button>
                      <button type="button" class="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition" (click)="removeZone(z)" aria-label="Eliminar zona">
                        <lucide-icon [img]="trashIcon" [size]="13" />
                      </button>
                    </div>
                  </div>
                </div>
              } @empty {
                <div class="text-center py-10">
                  <lucide-icon [img]="shieldIcon" [size]="22" class="text-slate-300 mx-auto mb-2" />
                  <p class="text-[12.5px] text-slate-400">Aún no hay zonas. Toca el mapa para crear la primera.</p>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-[1fr_1.6fr] gap-5">

        <!-- ═══════════ CANALES ═══════════ -->
        <div class="card p-5 anim-in" style="animation-delay: 120ms">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-[14px] font-bold text-slate-900 tracking-tight">Canales de aviso</h3>
            <button type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50 transition disabled:opacity-50" (click)="sendTest()" [disabled]="testing()">
              <lucide-icon [img]="sendIcon" [size]="12" />{{ testing() ? 'Enviando...' : 'Enviar prueba' }}
            </button>
          </div>
          @for (ch of channels(); track ch.key) {
            <div class="flex items-start gap-3 p-3 rounded-xl ring-1 ring-slate-200 mb-2.5">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center ring-1 shrink-0" [class]="ch.ok ? 'bg-emerald-50 text-emerald-600 ring-emerald-100' : 'bg-slate-50 text-slate-400 ring-slate-200'">
                <lucide-icon [img]="ch.icon" [size]="15" />
              </div>
              <div class="min-w-0">
                <p class="text-[13px] font-semibold text-slate-800">{{ ch.label }}
                  <span class="badge ml-1" [class]="ch.ok ? 'badge-success' : 'badge-neutral'">{{ ch.ok ? 'Activo' : 'Sin configurar' }}</span>
                </p>
                @if (ch.ok) {
                  <p class="text-[11.5px] text-slate-500 mt-0.5 break-all">Envía a: {{ ch.to.join(', ') }}</p>
                } @else {
                  <p class="text-[11.5px] text-slate-400 mt-0.5">Falta en Vercel: <span class="font-mono">{{ ch.missing.join(', ') }}</span></p>
                }
              </div>
            </div>
          }
          <p class="text-[11.5px] text-slate-400 leading-relaxed mt-2">
            Se avisa cuando un chofer reporta una incidencia o un pánico, y cuando una unidad entra a una zona activa
            (una vez por entrada; se repite tras {{ status()?.cooldownMin ?? 30 }} min).
          </p>
        </div>

        <!-- ═══════════ HISTORIAL ═══════════ -->
        <div class="card overflow-hidden anim-in" style="animation-delay: 160ms">
          <div class="px-5 py-3.5 border-b border-slate-200/80 flex items-center gap-2">
            <lucide-icon [img]="bellIcon" [size]="14" class="text-slate-400" />
            <h3 class="text-[14px] font-bold text-slate-900 tracking-tight">Últimos avisos</h3>
          </div>
          <div class="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            @for (n of history(); track n.id) {
              <div class="px-5 py-3 flex items-start gap-3">
                <lucide-icon [img]="n.estado === 'enviado' ? okIcon : failIcon" [size]="15" class="mt-0.5 shrink-0"
                  [class]="n.estado === 'enviado' ? 'text-emerald-500' : n.estado === 'fallido' ? 'text-red-500' : 'text-slate-300'" />
                <div class="min-w-0 flex-1">
                  <p class="text-[13px] font-medium text-slate-800">{{ n.titulo }}</p>
                  <p class="text-[11.5px] text-slate-400">
                    {{ n.canal === 'email' ? 'Correo' : 'SMS' }} · {{ estadoLabel(n.estado) }}
                    @if (n.destinatarios) { · {{ n.destinatarios }} }
                    · {{ n.createdAt | date: 'dd/MM HH:mm' }}
                  </p>
                  @if (n.error && n.estado === 'fallido') {
                    <p class="text-[11px] text-red-500 mt-0.5 break-words">{{ n.error }}</p>
                  }
                </div>
                <span class="badge shrink-0" [class]="tipoBadge(n.tipo)">{{ tipoLabel(n.tipo) }}</span>
              </div>
            } @empty {
              <p class="px-5 py-10 text-center text-[12.5px] text-slate-400">Todavía no se ha enviado ningún aviso.</p>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class ZonasPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl') private mapEl?: ElementRef<HTMLDivElement>;

  private readonly svc = inject(ZonesService);
  private readonly layout = inject(LayoutService);

  readonly alertCircleIcon = AlertCircle;
  readonly closeIcon = X;
  readonly crosshairIcon = Crosshair;
  readonly pencilIcon = Pencil;
  readonly trashIcon = Trash2;
  readonly shieldIcon = ShieldAlert;
  readonly sendIcon = Send;
  readonly bellIcon = BellRing;
  readonly okIcon = CheckCircle2;
  readonly failIcon = XCircle;
  readonly plusIcon = Plus;

  readonly zoneTypes = ZONE_TYPES;
  readonly color = zoneColor;

  readonly zones = this.svc.zones;
  readonly status = signal<NotificationStatus | null>(null);
  readonly history = signal<NotificationLogRow[]>([]);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly testing = signal(false);
  readonly editing = signal<RiskZone | null>(null);
  readonly draftLat = signal<number | null>(null);
  readonly draftLng = signal<number | null>(null);

  form: ZoneForm = this.emptyForm();

  readonly channels = computed(() => {
    const s = this.status();
    return [
      { key: 'email', label: 'Correo', icon: Mail, ok: !!s?.email.configurado, to: s?.email.destinatarios ?? [], missing: s?.email.faltan ?? ['RESEND_API_KEY', 'ALERT_EMAILS'] },
      { key: 'sms', label: 'SMS', icon: MessageSquare, ok: !!s?.sms.configurado, to: s?.sms.destinatarios ?? [], missing: s?.sms.faltan ?? ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM', 'ALERT_PHONES'] }
    ];
  });

  private map: L.Map | null = null;
  private zoneLayer = L.layerGroup();
  private draftLayer = L.layerGroup();

  ngOnInit(): void {
    this.layout.setPage('Zonas y avisos', 'Puntos peligrosos y notificaciones al supervisor');
    void this.refreshAll();
  }

  ngAfterViewInit(): void {
    if (!this.mapEl) return;
    this.map = createOsmMap(this.mapEl.nativeElement, LIMA, 11);
    this.zoneLayer.addTo(this.map);
    this.draftLayer.addTo(this.map);
    this.map.on('click', (e: L.LeafletMouseEvent) => this.setDraft(e.latlng.lat, e.latlng.lng));
    setTimeout(() => this.map?.invalidateSize(), 200);
    this.drawZones();
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  async refreshAll(): Promise<void> {
    try {
      const [, status, history] = await Promise.all([this.svc.loadZones(), this.svc.status(), this.svc.history()]);
      this.status.set(status);
      this.history.set(history);
      this.drawZones();
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudieron cargar las zonas'));
    }
  }

  private drawZones(): void {
    if (!this.map) return;
    this.zoneLayer.clearLayers();
    for (const z of this.zones()) {
      if (this.editing()?.id === z.id) continue;
      const c = zoneColor(z.tipo);
      L.circle([z.lat, z.lng], {
        radius: z.radioM,
        color: c,
        weight: 2,
        fillColor: c,
        fillOpacity: z.activa ? 0.18 : 0.05,
        dashArray: z.activa ? undefined : '5 6'
      })
        .bindTooltip(`<strong>${this.escape(z.nombre)}</strong><br/>${z.tipoLabel} · ${z.radioM} m${z.activa ? '' : ' · inactiva'}`)
        .addTo(this.zoneLayer);
    }
  }

  drawDraft(): void {
    this.draftLayer.clearLayers();
    const lat = this.draftLat();
    const lng = this.draftLng();
    if (!this.map || lat === null || lng === null) return;
    const c = zoneColor(this.form.tipo);
    L.circle([lat, lng], { radius: Number(this.form.radio_m), color: c, weight: 2, fillColor: c, fillOpacity: 0.25, dashArray: '6 6' }).addTo(this.draftLayer);
    L.circleMarker([lat, lng], { radius: 4, color: c, fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(this.draftLayer);
  }

  private setDraft(lat: number, lng: number): void {
    if (this.draftLat() === null && !this.editing()) this.form = this.emptyForm();
    this.draftLat.set(lat);
    this.draftLng.set(lng);
    this.drawDraft();
  }

  cancelDraft(): void {
    this.editing.set(null);
    this.draftLat.set(null);
    this.draftLng.set(null);
    this.draftLayer.clearLayers();
    this.drawZones();
  }

  editZone(z: RiskZone): void {
    this.editing.set(z);
    this.form = { nombre: z.nombre, tipo: z.tipo, radio_m: z.radioM, activa: z.activa, notas: z.notas ?? '' };
    this.draftLat.set(z.lat);
    this.draftLng.set(z.lng);
    this.drawZones();
    this.drawDraft();
    this.map?.setView([z.lat, z.lng], Math.max(this.map.getZoom(), 13));
  }

  focusZone(z: RiskZone): void {
    this.map?.fitBounds(L.latLng(z.lat, z.lng).toBounds(z.radioM * 2.5));
  }

  async saveZone(): Promise<void> {
    const lat = this.draftLat();
    const lng = this.draftLng();
    if (lat === null || lng === null || !this.form.nombre.trim()) {
      this.error.set('Ponle un nombre a la zona.');
      return;
    }
    this.saving.set(true);
    const body = {
      nombre: this.form.nombre.trim(),
      tipo: this.form.tipo,
      lat,
      lng,
      radio_m: Number(this.form.radio_m),
      activa: this.form.activa,
      notas: this.form.notas.trim() || null
    };
    try {
      const ed = this.editing();
      if (ed) await this.svc.update(ed.id, body);
      else await this.svc.create(body);
      this.cancelDraft();
      await this.svc.loadZones();
      this.drawZones();
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo guardar la zona'));
    } finally {
      this.saving.set(false);
    }
  }

  async toggleZone(z: RiskZone): Promise<void> {
    try {
      await this.svc.update(z.id, { nombre: z.nombre, tipo: z.tipo, lat: z.lat, lng: z.lng, radio_m: z.radioM, activa: !z.activa, notas: z.notas });
      await this.svc.loadZones();
      this.drawZones();
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo cambiar la zona'));
    }
  }

  async removeZone(z: RiskZone): Promise<void> {
    if (!window.confirm(`¿Eliminar la zona "${z.nombre}"?`)) return;
    try {
      await this.svc.remove(z.id);
      await this.svc.loadZones();
      this.drawZones();
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo eliminar la zona'));
    }
  }

  async sendTest(): Promise<void> {
    this.testing.set(true);
    try {
      await this.svc.sendTest();
      this.history.set(await this.svc.history());
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo enviar la prueba'));
    } finally {
      this.testing.set(false);
    }
  }

  estadoLabel(e: string): string {
    return e === 'enviado' ? 'enviado' : e === 'fallido' ? 'falló' : 'canal sin configurar';
  }

  tipoLabel(t: string): string {
    return ({ panico: 'Pánico', incidente: 'Incidencia', zona: 'Zona', prueba: 'Prueba' } as Record<string, string>)[t] ?? t;
  }

  tipoBadge(t: string): string {
    return ({ panico: 'badge-danger', incidente: 'badge-warning', zona: 'badge-warning', prueba: 'badge-neutral' } as Record<string, string>)[t] ?? 'badge-neutral';
  }

  private escape(s: string): string {
    return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);
  }

  private emptyForm(): ZoneForm {
    return { nombre: '', tipo: 'robo', radio_m: 500, activa: true, notas: '' };
  }
}
