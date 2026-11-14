import { ConfirmService } from '../../core/services/confirm.service';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AlertCircle,
  BadgeCheck,
  Check,
  LogOut,
  LucideAngularModule,
  Mail,
  Lock,
  Monitor,
  Pencil,
  Save,
  Shield,
  Truck,
  User
} from 'lucide-angular';
import { AuthService } from '../../auth/auth.service';
import { ApiService } from '../../core/api/api.service';
import { Vehicle } from '../../core/models/vehicle.model';
import { LayoutService } from '../../core/services/layout.service';
import { DatosFlota, FlotaResponse, SettingsService } from '../../core/services/settings.service';
import { apiErrorMessage } from '../../core/utils/api-error.util';

@Component({
  standalone: true,
  selector: 'app-mi-perfil-page',
  imports: [CommonModule, FormsModule, LucideAngularModule, RouterLink],
  template: `
    <div class="p-4 sm:p-6 lg:p-8 flex justify-center">
      <div class="w-full max-w-lg space-y-4">

        <!-- ═══════════ CABECERA ═══════════ -->
        <div
          class="relative overflow-hidden rounded-2xl bg-[#0b1220] text-white p-6 anim-in
                 ring-1 ring-white/10 shadow-lg shadow-slate-900/20
                 transition-shadow duration-500 hover:shadow-xl hover:shadow-slate-900/30"
        >
          <div class="pointer-events-none absolute -top-20 -right-12 w-64 h-64 rounded-full bg-blue-600/25 blur-[80px] glow-drift"></div>
          <div
            class="pointer-events-none absolute inset-0 opacity-[0.06]"
            style="background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:44px 44px;"
          ></div>
          <div class="pointer-events-none absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent sheen"></div>

          <div class="relative flex items-center gap-4">
            <div
              class="group w-16 h-16 rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur
                     flex items-center justify-center shrink-0 avatar-pop
                     transition-all duration-300 hover:bg-white/[0.16] hover:ring-white/30 hover:scale-105"
            >
              <span class="text-[20px] font-bold tracking-tight transition-transform duration-300 group-hover:scale-110">
                {{ auth.initials() }}
              </span>
            </div>
            <div class="min-w-0">
              <h2 class="text-[19px] font-bold tracking-[-0.02em] truncate anim-in" style="animation-delay: 140ms">
                {{ auth.profile()?.full_name || 'Usuario' }}
              </h2>
              <p class="text-[12.5px] text-white/50 mt-0.5 truncate anim-in" style="animation-delay: 210ms">
                {{ auth.profile()?.email || '—' }}
              </p>
              <span
                class="inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-1 rounded-full anim-in
                       bg-white/10 ring-1 ring-white/15 text-[11.5px] font-medium
                       transition-colors duration-200 hover:bg-white/[0.16]"
                style="animation-delay: 280ms"
              >
                <lucide-icon [img]="shieldIcon" [size]="11" class="text-blue-300" />
                {{ auth.roleLabel() }}
              </span>
            </div>
          </div>
        </div>

        <!-- ═══════════ DATOS PERSONALES ═══════════ -->
        <div class="card p-5 anim-in transition-shadow duration-300 hover:shadow-md" style="animation-delay: 90ms">
          <div class="flex items-start justify-between gap-3 mb-1">
            <div class="flex items-center gap-2.5 group">
              <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <lucide-icon [img]="userIcon" [size]="16" />
              </div>
              <h3 class="text-[15px] font-semibold text-slate-900 tracking-tight">Información personal</h3>
            </div>
            @if (!editing()) {
              <button type="button" class="edit-btn" (click)="startEdit()">
                <lucide-icon [img]="pencilIcon" [size]="13" />Editar perfil
              </button>
            }
          </div>
          <p class="text-[12.5px] text-slate-500 mb-5 ml-[42px]">Datos visibles para tu equipo y el centro de control.</p>

          @if (!editing()) {
            <dl class="space-y-3 text-[13px]">
              <div class="info-row"><dt>Nombre completo</dt><dd>{{ auth.profile()?.full_name || '—' }}</dd></div>
              <div class="info-row"><dt>Teléfono</dt><dd>{{ auth.profile()?.telefono || 'Sin registrar' }}</dd></div>
              <div class="info-row"><dt>N.° de licencia</dt><dd>{{ auth.profile()?.licencia || 'Sin registrar' }}</dd></div>
              <div class="info-row">
                <dt class="flex items-center gap-1"><lucide-icon [img]="mailIcon" [size]="12" />Correo</dt>
                <dd class="flex items-center gap-1.5">{{ auth.profile()?.email }}<lucide-icon [img]="lockIcon" [size]="12" class="text-slate-300" /></dd>
              </div>
              <div class="info-row">
                <dt class="flex items-center gap-1"><lucide-icon [img]="shieldIcon" [size]="12" />Rol</dt>
                <dd class="flex items-center gap-1.5">{{ auth.roleLabel() }}<lucide-icon [img]="lockIcon" [size]="12" class="text-slate-300" /></dd>
              </div>
            </dl>
          } @else {
            <div class="space-y-4">
              <div>
                <label class="input-label" for="pf-name">Nombre completo</label>
                <input id="pf-name" type="text" class="input" [(ngModel)]="fullName" name="fullName" placeholder="Tu nombre y apellido" />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="input-label" for="pf-tel">Teléfono</label>
                  <input id="pf-tel" type="tel" class="input" [(ngModel)]="telefono" name="telefono" placeholder="+51 987 654 321" />
                </div>
                <div>
                  <label class="input-label" for="pf-lic">N.° de licencia de conducir</label>
                  <input id="pf-lic" type="text" class="input uppercase" [(ngModel)]="licencia" name="licencia" placeholder="Q12345678" />
                </div>
              </div>
              <p class="text-[11px] text-slate-400">El correo y el rol no se cambian aquí: el correo es tu usuario de acceso y el rol lo asigna un administrador en Equipo.</p>

              <div class="flex gap-2">
                <button type="button" class="flex-1 py-2.5 rounded-lg ring-1 ring-slate-200 text-slate-700 text-[13px] font-semibold hover:bg-slate-50 transition" [disabled]="saving()" (click)="cancelEdit()">Cancelar</button>
                <button
                  type="button"
                  class="flex-1 py-2.5 rounded-lg bg-[#0b1220] hover:bg-[#16233b] text-white text-[13px] font-semibold flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  [disabled]="saving() || !dirty()"
                  (click)="save()"
                >
                  <lucide-icon [img]="saveIcon" [size]="15" [class.animate-pulse]="saving()" />
                  {{ saving() ? 'Guardando...' : 'Guardar cambios' }}
                </button>
              </div>
            </div>
          }

          @if (error()) {
            <div class="flex items-start gap-2 p-3 mt-4 rounded-lg bg-red-50 ring-1 ring-red-200 text-red-700 msg-in">
              <lucide-icon [img]="alertIcon" [size]="14" class="mt-0.5 shrink-0" />
              <p class="text-[12.5px] leading-snug">{{ error() }}</p>
            </div>
          }
          @if (success()) {
            <div class="flex items-start gap-2 p-3 mt-4 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700 msg-in">
              <lucide-icon [img]="checkIcon" [size]="14" class="mt-0.5 shrink-0 check-pop" />
              <p class="text-[12.5px] leading-snug">{{ success() }}</p>
            </div>
          }
        </div>

        <!-- ═══════════ INFORMACIÓN DE FLOTA ═══════════ -->
        <div class="card p-5 anim-in transition-shadow duration-300 hover:shadow-md" style="animation-delay: 140ms">
          <div class="flex items-start justify-between gap-3 mb-1">
            <div class="flex items-center gap-2.5 group">
              <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-100 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <lucide-icon [img]="truckIcon" [size]="16" />
              </div>
              <h3 class="text-[15px] font-semibold text-slate-900 tracking-tight">Información de flota</h3>
            </div>
            @if (auth.isStaff() && !editingFlota()) {
              <button type="button" class="edit-btn" (click)="startEditFlota()">
                <lucide-icon [img]="pencilIcon" [size]="13" />Editar datos de flota
              </button>
            }
          </div>
          <p class="text-[12.5px] text-slate-500 mb-5 ml-[42px]">
            {{ auth.isStaff() ? 'Datos de la empresa que aparecen en reportes y avisos.' : 'Tu empresa y la unidad que tienes asignada.' }}
          </p>

          @if (!editingFlota()) {
            <dl class="space-y-3 text-[13px]">
              <div class="info-row"><dt>Empresa</dt><dd>{{ flota()?.datos?.empresa || 'Sin registrar' }}</dd></div>
              <div class="info-row"><dt>RUC</dt><dd class="tnum">{{ flota()?.datos?.ruc || 'Sin registrar' }}</dd></div>
              <div class="info-row"><dt>Sede / base de operaciones</dt><dd>{{ flota()?.datos?.sede || 'Sin registrar' }}</dd></div>
              <div class="info-row"><dt>Teléfono de la central</dt><dd>{{ flota()?.datos?.telefono_central || 'Sin registrar' }}</dd></div>
              <div class="info-row"><dt>Correo de la central</dt><dd>{{ flota()?.datos?.correo_central || 'Sin registrar' }}</dd></div>
              <div class="info-row">
                <dt>Unidades registradas</dt>
                <dd class="flex items-center gap-2"><span class="tnum">{{ flota()?.unidades ?? '—' }}</span>
                  <a routerLink="/flota" class="text-[12px] font-semibold text-blue-600 hover:underline">Ver flota</a></dd>
              </div>
            </dl>
            @if (flota()?.actualizado) {
              <p class="text-[11px] text-slate-400 mt-3">Actualizado {{ flota()!.actualizado | date: 'dd/MM/yyyy HH:mm' }} por {{ flota()!.actualizadoPor }}</p>
            }
          } @else {
            <div class="space-y-3">
              <div>
                <label class="input-label" for="fl-emp">Empresa</label>
                <input id="fl-emp" class="input" [(ngModel)]="flotaForm.empresa" name="empresa" placeholder="Razón social" />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="input-label" for="fl-ruc">RUC</label>
                  <input id="fl-ruc" class="input tnum" inputmode="numeric" maxlength="11" [(ngModel)]="flotaForm.ruc" name="ruc" placeholder="20123456789" />
                </div>
                <div>
                  <label class="input-label" for="fl-sede">Sede / base</label>
                  <input id="fl-sede" class="input" [(ngModel)]="flotaForm.sede" name="sede" placeholder="Ej. Callao" />
                </div>
                <div>
                  <label class="input-label" for="fl-tel">Teléfono de la central</label>
                  <input id="fl-tel" class="input" [(ngModel)]="flotaForm.telefono_central" name="telc" placeholder="(01) 555 1234" />
                </div>
                <div>
                  <label class="input-label" for="fl-mail">Correo de la central</label>
                  <input id="fl-mail" type="email" class="input" [(ngModel)]="flotaForm.correo_central" name="mailc" placeholder="central@empresa.pe" />
                </div>
              </div>
              <p class="text-[11px] text-slate-400">Los datos de cada vehículo (placa, modelo, kilometraje, mantenimiento) se editan en <a routerLink="/flota" class="text-blue-600 font-semibold hover:underline">Flota</a>.</p>
              <div class="flex gap-2">
                <button type="button" class="flex-1 py-2.5 rounded-lg ring-1 ring-slate-200 text-slate-700 text-[13px] font-semibold hover:bg-slate-50 transition" [disabled]="savingFlota()" (click)="editingFlota.set(false)">Cancelar</button>
                <button type="button" class="flex-1 py-2.5 rounded-lg bg-[#0b1220] hover:bg-[#16233b] text-white text-[13px] font-semibold flex items-center justify-center gap-2 transition disabled:opacity-40" [disabled]="savingFlota()" (click)="saveFlota()">
                  <lucide-icon [img]="saveIcon" [size]="15" />{{ savingFlota() ? 'Guardando...' : 'Guardar datos de flota' }}
                </button>
              </div>
            </div>
          }

          @if (!auth.isStaff()) {
            <div class="mt-5 pt-4 border-t border-slate-100">
              <h4 class="text-[13px] font-semibold text-slate-900 mb-2">Mi unidad asignada</h4>
              @if (miUnidad(); as u) {
                <dl class="space-y-2.5 text-[13px]">
                  <div class="info-row"><dt>Placa</dt><dd class="font-semibold">{{ u.placa }}</dd></div>
                  <div class="info-row"><dt>Modelo</dt><dd>{{ u.modelo }}</dd></div>
                  <div class="info-row"><dt>Kilometraje</dt><dd class="tnum">{{ u.km | number }} km</dd></div>
                </dl>
                <div class="flex items-end gap-2 mt-3">
                  <div class="flex-1">
                    <label class="input-label" for="mu-km">Actualizar kilometraje (odómetro)</label>
                    <input id="mu-km" type="number" class="input tnum" [(ngModel)]="nuevoKm" name="nuevoKm" [min]="u.km" />
                  </div>
                  <button type="button" class="py-2.5 px-4 rounded-lg bg-[#0b1220] text-white text-[13px] font-semibold disabled:opacity-40" [disabled]="savingFlota() || !nuevoKm || nuevoKm <= u.km" (click)="saveKm()">Guardar</button>
                </div>
              } @else {
                <p class="text-[12.5px] text-slate-500">No tienes una unidad asignada. Elige tu unidad en <a routerLink="/mi-ubicacion" class="text-blue-600 font-semibold hover:underline">Mi ubicación en vivo</a>.</p>
              }
            </div>
          }

          @if (flotaMsg(); as m) {
            <div class="flex items-start gap-2 p-3 mt-4 rounded-lg ring-1 msg-in" [class]="m.ok ? 'bg-emerald-50 ring-emerald-200 text-emerald-700' : 'bg-red-50 ring-red-200 text-red-700'">
              <lucide-icon [img]="m.ok ? checkIcon : alertIcon" [size]="14" class="mt-0.5 shrink-0" />
              <p class="text-[12.5px] leading-snug">{{ m.text }}</p>
            </div>
          }
        </div>

        <!-- ═══════════ ESTADO DE CUENTA ═══════════ -->
        <div class="card p-5 anim-in transition-shadow duration-300 hover:shadow-md" style="animation-delay: 180ms">
          <div class="flex items-center gap-2.5 mb-4 group">
            <div
              class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 flex items-center justify-center
                     transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
            >
              <lucide-icon [img]="badgeIcon" [size]="16" />
            </div>
            <h3 class="text-[15px] font-semibold text-slate-900 tracking-tight">Estado de la cuenta</h3>
          </div>

          <dl class="space-y-2.5 text-[12.5px]">
            <div
              class="flex items-center justify-between gap-3 row-in px-2 -mx-2 py-1 rounded-md transition-colors hover:bg-slate-50"
              style="animation-delay: 300ms"
            >
              <dt class="text-slate-500">Cuenta</dt>
              <dd class="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
                <span class="relative flex w-1.5 h-1.5">
                  <span class="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                  <span class="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                </span>
                Activa
              </dd>
            </div>
            <div
              class="flex items-center justify-between gap-3 row-in px-2 -mx-2 py-1 rounded-md transition-colors hover:bg-slate-50"
              style="animation-delay: 370ms"
            >
              <dt class="text-slate-500">Nivel de acceso</dt>
              <dd class="font-semibold text-slate-900">{{ auth.roleLabel() }}</dd>
            </div>
            <div
              class="flex items-center justify-between gap-3 row-in px-2 -mx-2 py-1 rounded-md transition-colors hover:bg-slate-50"
              style="animation-delay: 440ms"
            >
              <dt class="text-slate-500">Identificador</dt>
              <dd class="font-mono text-[11.5px] text-slate-500 truncate max-w-[180px]">{{ shortId() }}</dd>
            </div>
          </dl>
        </div>

        <!-- ═══════════ SESIÓN ═══════════ -->
        <div class="card p-5 anim-in transition-shadow duration-300 hover:shadow-md" style="animation-delay: 270ms">
          <div class="flex items-center gap-2.5 mb-1 group">
            <div
              class="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 ring-1 ring-slate-200/70 flex items-center justify-center
                     transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
            >
              <lucide-icon [img]="monitorIcon" [size]="16" />
            </div>
            <h3 class="text-[15px] font-semibold text-slate-900 tracking-tight">Sesión</h3>
          </div>
          <p class="text-[12.5px] text-slate-500 mb-4 ml-[42px] leading-relaxed">
            Cierra sesión en este dispositivo. El seguimiento GPS en vivo se detendrá.
          </p>

          <button
            type="button"
            class="group w-full py-2.5 rounded-lg ring-1 ring-red-200 bg-red-50 text-red-600 text-[13.5px] font-semibold
                   hover:bg-red-100 hover:ring-red-300 transition-all duration-200 flex items-center justify-center gap-2
                   active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100"
            [disabled]="loggingOut()"
            (click)="logout()"
          >
            <lucide-icon [img]="logoutIcon" [size]="15" class="transition-transform duration-200 group-hover:translate-x-0.5" />
            {{ loggingOut() ? 'Cerrando sesión...' : 'Cerrar sesión' }}
          </button>
        </div>

        <p class="text-center text-[11px] text-slate-400 pb-4 anim-in" style="animation-delay: 360ms">
          TruckGPS · Control Center
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .info-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 2px 0; }
      .info-row dt { color: #64748b; flex-shrink: 0; }
      .info-row dd { color: #0f172a; font-weight: 500; text-align: right; min-width: 0; overflow-wrap: anywhere; }
      .edit-btn {
        display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 8px; flex-shrink: 0;
        font-size: 12px; font-weight: 600; color: #1d4ed8; background: #eff6ff; box-shadow: 0 0 0 1px #dbeafe inset; transition: all .15s;
      }
      .edit-btn:hover { background: #dbeafe; }
    `
  ]
})
export class MiPerfilPageComponent implements OnInit {
  private readonly confirmDialog = inject(ConfirmService);
  readonly auth = inject(AuthService);
  private readonly layout = inject(LayoutService);

