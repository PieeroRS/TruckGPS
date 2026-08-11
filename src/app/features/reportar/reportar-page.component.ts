import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertOctagon,
  Camera,
  Check,
  Crosshair,
  Loader2,
  LucideAngularModule,
  MapPin,
  Mic,
  Send,
  Siren,
  Square,
  Trash2,
  Truck,
  User
} from 'lucide-angular';
import { AuthService } from '../../auth/auth.service';
import { FleetService } from '../../core/services/fleet.service';
import { IncidentService } from '../../core/services/incident.service';
import { LayoutService } from '../../core/services/layout.service';
import { LocationTrackingService } from '../../core/services/location-tracking.service';
import { vehicleStatusInfo } from '../../core/utils/map.utils';

interface PhotoPreview {
  url: string;
  file: File;
}

@Component({
  standalone: true,
  selector: 'app-reportar-page',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="p-3 sm:p-6 lg:p-8 flex justify-center">
      <div class="w-full max-w-md">

        <!-- ═══════════ TARJETA CONDUCTOR ═══════════ -->
        <div class="relative overflow-hidden bg-[#0b1220] text-white rounded-2xl p-5 mb-5 fade-in-up
                    ring-1 ring-white/10 shadow-lg shadow-slate-900/20">
          <div class="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full bg-blue-600/20 blur-[70px]"></div>

          <div class="relative flex items-center gap-3 mb-4">
            <div class="w-11 h-11 rounded-xl bg-white/10 ring-1 ring-white/15 flex items-center justify-center shrink-0">
              <lucide-icon [img]="userIcon" [size]="19" />
            </div>
            <div class="min-w-0">
              <div class="text-[14px] font-semibold tracking-tight truncate">{{ driverName() }}</div>
              <div class="text-[11.5px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5 truncate">
                <lucide-icon [img]="truckIcon" [size]="11" class="shrink-0" />{{ vehicleLabel() }}
              </div>
            </div>
            <span class="ml-auto badge shrink-0" [class]="statusBadge().badge">{{ statusBadge().label }}</span>
          </div>

          <div class="relative flex items-center justify-between gap-3 pt-3.5 border-t border-white/10 text-[11.5px]">
            <span class="flex items-center gap-1.5 min-w-0">
              <span class="relative flex w-1.5 h-1.5 shrink-0">
                @if (tracking.active()) {
                  <span class="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                }
                <span class="relative inline-flex w-1.5 h-1.5 rounded-full" [class]="tracking.active() ? 'bg-emerald-400' : 'bg-slate-500'"></span>
              </span>
              <span class="truncate" [class]="tracking.active() ? 'text-emerald-300 font-medium' : 'text-slate-400'">
                {{ tracking.active() ? 'GPS activo' : 'GPS inactivo' }}
              </span>
            </span>
            <span class="text-slate-400 truncate text-right tnum">{{ routeSummary() }}</span>
          </div>
        </div>

        <!-- ═══════════ BOTÓN PÁNICO ═══════════ -->
        <button type="button" class="panic-btn mb-3 fade-in-up group" (click)="showPanicModal.set(true)">
          <lucide-icon [img]="sirenIcon" [size]="22" class="transition-transform group-hover:scale-110" />
          <span class="text-[15px] tracking-[0.02em]">REPORTAR INCIDENCIA</span>
        </button>
        <p class="text-center text-[11.5px] text-slate-500 mb-7">Úsalo solo para emergencias graves</p>

        <form class="space-y-4" (ngSubmit)="submit($event)">

          <!-- ─── Ubicación ─── -->
          <div class="card p-4 fade-in-up">
            <div class="flex items-center justify-between gap-2 mb-3">
              <label class="input-label mb-0 flex items-center gap-1.5">
                <lucide-icon [img]="mapPinIcon" [size]="13" class="text-blue-600" />Ubicación
              </label>
              <button
                type="button"
                class="text-[11.5px] font-semibold text-blue-600 hover:text-blue-800 transition flex items-center gap-1
                       px-2 py-1 rounded-md hover:bg-blue-50 disabled:opacity-60"
                [disabled]="gpsLoading()"
                (click)="getGps()"
              >
                @if (gpsLoading()) {
                  <lucide-icon [img]="loaderIcon" [size]="13" class="animate-spin" />Obteniendo...
                } @else {
                  <lucide-icon [img]="crosshairIcon" [size]="13" />Usar GPS actual
                }
              </button>
            </div>

            <div
              class="text-[12px] mb-3 px-3 py-2.5 rounded-lg ring-1 leading-relaxed"
              [class]="locationError() ? 'bg-red-50 ring-red-200 text-red-700' : 'bg-slate-50 ring-slate-200/70 text-slate-500'"
              [innerHTML]="locationDisplay()"
            ></div>

            <input type="text" class="input" placeholder="Ej. Carretera Central km 78, Chosica" [(ngModel)]="ubicacion" name="ubicacion" required />
          </div>

          <!-- ─── Categoría + Severidad ─── -->
          <div class="card p-4 fade-in-up">
            <label class="input-label">Categoría</label>
            <select class="select" [(ngModel)]="categoria" name="categoria" required>
              <option value="">Selecciona...</option>
              @for (c of categorias; track c) {
                <option [value]="c">{{ c }}</option>
              }
            </select>

            <label class="input-label mt-4">Severidad</label>
            <div class="grid grid-cols-3 gap-2">
              @for (s of severidades; track s.value) {
                <label class="cursor-pointer">
                  <input type="radio" name="severidad" [value]="s.value" class="sr-only" [(ngModel)]="severidad" />
                  <div
                    class="flex items-center justify-center gap-1.5 text-[12.5px] font-semibold py-2.5 rounded-lg
                           ring-1 transition-all duration-150"
                    [class]="severidad === s.value ? s.activeClass : 'ring-slate-200 text-slate-500 hover:bg-slate-50 hover:ring-slate-300'"
                  >
                    <span class="w-1.5 h-1.5 rounded-full" [class]="severidad === s.value ? s.dotClass : 'bg-slate-300'"></span>
                    {{ s.label }}
                  </div>
                </label>
              }
            </div>
          </div>

          <!-- ─── Descripción + Audio ─── -->
          <div class="card p-4 fade-in-up">
            <label class="input-label">Descripción</label>
            <textarea rows="3" class="textarea" placeholder="Describe brevemente lo que ocurrió..." [(ngModel)]="descripcion" name="descripcion"></textarea>

            <div class="mt-4 flex flex-col items-center pt-4 border-t border-slate-100">
              <button
                type="button"
                class="mic-btn"
                [class.is-recording]="recording()"
                (click)="toggleRecording()"
                [attr.aria-label]="recording() ? 'Detener grabación' : 'Grabar audio'"
              >
                <lucide-icon [img]="recording() ? squareIcon : micIcon" [size]="recording() ? 20 : 24" />
              </button>
              <p class="text-[11.5px] mt-3 tnum" [class]="recording() ? 'text-red-600 font-semibold' : 'text-slate-500'">
                {{ recordingStatus() }}
              </p>

              @if (audioUrl()) {
                <div class="w-full mt-3 p-2.5 rounded-lg bg-slate-50 ring-1 ring-slate-200/70">
                  <audio [src]="audioUrl()!" controls class="w-full" style="height:34px"></audio>
                  <button type="button" class="text-[11.5px] text-red-500 hover:text-red-700 mt-2 font-semibold flex items-center gap-1 mx-auto transition" (click)="removeAudio()">
                    <lucide-icon [img]="trashIcon" [size]="11" />Eliminar audio
                  </button>
                </div>
              }
            </div>
          </div>

          <!-- ─── Fotos ─── -->
          <div class="card p-4 fade-in-up">
            <div class="flex items-center justify-between gap-2 mb-3">
              <label class="input-label mb-0">Adjuntar fotos</label>
              <span class="text-[11px] font-medium tnum px-2 py-0.5 rounded-md"
                    [class]="photos().length >= 5 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'">
                {{ photos().length }} / 5
              </span>
            </div>

            @if (photos().length < 5) {
              <label
                for="photo-input"
                class="group flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-slate-200
                       rounded-xl py-7 cursor-pointer transition
                       hover:border-blue-400 hover:bg-blue-50/40"
              >
                <div class="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition">
                  <lucide-icon [img]="cameraIcon" [size]="19" class="text-slate-400 group-hover:text-blue-600 transition" />
                </div>
                <span class="text-[12.5px] font-semibold text-slate-700">Tomar foto o subir</span>
                <span class="text-[11px] text-slate-400">JPG, PNG · máx. 5 fotos</span>
              </label>
            } @else {
              <div class="text-center py-4 rounded-xl bg-amber-50 ring-1 ring-amber-200/70">
                <p class="text-[12px] font-medium text-amber-700">Límite de 5 fotos alcanzado</p>
                <p class="text-[11px] text-amber-600/80 mt-0.5">Elimina alguna para agregar más.</p>
              </div>
            }

            <input id="photo-input" type="file" accept="image/*" capture="environment" multiple class="hidden" (change)="onPhotos($event)" />

            @if (photos().length) {
              <div class="grid grid-cols-3 gap-2 mt-3">
                @for (p of photos(); track p.url; let i = $index) {
                  <div class="photo-thumb group">
                    <img [src]="p.url" alt="Foto adjunta" />
                    <button type="button" class="remove-btn opacity-0 group-hover:opacity-100 transition-opacity" (click)="removePhoto(i)" aria-label="Quitar foto">×</button>
                  </div>
                }
              </div>
            }
          </div>

          <!-- ─── Enviar ─── -->
          <button
            type="submit"
            class="group w-full bg-[#0b1220] hover:bg-[#16233b] text-white text-[14px] font-semibold py-3.5 rounded-xl
                   flex items-center justify-center gap-2 transition-all active:scale-[0.99]
                   shadow-[0_1px_2px_rgba(11,18,32,0.3),0_8px_20px_-8px_rgba(11,18,32,0.5)]"
          >
            <lucide-icon [img]="sendIcon" [size]="16" class="transition-transform group-hover:translate-x-0.5" />
            Enviar reporte
          </button>
          <p class="text-center text-[11px] text-slate-400 pb-6 leading-relaxed px-4">
            Al enviar aceptas que la información se comparta con el centro de control.
          </p>
        </form>
      </div>
    </div>

    <!-- ═══════════ MODAL PÁNICO ═══════════ -->
    @if (showPanicModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] fade-in-up" (click)="showPanicModal.set(false)">
        <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" (click)="$event.stopPropagation()">
          <div class="relative w-14 h-14 mx-auto mb-4">
            <span class="absolute inset-0 rounded-full bg-red-100 animate-ping opacity-60"></span>
            <div class="relative w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center ring-4 ring-red-50">
              <lucide-icon [img]="alertOctagonIcon" [size]="24" />
            </div>
          </div>
          <h3 class="text-[17px] font-bold text-slate-900 text-center tracking-tight mb-2">¿Confirmar emergencia?</h3>
          <p class="text-[12.5px] text-slate-500 text-center mb-5 leading-relaxed px-2">
            Se enviará tu ubicación, datos del vehículo y una alerta inmediata al centro de control.
          </p>
          <div class="flex gap-2.5">
            <button type="button" class="flex-1 py-2.5 rounded-lg ring-1 ring-slate-200 text-slate-600 text-[13px] font-semibold hover:bg-slate-50 transition" (click)="showPanicModal.set(false)">
              Cancelar
            </button>
            <button type="button" class="flex-[1.3] py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[13px] font-semibold transition active:scale-[0.99] shadow-sm shadow-red-600/30" (click)="confirmPanic()">
              Sí, es emergencia
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ═══════════ ALERTA ENVIADA ═══════════ -->
    @if (showPanicSent()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/85 backdrop-blur-sm">
        <div class="bg-white rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl">
          <div class="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50 flex items-center justify-center mx-auto mb-5 check-pop">
            <lucide-icon [img]="checkIcon" [size]="34" [strokeWidth]="2.5" />
          </div>
          <h3 class="text-[19px] font-bold text-slate-900 tracking-tight mb-2">Alerta enviada</h3>
          <p class="text-[13px] text-slate-500 leading-relaxed">El centro de control fue notificado. Mantén la calma y espera contacto.</p>
        </div>
      </div>
    }

    <!-- ═══════════ REPORTE ENVIADO ═══════════ -->
    @if (showSubmitSuccess()) {
      <div class="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
        <div class="bg-white rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl">
          <div class="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50 flex items-center justify-center mx-auto mb-4 check-pop">
            <lucide-icon [img]="checkIcon" [size]="28" [strokeWidth]="2.5" />
          </div>
          <h3 class="text-[17px] font-bold text-slate-900 tracking-tight mb-1.5">Reporte enviado</h3>
          <p class="text-[12.5px] text-slate-500 leading-relaxed">Tu incidencia será asignada al equipo correspondiente en los próximos minutos.</p>
        </div>
      </div>
    }
  `
})
export class ReportarPageComponent implements OnInit {
  private readonly incidents = inject(IncidentService);
  private readonly layout = inject(LayoutService);
  private readonly auth = inject(AuthService);
  private readonly fleet = inject(FleetService);
  readonly tracking = inject(LocationTrackingService);

  readonly statusBadge = signal(vehicleStatusInfo('offline'));

  readonly userIcon = User;
  readonly sirenIcon = Siren;
  readonly mapPinIcon = MapPin;
  readonly crosshairIcon = Crosshair;
  readonly loaderIcon = Loader2;
  readonly micIcon = Mic;
  readonly trashIcon = Trash2;
  readonly cameraIcon = Camera;
  readonly sendIcon = Send;
  readonly alertOctagonIcon = AlertOctagon;
  readonly checkIcon = Check;
  readonly squareIcon = Square;
  readonly truckIcon = Truck;

  readonly categorias = ['Mecánico', 'Accidente', 'Seguridad / Robo', 'Tráfico', 'Carga', 'Operativo', 'Otro'];
  readonly severidades = [
    {
      value: 'low',
      label: 'Baja',
      color: 'emerald',
      activeClass: 'ring-emerald-300 bg-emerald-50 text-emerald-700',
      dotClass: 'bg-emerald-500'
    },
    {
      value: 'medium',
      label: 'Media',
      color: 'amber',
      activeClass: 'ring-amber-300 bg-amber-50 text-amber-700',
      dotClass: 'bg-amber-500'
    },
    {
      value: 'high',
      label: 'Alta',
      color: 'red',
      activeClass: 'ring-red-300 bg-red-50 text-red-700',
      dotClass: 'bg-red-500'
    }
  ];

  ubicacion = '';
  categoria = '';
  severidad: 'low' | 'medium' | 'high' = 'medium';
  descripcion = '';
  lat: number | null = null;
  lng: number | null = null;

  readonly gpsLoading = signal(false);
  readonly locationDisplay = signal('Usa el botón GPS o ingresa la ubicación manualmente.');
  readonly locationError = signal(false);
  readonly recording = signal(false);
  readonly recordingStatus = signal('Toca para grabar tu descripción');
  readonly audioUrl = signal<string | null>(null);
  private audioBlob: Blob | null = null;
  readonly photos = signal<PhotoPreview[]>([]);
  readonly showPanicModal = signal(false);
  readonly showPanicSent = signal(false);
  readonly showSubmitSuccess = signal(false);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordTimer: ReturnType<typeof setInterval> | null = null;
  private recordStart = 0;

  private activeVehicleId: string | null = null;
  private activePlaca = '';
  private activeModelo = '';
  private activeRuta = '';
  private activeKm = 0;
  private activeEstado: 'ok' | 'warn' | 'alert' | 'offline' = 'offline';

  ngOnInit(): void {
    this.layout.setPage('Reportar incidencia', 'Vista mobile · Conductor');
    void this.bootstrap();
  }

  driverName(): string {
    return this.auth.profile()?.full_name?.trim() || 'Conductor';
  }

  vehicleLabel(): string {
    if (!this.activePlaca) return 'Sin vehículo asignado';
    return `${this.activePlaca} · ${this.activeModelo || '—'}`;
  }

  routeSummary(): string {
    if (!this.activePlaca) return 'Selecciona un vehículo en Mi ubicación';
    const km = this.activeKm ? `${this.activeKm.toLocaleString('es-PE')} km` : '— km';
    return `${this.activeRuta || 'Sin ruta'} · ${km}`;
  }

  private async bootstrap(): Promise<void> {
    await this.auth.refreshProfile();
    await this.fleet.load();
    await this.tracking.resumeIfNeeded();
    this.syncVehicleFromTracking();
    if (!this.activePlaca) {
      const options = await this.tracking.loadVehicleOptions();
      const mine = options.find((o) => o.esMio);
      if (mine) {
        const v = this.fleet.vehicles().find((x) => x.id === mine.id);
        this.applyVehicle(mine.id, mine.placa, mine.modelo, mine.ruta, v?.km ?? 0, v?.estado ?? 'ok');
      }
    }
  }

  private syncVehicleFromTracking(): void {
    const vid = this.tracking.vehicleId();
    if (!vid) return;
    const v = this.fleet.vehicles().find((x) => x.id === vid);
    if (v) this.applyVehicle(v.id!, v.placa, v.modelo, v.ruta, v.km, v.estado);
    else this.applyVehicle(vid, this.tracking.vehiclePlaca() ?? '—', '', '', 0, 'ok');
  }

  private applyVehicle(
    id: string,
    placa: string,
    modelo: string,
    ruta: string,
    km: number,
    estado: 'ok' | 'warn' | 'alert' | 'offline'
  ): void {
    this.activeVehicleId = id;
    this.activePlaca = placa;
    this.activeModelo = modelo;
    this.activeRuta = ruta;
    this.activeKm = km;
    this.activeEstado = estado;
    this.statusBadge.set(vehicleStatusInfo(estado));
  }

  getGps(): void {
    const tLat = this.tracking.lat();
    const tLng = this.tracking.lng();
    if (tLat != null && tLng != null) {
      this.lat = tLat;
      this.lng = tLng;
      this.locationError.set(false);
      this.locationDisplay.set(
        `<strong class="text-slate-800 font-semibold">${tLat.toFixed(6)}, ${tLng.toFixed(6)}</strong> (GPS del vehículo activo)`
      );
      return;
    }

    if (!navigator.geolocation) {
      this.locationError.set(true);
      this.locationDisplay.set('Geolocalización no disponible en este dispositivo.');
      return;
    }
    this.gpsLoading.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.lat = pos.coords.latitude;
        this.lng = pos.coords.longitude;
        this.locationError.set(false);
        this.locationDisplay.set(
          `<strong class="text-slate-800 font-semibold">${this.lat.toFixed(6)}, ${this.lng.toFixed(6)}</strong> (precisión ±${Math.round(pos.coords.accuracy)}m)`
        );
        this.gpsLoading.set(false);
      },
      (err) => {
        this.locationError.set(true);
        this.locationDisplay.set(`No se pudo obtener tu ubicación: ${err.message}`);
        this.gpsLoading.set(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async toggleRecording(): Promise<void> {
    if (this.recording()) {
      this.stopRecording();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      this.mediaRecorder.ondataavailable = (e) => this.audioChunks.push(e.data);
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioBlob = blob;
        const prev = this.audioUrl();
        if (prev) URL.revokeObjectURL(prev);
        this.audioUrl.set(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      this.mediaRecorder.start();
      this.recording.set(true);
      this.recordStart = Date.now();
      this.recordTimer = setInterval(() => {
        const sec = Math.floor((Date.now() - this.recordStart) / 1000);
        const mm = String(Math.floor(sec / 60)).padStart(2, '0');
        const ss = String(sec % 60).padStart(2, '0');
        this.recordingStatus.set(`Grabando... ${mm}:${ss}`);
      }, 500);
    } catch {
      this.recordingStatus.set('No se pudo acceder al micrófono.');
    }
  }

  stopRecording(): void {
    this.mediaRecorder?.stop();
    this.recording.set(false);
    if (this.recordTimer) clearInterval(this.recordTimer);
    this.recordingStatus.set('Audio grabado correctamente.');
  }

  removeAudio(): void {
    const prev = this.audioUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.audioUrl.set(null);
    this.audioBlob = null;
    this.recordingStatus.set('Toca para grabar tu descripción');
  }

  onPhotos(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    const current = this.photos();
    const remaining = 5 - current.length;
    const toAdd = files.slice(0, remaining).map((file) => ({ file, url: URL.createObjectURL(file) }));
    this.photos.set([...current, ...toAdd]);
    input.value = '';
  }

  removePhoto(index: number): void {
    const list = [...this.photos()];
    URL.revokeObjectURL(list[index].url);
    list.splice(index, 1);
    this.photos.set(list);
  }

  confirmPanic(): void {
    this.showPanicModal.set(false);
    void this.submitIncident(true).then(() => {
      this.showPanicSent.set(true);
      setTimeout(() => this.showPanicSent.set(false), 4000);
    });
  }

  submit(event: Event): void {
    event.preventDefault();
    void this.submitIncident(false).then((ok) => {
      if (ok) {
        this.showSubmitSuccess.set(true);
        setTimeout(() => this.showSubmitSuccess.set(false), 3500);
      }
    });
  }

  private async submitIncident(esPanico: boolean): Promise<boolean> {
    if (!this.activePlaca) {
      alert('Debes tener un vehículo asignado. Ve a Mi ubicación y activa el GPS.');
      return false;
    }

    const lat = this.lat ?? this.tracking.lat();
    const lng = this.lng ?? this.tracking.lng();

    const result = await this.incidents.create({
      titulo: this.descripcion.slice(0, 60) || (esPanico ? 'Emergencia reportada' : 'Nueva incidencia reportada'),
      placa: this.activePlaca,
      categoria: this.categoria || (esPanico ? 'Seguridad' : 'Operativo'),
      severidad: esPanico ? 'high' : this.severidad,
      ubicacion: this.ubicacion || 'Ubicación pendiente',
      lat,
      lng,
      descripcion: this.descripcion || (esPanico ? 'Botón de pánico activado.' : 'Sin descripción adicional.'),
      esPanico,
      photos: this.photos().map((p) => p.file),
      audio: this.audioBlob
    });

    if (!result.ok) return false;

    this.ubicacion = '';
    this.categoria = '';
    this.descripcion = '';
    this.severidad = 'medium';
    this.photos().forEach((p) => URL.revokeObjectURL(p.url));
    this.photos.set([]);
    this.removeAudio();
    return true;
  }
}
