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
  Trash2,
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
        <div class="bg-[#0f172a] text-white rounded-xl p-5 mb-5 fade-in-up">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
              <lucide-icon [img]="userIcon" [size]="20" />
            </div>
            <div>
              <div class="text-sm font-semibold">{{ driverName() }}</div>
              <div class="text-[11px] text-slate-400 font-mono">{{ vehicleLabel() }}</div>
            </div>
            <span class="ml-auto badge" [class]="statusBadge().badge">{{ statusBadge().label }}</span>
          </div>
          <div class="flex items-center justify-between text-[11px] text-slate-300">
            <span class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full animate-pulse" [class]="tracking.active() ? 'bg-emerald-400' : 'bg-slate-500'"></span>
              {{ tracking.active() ? 'GPS activo' : 'GPS inactivo — activa en Mi ubicación' }}
            </span>
            <span>{{ routeSummary() }}</span>
          </div>
        </div>

        <button type="button" class="panic-btn mb-5 fade-in-up" (click)="showPanicModal.set(true)">
          <lucide-icon [img]="sirenIcon" [size]="22" />
          <span class="text-base">REPORTAR INCIDENCIA</span>
        </button>
        <p class="text-center text-[11px] text-slate-500 -mt-3 mb-6">Mantén presionado para emergencias graves</p>

        <form class="space-y-5" (ngSubmit)="submit($event)">
          <div class="card p-4 fade-in-up">
            <div class="flex items-center justify-between mb-3">
              <label class="input-label mb-0 flex items-center gap-1">
                <lucide-icon [img]="mapPinIcon" [size]="13" />Ubicación
              </label>
              <button type="button" class="text-[11px] font-semibold text-blue-700 hover:text-blue-900 transition flex items-center gap-1" [disabled]="gpsLoading()" (click)="getGps()">
                @if (gpsLoading()) {
                  <lucide-icon [img]="loaderIcon" [size]="14" class="animate-spin" />Obteniendo...
                } @else {
                  <lucide-icon [img]="crosshairIcon" [size]="14" />Usar GPS actual
                }
              </button>
            </div>
            <p class="text-xs mb-3" [class]="locationError() ? 'text-red-600' : 'text-slate-500'" [innerHTML]="locationDisplay()"></p>
            <input type="text" class="input" placeholder="Ej. Carretera Central km 78, Chosica" [(ngModel)]="ubicacion" name="ubicacion" required />
          </div>

          <div class="card p-4 fade-in-up">
            <label class="input-label">Categoría</label>
            <select class="select" [(ngModel)]="categoria" name="categoria" required>
              <option value="">Selecciona...</option>
              @for (c of categorias; track c) { <option [value]="c">{{ c }}</option> }
            </select>
            <label class="input-label mt-4">Severidad</label>
            <div class="grid grid-cols-3 gap-2">
              @for (s of severidades; track s.value) {
                <label class="cursor-pointer">
                  <input type="radio" name="severidad" [value]="s.value" class="peer sr-only" [(ngModel)]="severidad" />
                  <div class="text-center text-xs font-semibold py-2 rounded-lg border border-slate-200 peer-checked:border-{{ s.color }}-500 peer-checked:bg-{{ s.color }}-50 peer-checked:text-{{ s.color }}-700 transition" [class]="severidad === s.value ? s.activeClass : ''">{{ s.label }}</div>
                </label>
              }
            </div>
          </div>

          <div class="card p-4 fade-in-up">
            <label class="input-label">Descripción</label>
            <textarea rows="3" class="textarea" placeholder="Describe brevemente lo que ocurrió..." [(ngModel)]="descripcion" name="descripcion"></textarea>
            <div class="mt-4 flex flex-col items-center pt-3 border-t border-slate-100">
              <button type="button" class="mic-btn" [class.is-recording]="recording()" (click)="toggleRecording()" aria-label="Grabar audio">
                <lucide-icon [img]="micIcon" [size]="24" />
              </button>
              <p class="text-[11px] text-slate-500 mt-2.5">{{ recordingStatus() }}</p>
              @if (audioUrl()) {
                <audio [src]="audioUrl()!" controls class="mt-3 w-full" style="height:36px"></audio>
                <button type="button" class="text-[11px] text-red-600 mt-2 font-semibold flex items-center gap-1" (click)="removeAudio()">
                  <lucide-icon [img]="trashIcon" [size]="11" />Eliminar audio
                </button>
              }
            </div>
          </div>

          <div class="card p-4 fade-in-up">
            <div class="flex items-center justify-between mb-3">
              <label class="input-label mb-0">Adjuntar fotos</label>
              <span class="text-[11px] text-slate-500">{{ photos().length }} de 5 fotos</span>
            </div>
            <label for="photo-input" class="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-slate-300 rounded-lg py-6 cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition">
              <lucide-icon [img]="cameraIcon" [size]="22" class="text-slate-500" />
              <span class="text-xs font-semibold text-slate-700">Tomar foto o subir</span>
              <span class="text-[11px] text-slate-500">JPG, PNG · máx. 5 fotos</span>
            </label>
            <input id="photo-input" type="file" accept="image/*" capture="environment" multiple class="hidden" (change)="onPhotos($event)" />
            @if (photos().length) {
              <div class="grid grid-cols-3 gap-2 mt-3">
                @for (p of photos(); track p.url; let i = $index) {
                  <div class="photo-thumb">
                    <img [src]="p.url" alt="Foto adjunta" />
                    <button type="button" class="remove-btn" (click)="removePhoto(i)">×</button>
                  </div>
                }
              </div>
            }
          </div>

          <button type="submit" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2">
            <lucide-icon [img]="sendIcon" [size]="16" />Enviar reporte
          </button>
          <p class="text-center text-[11px] text-slate-500 pb-6">Al enviar aceptas que la información se comparta con el centro de control.</p>
        </form>
      </div>
    </div>

    @if (showPanicModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(15, 23, 42, 0.6)" (click)="showPanicModal.set(false)">
        <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-lg fade-in-up" (click)="$event.stopPropagation()">
          <div class="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
            <lucide-icon [img]="alertOctagonIcon" [size]="24" />
          </div>
          <h3 class="text-base font-bold text-slate-900 text-center mb-1.5">¿Confirmar emergencia?</h3>
          <p class="text-xs text-slate-600 text-center mb-5">Se enviará tu ubicación, datos del vehículo y alerta inmediata al centro de control.</p>
          <div class="flex gap-2">
            <button type="button" class="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-semibold" (click)="showPanicModal.set(false)">Cancelar</button>
            <button type="button" class="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold" (click)="confirmPanic()">Sí, emergencia</button>
          </div>
        </div>
      </div>
    }

    @if (showPanicSent()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(15, 23, 42, 0.85)">
        <div class="bg-white rounded-2xl p-8 w-full max-w-sm text-center shadow-lg">
          <div class="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 check-pop">
            <lucide-icon [img]="checkIcon" [size]="32" />
          </div>
          <h3 class="text-lg font-bold text-slate-900 mb-1.5">Alerta enviada</h3>
          <p class="text-sm text-slate-600">El centro de control fue notificado. Mantén la calma y espera contacto.</p>
        </div>
      </div>
    }

    @if (showSubmitSuccess()) {
      <div class="fixed inset-0 z-40 flex items-center justify-center p-4" style="background: rgba(15, 23, 42, 0.7)">
        <div class="bg-white rounded-2xl p-8 w-full max-w-sm text-center shadow-lg">
          <div class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 check-pop">
            <lucide-icon [img]="checkIcon" [size]="28" />
          </div>
          <h3 class="text-base font-bold text-slate-900 mb-1">Reporte enviado</h3>
          <p class="text-xs text-slate-600">Tu incidencia será asignada al equipo correspondiente en los próximos minutos.</p>
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

  readonly categorias = ['Mecánico', 'Accidente', 'Seguridad / Robo', 'Tráfico', 'Carga', 'Operativo', 'Otro'];
  readonly severidades = [
    { value: 'low', label: 'Baja', color: 'emerald', activeClass: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
    { value: 'medium', label: 'Media', color: 'amber', activeClass: 'border-amber-500 bg-amber-50 text-amber-700' },
    { value: 'high', label: 'Alta', color: 'red', activeClass: 'border-red-500 bg-red-50 text-red-700' }
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
        `<strong class="text-slate-800">${tLat.toFixed(6)}, ${tLng.toFixed(6)}</strong> (GPS del vehículo activo)`
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
          `<strong class="text-slate-800">${this.lat.toFixed(6)}, ${this.lng.toFixed(6)}</strong> (precisión ±${Math.round(pos.coords.accuracy)}m)`
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