  readonly userIcon = User;
  readonly logoutIcon = LogOut;
  readonly mailIcon = Mail;
  readonly shieldIcon = Shield;
  readonly saveIcon = Save;
  readonly checkIcon = Check;
  readonly alertIcon = AlertCircle;
  readonly badgeIcon = BadgeCheck;
  readonly monitorIcon = Monitor;
  readonly lockBadgeIcon = BadgeCheck;
  readonly lockIcon = Lock;
  readonly pencilIcon = Pencil;
  readonly truckIcon = Truck;

  private readonly api = inject(ApiService);
  private readonly settings = inject(SettingsService);
  readonly editing = signal(false);
  readonly editingFlota = signal(false);
  readonly savingFlota = signal(false);
  readonly flota = signal<FlotaResponse | null>(null);
  readonly miUnidad = signal<Vehicle | null>(null);
  readonly flotaMsg = signal<{ ok: boolean; text: string } | null>(null);
  flotaForm: Partial<DatosFlota> = {};
  nuevoKm: number | null = null;
  telefono = '';
  licencia = '';

  readonly saving = signal(false);
  readonly loggingOut = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  fullName = '';

  ngOnInit(): void {
    this.layout.setPage('Mi perfil', 'Datos de tu cuenta y de tu flota');
    this.resetForm();
    void this.loadFlota();
  }

