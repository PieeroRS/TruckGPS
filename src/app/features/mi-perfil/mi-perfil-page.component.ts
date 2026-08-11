import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertCircle,
  BadgeCheck,
  Check,
  LogOut,
  LucideAngularModule,
  Mail,
  Monitor,
  Save,
  Shield,
  User
} from 'lucide-angular';
import { AuthService } from '../../auth/auth.service';
import { LayoutService } from '../../core/services/layout.service';

@Component({
  standalone: true,
  selector: 'app-mi-perfil-page',
  imports: [CommonModule, FormsModule, LucideAngularModule],
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
          <div class="flex items-center gap-2.5 mb-1 group">
            <div
              class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100 flex items-center justify-center
                     transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
            >
              <lucide-icon [img]="userIcon" [size]="16" />
            </div>
            <h3 class="text-[15px] font-semibold text-slate-900 tracking-tight">Información personal</h3>
          </div>
          <p class="text-[12.5px] text-slate-500 mb-5 ml-[42px]">Actualiza los datos visibles para tu equipo.</p>

          <div class="space-y-4">
            <div>
              <label class="input-label">Nombre completo</label>
              <input
                type="text"
                class="input transition-all duration-200 focus:scale-[1.005]"
                [(ngModel)]="fullName"
                name="fullName"
                placeholder="Tu nombre y apellido"
              />
              @if (dirty()) {
                <p class="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1.5 msg-in">
                  <span class="w-1 h-1 rounded-full bg-amber-500 dot-pulse"></span>Tienes cambios sin guardar
                </p>
              }
            </div>

            <div>
              <label class="input-label flex items-center gap-1.5">
                <lucide-icon [img]="mailIcon" [size]="12" class="text-slate-400" />Correo
              </label>
              <div class="relative">
                <input type="email" class="input bg-slate-50 text-slate-500 pr-9" [value]="auth.profile()?.email ?? ''" disabled />
                <lucide-icon [img]="lockBadgeIcon" [size]="14" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
              </div>
              <p class="text-[11px] text-slate-400 mt-1.5">El correo no se puede modificar desde aquí.</p>
            </div>

            <div>
              <label class="input-label flex items-center gap-1.5">
                <lucide-icon [img]="shieldIcon" [size]="12" class="text-slate-400" />Rol asignado
              </label>
              <div class="relative">
                <input type="text" class="input bg-slate-50 text-slate-500 pr-9" [value]="auth.roleLabel()" disabled />
                <lucide-icon [img]="lockBadgeIcon" [size]="14" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
              </div>
              <p class="text-[11px] text-slate-400 mt-1.5">Solo un administrador puede cambiar tu rol.</p>
            </div>

            @if (error()) {
              <div class="flex items-start gap-2 p-3 rounded-lg bg-red-50 ring-1 ring-red-200 text-red-700 msg-in">
                <lucide-icon [img]="alertIcon" [size]="14" class="mt-0.5 shrink-0" />
                <p class="text-[12.5px] leading-snug">{{ error() }}</p>
              </div>
            }

            @if (success()) {
              <div class="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700 msg-in">
                <lucide-icon [img]="checkIcon" [size]="14" class="mt-0.5 shrink-0 check-pop" />
                <p class="text-[12.5px] leading-snug">{{ success() }}</p>
              </div>
            }

            <button
              type="button"
              class="group relative w-full py-2.5 rounded-lg overflow-hidden bg-[#0b1220] hover:bg-[#16233b]
                     text-white text-[13.5px] font-semibold
                     flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.99]
                     shadow-[0_1px_2px_rgba(11,18,32,0.25),0_6px_16px_-8px_rgba(11,18,32,0.5)]
                     hover:shadow-[0_1px_2px_rgba(11,18,32,0.25),0_10px_24px_-8px_rgba(11,18,32,0.6)]
                     disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none"
              [disabled]="saving() || !dirty()"
              (click)="save()"
            >
              <span
                class="pointer-events-none absolute inset-0 -translate-x-full
                       bg-gradient-to-r from-transparent via-white/12 to-transparent
                       transition-transform duration-700 group-hover:translate-x-full"
              ></span>
              <lucide-icon
                [img]="saveIcon"
                [size]="15"
                [class.animate-pulse]="saving()"
                class="transition-transform duration-200 group-hover:-translate-y-0.5"
              />
              {{ saving() ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </div>
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
  `
})
export class MiPerfilPageComponent implements OnInit {
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

  readonly saving = signal(false);
  readonly loggingOut = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  fullName = '';
  private originalName = '';

  ngOnInit(): void {
    this.layout.setPage('Mi perfil', 'Datos de tu cuenta');
    this.fullName = this.auth.profile()?.full_name ?? '';
    this.originalName = this.fullName;
  }

  dirty(): boolean {
    return this.fullName.trim() !== this.originalName.trim() && this.fullName.trim().length > 0;
  }

  shortId(): string {
    const id = this.auth.profile()?.id ?? '';
    return id ? `${id.slice(0, 8)}…${id.slice(-4)}` : '—';
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    const result = await this.auth.updateOwnProfile(this.fullName);
    this.saving.set(false);
    if (!result.ok) {
      this.error.set(result.error ?? 'Error al guardar');
    } else {
      this.originalName = this.fullName;
      this.success.set('Perfil actualizado correctamente.');
      setTimeout(() => this.success.set(null), 3500);
    }
  }

  async logout(): Promise<void> {
    if (!confirm('¿Cerrar sesión en TruckGPS?')) return;
    this.loggingOut.set(true);
    try {
      await this.auth.logout();
    } finally {
      this.loggingOut.set(false);
    }
  }
}