  private resetForm(): void {
    const p = this.auth.profile();
    this.fullName = p?.full_name ?? '';
    this.telefono = p?.telefono ?? '';
    this.licencia = p?.licencia ?? '';
  }

  startEdit(): void {
    this.resetForm();
    this.error.set(null);
    this.success.set(null);
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.resetForm();
    this.error.set(null);
    this.editing.set(false);
  }

  dirty(): boolean {
    const p = this.auth.profile();
    if (!this.fullName.trim()) return false;
    return (
      this.fullName.trim() !== (p?.full_name ?? '').trim() ||
      this.telefono.trim() !== (p?.telefono ?? '') ||
      this.licencia.trim().toUpperCase() !== (p?.licencia ?? '')
    );
  }

  private async loadFlota(): Promise<void> {
    try {
      this.flota.set(await this.settings.getFlota());
    } catch {
      /* informativo */
    }
    if (!this.auth.isStaff()) {
      try {
        const v = await this.api.get<Vehicle | null>('/vehicles/mia');
        this.miUnidad.set(v);
        this.nuevoKm = v?.km ?? null;
      } catch {
        this.miUnidad.set(null);
      }
    }
  }

  private flashFlota(ok: boolean, text: string): void {
    this.flotaMsg.set({ ok, text });
    setTimeout(() => {
      if (this.flotaMsg()?.text === text) this.flotaMsg.set(null);
    }, 4000);
  }

  startEditFlota(): void {
    this.flotaForm = { ...(this.flota()?.datos ?? {}) };
    this.editingFlota.set(true);
  }

  async saveFlota(): Promise<void> {
    const ruc = (this.flotaForm.ruc ?? '').trim();
    if (ruc && !/^\d{11}$/.test(ruc)) {
      this.flashFlota(false, 'El RUC debe tener 11 dígitos.');
      return;
    }
    this.savingFlota.set(true);
    try {
      this.flota.set(await this.settings.saveFlota(this.flotaForm));
      this.editingFlota.set(false);
      this.flashFlota(true, 'Datos de flota actualizados correctamente.');
    } catch (e) {
      this.flashFlota(false, apiErrorMessage(e, 'No se pudieron guardar los datos de flota'));
    } finally {
      this.savingFlota.set(false);
    }
  }

  async saveKm(): Promise<void> {
    const u = this.miUnidad();
    if (!u?.id || !this.nuevoKm) return;
    this.savingFlota.set(true);
    try {
      const v = await this.api.patch<Vehicle>(`/vehicles/${u.id}/odometro`, { kilometraje: this.nuevoKm });
      this.miUnidad.set(v);
      this.flashFlota(true, `Kilometraje de ${v.placa} actualizado a ${v.km.toLocaleString('es-PE')} km.`);
    } catch (e) {
      this.flashFlota(false, apiErrorMessage(e, 'No se pudo actualizar el kilometraje'));
    } finally {
      this.savingFlota.set(false);
    }
  }

  shortId(): string {
    const id = this.auth.profile()?.id ?? '';
    return id ? `${id.slice(0, 8)}…${id.slice(-4)}` : '—';
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    const result = await this.auth.updateOwnProfile({
      full_name: this.fullName.trim(),
      telefono: this.telefono.trim(),
      licencia: this.licencia.trim().toUpperCase()
    });
    this.saving.set(false);
    if (!result.ok) {
      this.error.set(result.error ?? 'Error al guardar');
    } else {
      this.editing.set(false);
      this.success.set('Perfil actualizado correctamente.');
      setTimeout(() => this.success.set(null), 3500);
    }
  }

  async logout(): Promise<void> {
    if (!(await this.confirmDialog.ask('¿Cerrar sesión en TruckGPS?', { okLabel: 'Cerrar sesión' }))) return;
    this.loggingOut.set(true);
    try {
      await this.auth.logout();
    } finally {
      this.loggingOut.set(false);
    }
  }
}
